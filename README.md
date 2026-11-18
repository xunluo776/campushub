# CampusHub

A full-stack app for booking campus resources (study rooms, labs and equipment) by time slot. The backend is Node.js, Express and MongoDB in TypeScript. The frontend is React and Vite. Both sides use one typed contract taken from [`docs/openapi.yaml`](docs/openapi.yaml).

## Features

- Browse resources (`ROOM`, `EQUIPMENT`, `LAB`) and book a time window.
- **No double booking.** A new reservation that overlaps an active one on the same resource is rejected with `409 DOUBLE_BOOKING`. Booking requests for the same resource are handled one at a time, so two overlapping requests can't both get through.
- **Reservation lifecycle:** `PENDING` → `CONFIRMED` or `CANCELLED`. Invalid transitions are rejected with `409`.
- **Strict date validation:** ISO 8601 date-times are range-checked field by field, so Feb 30, `24:00` and bad UTC offsets are rejected instead of rolling over.
- List a user's reservations.

## API

Base URL `/api/v1`. The full spec is in [`docs/openapi.yaml`](docs/openapi.yaml).

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/resources` | List all resources |
| POST | `/reservations` | Create a reservation |
| GET | `/reservations/user/{userId}` | List a user's reservations |
| PATCH | `/reservations/{id}/confirm` | Confirm a reservation |
| PATCH | `/reservations/{id}/cancel` | Cancel a reservation |

## Architecture

```
client/ (React + Vite + Tailwind)
   │  /api/v1 (Vite dev proxy, so no CORS needed)
   ▼
routes → controllers → services → models (Mongoose) → MongoDB
                         │
              domain errors → central error handler → HTTP status + ErrorResponse
```

- **Layered backend.** Routes only map paths, controllers only read the request and send the response, all business logic lives in services, and only services touch models.
- **One place for errors.** Services throw typed domain errors (`ValidationError`, `NotFoundError`, `DoubleBookingError`, `StatusTransitionError`). A single middleware maps them to `400`, `404` and `409`.
- **Shared types.** `shared/types.ts` mirrors the OpenAPI contract and is used by both the backend and the client.

## Testing and CI

- Jest unit tests for services and Supertest HTTP tests for routes, all against an in-memory MongoDB.
- Tests cover edge cases: back-to-back vs. 1 ms overlaps, impossible dates, missing or wrongly typed fields and concurrent requests.
- A coverage gate of **80% statements and branches** for services and controllers is enforced in `jest.config.ts`.
- **GitHub Actions** runs lint and tests on every push and pull request to `main`.
- **Auto-heal job:** when Jest fails on a pull request, a script sends the failure log, the PR diff and the related source files to Gemini, then applies the returned patch to non-test files under `src/`. It reruns lint and tests, and opens a fix PR only if both pass.

## Run locally

Requires Node.js and Docker.

```bash
docker compose up -d          # local MongoDB
cp .env-example .env
npm install
npm run seed                  # sample resources
npm run dev                   # API on http://localhost:3000

cd client
cp .env-example .env
npm install
npm run dev                   # UI (Vite dev server)
```

## Tech stack

TypeScript (strict) · Node.js · Express 5 · MongoDB / Mongoose · React 19 · Vite · Tailwind CSS · Axios · Jest · Supertest · GitHub Actions · Gemini API
