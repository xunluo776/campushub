// Auto-heal agent for the CI pipeline.
// Reads the jest failure log, sends it to a model on GitHub Models together with the
// PR diff and the source files involved, then applies the edits the model sends back.
// It is only allowed to edit non-test files under src/.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const LOG_PATH = process.env.TEST_LOG || 'test-results.log';
const SUMMARY_PATH = process.env.SUMMARY_PATH || 'auto-heal-summary.md';
const BASE_REF = process.env.BASE_REF || 'main';
const MODEL = process.env.MODEL || 'openai/gpt-4.1';
const TOKEN = process.env.GITHUB_TOKEN;
const API_URL = process.env.MODELS_URL || 'https://models.github.ai/inference/chat/completions';

// the free GitHub Models tier only takes about 8k tokens per request, so cut things down
const MAX_LOG_CHARS = 8000;
const MAX_DIFF_CHARS = 3000;
const MAX_SOURCE_CHARS = 14000;

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

// source files the agent gets to see (and is allowed to change):
// non-test files under src/ that the PR changed, plus any src/ file named in the log
function pickSourceFiles(log) {
  const files = [];

  const changed = run(`git diff --name-only origin/${BASE_REF}...HEAD -- src`).split('\n');
  for (const file of changed) {
    if (isEditableSource(file) && !files.includes(file)) {
      files.push(file);
    }
  }

  const mentioned = log.match(/src\/[\w./-]+\.ts/g) || [];
  for (const file of mentioned) {
    if (isEditableSource(file) && !files.includes(file)) {
      files.push(file);
    }
  }

  return files;
}

function buildPrompt(log, diff, files) {
  let sources = '';
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (sources.length + content.length > MAX_SOURCE_CHARS) {
      console.log('auto-heal: skipping ' + file + ' (too big for the request)');
      continue;
    }
    sources += `\n--- ${file} ---\n${content}\n`;
  }

  return [
    INSTRUCTION,
    '',
    'Rules:',
    '- Only change the source files given below. Never change tests or test assertions.',
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
    '=== Source files ===',
    sources,
  ].join('\n');
}

async function askModel(prompt) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a CI repair agent for a TypeScript, Express and Mongoose backend. ' +
            'You fix bugs in source code and never edit tests.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    fail(`model request failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  let text = data.choices[0].message.content.trim();

  // just in case the model wraps the JSON in a code fence anyway
  if (text.startsWith('```')) {
    text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }
  return JSON.parse(text);
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
  if (!TOKEN) {
    fail('GITHUB_TOKEN is not set');
  }
  if (!existsSync(LOG_PATH)) {
    fail('no test log found at ' + LOG_PATH);
  }

  const log = trimLog(readFileSync(LOG_PATH, 'utf8'));
  const files = pickSourceFiles(log);
  if (files.length === 0) {
    fail('could not find any source files in src/ related to the failure');
  }
  console.log('auto-heal: source files sent to the model: ' + files.join(', '));

  let diff = run(`git diff origin/${BASE_REF}...HEAD -- src ':!**/__tests__/**'`);
  if (diff.length > MAX_DIFF_CHARS) {
    diff = diff.slice(0, MAX_DIFF_CHARS) + '\n... (diff cut off)';
  }

  const answer = await askModel(buildPrompt(log, diff, files));
  console.log('auto-heal: diagnosis: ' + answer.diagnosis);

  const changedFiles = applyEdits(answer.edits, files);

  const summary = [
    '## Auto-heal summary',
    '',
    'This PR was opened automatically by the `auto-fix` job after the Jest tests failed on `' +
      (process.env.HEAD_REF || 'this branch') +
      '`.',
    '',
    `**Model:** ${MODEL}`,
    '',
    '**Diagnosis:** ' + answer.diagnosis,
    '',
    '**Files changed:** ' + changedFiles.map((f) => '`' + f + '`').join(', '),
  ].join('\n');
  writeFileSync(SUMMARY_PATH, summary + '\n');
}

main().catch((err) => fail(err.stack || String(err)));
