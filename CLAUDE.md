# CampusHub agent rules

Rules for any AI agent working in this repo. These are constraints, not suggestions:
code that breaks one is wrong and has to be fixed before it counts as done.

CampusHub is a campus resource reservation app. Backend: Node.js + TypeScript + Express +
MongoDB (Mongoose) in `src/`. Frontend: React + TypeScript + Vite in `client/`. API
contract: `docs/openapi.yaml`.

## 1. Context

- **Follow `.ignore`.** Never read, search, open or edit anything it matches
  (dependencies, build output, lockfiles, logs, source maps, `.env`). If a task really
  needs one of those files, ask first.
- Work from source: `src/`, `shared/`, `client/src/`, `docs/openapi.yaml`. Read a file
  when the task needs it, don't scan the whole repo up front.

## 2. Layout

```
shared/types.ts       Contract types from docs/openapi.yaml, used by backend AND client
src/                  Backend
├── app.ts            Middleware, route mounting, error handler last
├── server.ts         Entry point: DB connect, listen
├── config/           Env parsing (dotenv) and DB connection
├── routes/           Path + method -> controller. No logic.
├── controllers/      Read req, call a service, send status + JSON. No try/catch.
├── services/         Business logic, the only layer that uses models. errors.ts lives here.
├── models/           Mongoose schemas + matching interfaces. No queries.
├── middleware/       errorHandler.ts (central error -> HTTP mapping)
├── scripts/          Dev-only (seed). Never imported by the app.
└── types/            Backend-only types (health)
client/src/
├── api/campushubApi.ts   The only file that makes HTTP calls. Re-exports shared types.
├── hooks/            Custom hooks that own fetching + loading/error state
└── components/       Rendering only, one component per file
```

Import direction is one way: routes → controllers → services → models. Contract types
come from `shared/types.ts` only. Never redefine `Resource`, `Reservation`, etc. somewhere
else. If the contract changes, update `docs/openapi.yaml` and `shared/types.ts` together.

## 3. Backend rules

- Services throw the classes in `services/errors.ts` (all extend `DomainError`), never
  HTTP status codes, and never touch `req`/`res`.
- `middleware/errorHandler.ts` is the only place that maps errors to responses:
  `ValidationError` 400, `NotFoundError` 404, `DoubleBookingError` and
  `StatusTransitionError` 409, anything else 500. Every error body is `ErrorResponse`.
- Controllers have no try/catch. Express 5 forwards a rejected async handler to the error
  middleware. A new error type means a new `DomainError` subclass plus one line in
  `statusForDomainError()`, not a catch block in a controller.
- Config comes from `process.env` through `src/config/`. New variables go in
  `.env-example`. No hardcoded ports, URIs or secrets.

## 4. Frontend rules

- Functional components only, each with an explicit `Props` interface.
- Data fetching and async state live in custom hooks in `hooks/` (`useResources`,
  `useReservations`, `useCreateReservation`). Components call hooks and render, they
  don't call the API directly.
- Every async workflow has `isLoading` and `error`. Loading always ends in `finally`.
  Errors go through `getErrorMessage()` and show in `ErrorBanner`. A 409
  `DOUBLE_BOOKING` shows "This resource is already reserved for the selected time window."
- `datetime-local` values have no timezone: send `new Date(value).toISOString()`.
- Styling: Tailwind utility classes only, no inline `style` and no CSS files besides
  `index.css`. Keep the card/button/banner styles consistent.
- Requests use the relative `/api/v1` base URL. The Vite dev server proxies it to the
  backend (`API_PROXY_TARGET` in `client/.env-example`), so the backend needs no CORS.

## 5. Both sides

- TypeScript `strict` everywhere. `any` is banned (`any[]`, `as any`, untyped params).
  Use real types or `unknown` plus a check.
- Exported functions, hooks and components have explicit return types.
- Dependencies: only what's already in the two `package.json` files (backend: express,
  mongoose, dotenv; client: react, axios, tailwindcss). Ask before adding anything. Keep
  backend TypeScript on `^5.9`, since `ts-node` can't load 7.x.
- Plain, readable code over clever code. Keep files small: split a component that goes
  past ~150 lines, and pull logic used twice into a helper or hook.
- Keep changes scoped to the task. If a request conflicts with these rules, say so and
  propose a version that fits.

## 6. Git

- Never commit `.env`, `node_modules/` or `dist/`.
- Don't commit or push unless asked. Commit messages are one short line, with no
  co-author or generated-by trailers.
