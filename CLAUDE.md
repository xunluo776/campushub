# CLAUDE.md — CampusHub Backend

Context rules for any AI agent working in this repository. These are constraints, not
suggestions. If generated code violates a rule here, that code is wrong and must be
fixed before it is considered done.

## Project

CampusHub is a multi-tenant campus resource management backend. Every resource belongs
to a tenant (a campus/organization), so tenant scoping is part of the data model and
must never be assumed to be global.

Runtime: Node.js + TypeScript. Web layer: Express. Database: MongoDB via Mongoose.

## 1. Tech Stack & Libraries

Authorized dependencies:

- `typescript`, `ts-node`, `@types/node` (dev)
- `eslint`, `prettier`, `typescript-eslint`, `@eslint/js` (dev)
- `express` and `@types/express`
- `mongoose`
- `dotenv`

TypeScript is pinned to `^5.9`. Do not bump it to 7.x — `ts-node` cannot load the 7.x
compiler API, which breaks `npm run dev`.

Rules:

- All source files are `.ts`. Do not create `.js` or `.mjs` files anywhere under `src/`.
  Compiled JavaScript belongs in `dist/` and is produced by `tsc`, never written by hand.
- Do not install or import any package that is not in the list above. If a task seems to
  need a new dependency, stop and say so instead of adding it.
- Do not reach for a second framework (no Nest, no Fastify, no Koa) and do not use a
  different ODM or a raw MongoDB driver. Mongoose only.
- No new runtime dependency for something the standard library or an authorized package
  already does.

## 2. Architectural Boundaries

Strict three-tier separation, plus models. Each layer only does its own job.

```
src/
├── app.ts            Express app wiring: middleware, route mounting, export
├── server.ts         Entry point: env loading, DB connect, listen
├── config/           Env parsing and DB connection setup
├── routes/           Route definitions and middleware mapping only
├── controllers/      Request/response handling and status codes only
├── services/         Pure business logic
├── models/           Mongoose schemas and interface definitions only
├── middleware/       Cross-cutting Express middleware (errors, auth, tenant scoping)
└── types/            Shared interfaces and type declarations
```

- **Routes** map a path and HTTP method to a controller function, and attach middleware.
  No business logic, no database calls, no inline handler bodies. A route file should be
  readable as a table of endpoints.
- **Controllers** read the request, call a service, and send the response with the right
  status code. Controllers must not query the database and must not import anything from
  `models/` for querying. They may import types.
- **Services** hold the business logic and are the only layer allowed to talk to models.
  Services must not touch `req` or `res` and must not know about HTTP status codes. They
  return data or throw.
- **Models** define Mongoose schemas and the matching TypeScript interfaces. No queries,
  no business rules, no request handling.

Import direction is one way: routes → controllers → services → models. Never the reverse.

## 3. Coding Standards & Safety

- TypeScript runs in `strict` mode. Do not weaken compiler options to make code compile.
- The `any` type is banned. That includes `any[]`, `as any`, and implicit `any` from an
  untyped parameter. Use a real interface, a union, a generic, or `unknown` with a
  narrowing check.
- Every exported function needs explicit parameter types and an explicit return type.
  Async functions return `Promise<T>` with a real `T`.
- Every Mongoose schema has a matching exported interface. The schema and the interface
  must agree on field names and optionality.
- Every `async` call is either awaited or explicitly handled. No floating promises.
- Express route handlers wrap async work so rejections reach the error middleware. Do not
  leave an `async` handler whose rejection would go unhandled.
- There is one central error-handling middleware and it is registered last. Controllers
  pass errors to `next(err)` rather than swallowing them.
- No secrets, connection strings, or ports hardcoded in source. Read them from `process.env`
  through `src/config/`, and add any new variable to `.env-example`.
- No `console.log` left in committed code paths other than startup and error logging.

## 4. Git & Commit Formatting

- Commit messages are one short imperative line (e.g. `add health-check endpoint`). No
  padding, no generated-by or co-author trailers.
- When you finish a change, give a short diff/PR description that says what was built and
  which rules in this file shaped it — for example, why logic went into a service instead
  of the controller. Two or three sentences, not a changelog.
- Never commit `.env`, `node_modules/`, or `dist/`. `.env-example` is committed and holds
  placeholder values only.
- Do not commit or push unless you are asked to.

## 5. Working Rules

- If a request conflicts with anything above, say so and propose a compliant version
  instead of quietly bending the rule.
- Keep changes scoped to what was asked. Do not refactor unrelated files or add features
  that were not requested.
- Prefer plain, readable code over clever code.
