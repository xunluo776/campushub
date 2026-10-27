# CampusHub Client

React + TypeScript + Vite frontend for the CampusHub reservation API.

## Running it

The backend has to be running first (from the repo root):

```
docker compose up -d
npm run seed
npm run dev
```

Then in `client/`:

```
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api` requests to the backend on
port 3000, so the backend doesn't need CORS. To point it somewhere else, copy
`.env-example` to `.env` and change `API_PROXY_TARGET`.

## Layout

- `src/api/campushubApi.ts` typed API calls, matching `docs/openapi.yaml`
- `src/components/ResourceList.tsx` resource cards with a type filter
- `src/components/BookingForm.tsx` start/end time form with validation
- `src/components/UserReservations.tsx` the student's active bookings with cancel
- `src/components/ErrorBanner.tsx` shared error alert

There's no login yet, so the student id is typed into the "Signed in as" box in the header.
