// Auto-heal agent for the CI pipeline.
// Reads the jest failure log, sends it to Gemini together with the PR diff and the
// source files involved, then applies the edits the model sends back.
// It is only allowed to edit non-test files under src/.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const LOG_PATH = process.env.TEST_LOG || 'test-results.log';
const SUMMARY_PATH = process.env.SUMMARY_PATH || 'auto-heal-summary.md';
const BASE_REF = process.env.BASE_REF || 'main';
const MODEL = process.env.MODEL || 'gemini-flash-latest';
const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// keep the request a reasonable size
const MAX_LOG_CHARS = 12000;
const MAX_DIFF_CHARS = 4000;
const MAX_SOURCE_CHARS = 40000;

const INSTRUCTION =
  'Parse the attached Jest failure log. Locate the source code causing the failure in src/ ' +
  'and generate a patch that fixes the bug without breaking existing tests.';

function fail(message) {
  console.error('auto-heal: ' + message);
  process.exit(1);
}

function isTestFile(path) {
  return path.includes('__tests__') || path.endsWith('.test.ts') || path.startsWith('src/test/');
}

function isEditableSource(path) {
  return path.startsWith('src/') && path.endsWith('.ts') && !isTestFile(path) && existsSync(path);
}

// jest output has color codes and a lot of passing-test noise, keep just the failures
function trimLog(rawLog) {
  let log = rawLog.replace(/\x1b\[[0-9;]*m/g, '');

  const summaryIndex = log.indexOf('Summary of all failing tests');
  const firstFailure = log.indexOf('●');
  if (summaryIndex !== -1) {
    log = log.slice(summaryIndex);
  } else if (firstFailure !== -1) {
    log = log.slice(firstFailure);
  }

  if (log.length > MAX_LOG_CHARS) {
    log = log.slice(0, MAX_LOG_CHARS) + '\n... (log cut off)';
  }
  return log;
}

function run(command) {
  return execSync(command, { encoding: 'utf8' });
}

// source files the agent gets to see and is allowed to change. The files this PR changed
// are the best lead. Only if the PR didn't touch src/ do we fall back to files named in
// the log (stack traces also name setup and config files, which is just noise).
function pickSourceFiles(log) {
  const files = [];

  const changed = run(`git diff --name-only origin/${BASE_REF}...HEAD -- src`).split('\n');
  for (const file of changed) {
    if (isEditableSource(file) && !files.includes(file)) {
      files.push(file);
    }
  }
  if (files.length > 0) {
    return files;
  }

  const mentioned = log.match(/src\/[\w./-]+\.ts/g) || [];
  for (const file of mentioned) {
    if (isEditableSource(file) && !files.includes(file)) {
      files.push(file);
    }
  }
  return files;
}

// the failing test files, sent so the model knows what behavior is expected (read only)
function pickTestFiles(log) {
  const files = [];
  const mentioned = log.match(/src\/[\w./-]+\.test\.ts/g) || [];
  for (const file of mentioned) {
    if (existsSync(file) && !files.includes(file)) {
      files.push(file);
    }
  }
  return files;
}

function addFiles(files, used) {
  let text = '';
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (used.chars + content.length > MAX_SOURCE_CHARS) {
      console.log('auto-heal: skipping ' + file + ' (too big for the request)');
      continue;
    }
    used.chars += content.length;
    text += `\n--- ${file} ---\n${content}\n`;
  }
  return text;
}

function buildPrompt(log, diff, sourceFiles, testFiles) {
  const used = { chars: 0 };
  const sources = addFiles(sourceFiles, used);
  const tests = addFiles(testFiles, used);

  return [
    INSTRUCTION,
    '',
    'Rules:',
    '- Only change the files under "Source files". Never change tests or test assertions.',
    '- Make the smallest change that fixes the bug.',
    '- Reply with JSON only, in this shape:',
    '  {"diagnosis": "what was wrong and why the tests failed",',
    '   "edits": [{"file": "src/...", "search": "exact text from the file", "replace": "new text"}]}',
    '- "search" must be copied exactly from the file and appear in it only once.',
    '',
    '=== Jest failure log ===',
    log,
    '',
    `=== Diff of src/ against ${BASE_REF} (this PR) ===`,
    diff || '(no changes in src/)',
    '',
    '=== Source files (you may edit these) ===',
    sources,
    '',
    '=== Failing test files (read only, do not edit) ===',
    tests || '(none)',
  ].join('\n');
}

async function askModel(prompt) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              'You are a CI repair agent for a TypeScript, Express and Mongoose backend. ' +
              'You fix bugs in source code and never edit tests.',
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    fail(`model request failed (${response.status}): ${raw.slice(0, 1000)}`);
  }

  let text;
  try {
    const data = JSON.parse(raw);
    text = data.candidates[0].content.parts[0].text.trim();
  } catch (err) {
    fail('unexpected response from the model API: ' + raw.slice(0, 1000));
  }

  // just in case the model wraps the JSON in a code fence anyway
  if (text.startsWith('```')) {
    text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail('the model did not reply with valid JSON: ' + text.slice(0, 1000));
  }
}

function countOccurrences(text, part) {
  let count = 0;
  let index = text.indexOf(part);
  while (index !== -1) {
    count++;
    index = text.indexOf(part, index + part.length);
  }
  return count;
}

function applyEdits(edits, allowedFiles) {
  if (!Array.isArray(edits) || edits.length === 0) {
    fail('the model did not return any edits');
  }

  const changedFiles = [];
  for (const edit of edits) {
    if (!allowedFiles.includes(edit.file)) {
      fail(`the model tried to edit ${edit.file}, which it is not allowed to touch`);
    }
    if (typeof edit.search !== 'string' || edit.search === '' || typeof edit.replace !== 'string') {
      fail(`bad edit for ${edit.file}`);
    }

    const content = readFileSync(edit.file, 'utf8');
    const found = countOccurrences(content, edit.search);
    if (found !== 1) {
      fail(`search text for ${edit.file} was found ${found} times, expected exactly 1`);
    }

    writeFileSync(edit.file, content.replace(edit.search, () => edit.replace));
    if (!changedFiles.includes(edit.file)) {
      changedFiles.push(edit.file);
    }
  }
  return changedFiles;
}

async function main() {
  if (!API_KEY) {
    fail('GEMINI_API_KEY is not set (add it as a repository secret)');
  }
  if (!existsSync(LOG_PATH)) {
    fail('no test log found at ' + LOG_PATH);
  }

  const log = trimLog(readFileSync(LOG_PATH, 'utf8'));
  const sourceFiles = pickSourceFiles(log);
  if (sourceFiles.length === 0) {
    fail('could not find any source files in src/ related to the failure');
  }
  const testFiles = pickTestFiles(log);
  console.log('auto-heal: source files (editable): ' + sourceFiles.join(', '));
  console.log('auto-heal: test files (read only): ' + (testFiles.join(', ') || 'none'));

  let diff = run(`git diff origin/${BASE_REF}...HEAD -- src ':!**/__tests__/**'`);
  if (diff.length > MAX_DIFF_CHARS) {
    diff = diff.slice(0, MAX_DIFF_CHARS) + '\n... (diff cut off)';
  }

  const answer = await askModel(buildPrompt(log, diff, sourceFiles, testFiles));
  console.log('auto-heal: diagnosis: ' + answer.diagnosis);

  const changedFiles = applyEdits(answer.edits, sourceFiles);

  const summary = [
    '## Auto-heal summary',
    '',
    'This PR was opened automatically by the `auto-fix` job after the Jest tests failed on `' +
      (process.env.HEAD_REF || 'this branch') +
      '`.',
    '',
    `**Model:** ${MODEL} (Google Gemini API)`,
    '',
    '**Diagnosis:** ' + answer.diagnosis,
    '',
    '**Files changed:** ' + changedFiles.map((f) => '`' + f + '`').join(', '),
  ].join('\n');
  writeFileSync(SUMMARY_PATH, summary + '\n');
}

main().catch((err) => fail(err.stack || String(err)));
