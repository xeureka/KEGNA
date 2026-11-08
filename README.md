# ZOLA inventory

ZOLA is a single-site beer warehouse inventory system. The web dashboard is
for administrators and storekeepers. The Expo mobile app is for salespeople
and accountants.

## Stack and prerequisites

- Node.js 20+
- pnpm 11+
- PostgreSQL
- Hono, Drizzle, Better Auth, OpenAPI/Scalar
- React/Vite web dashboard
- Expo SDK 57 mobile app

Install dependencies with pnpm:

```bash
pnpm install
```

## Environment

Copy the three examples and fill in local values:

```bash
cp apps/back-end/.env.example apps/back-end/.env
cp apps/front-end/.env.example apps/front-end/.env
cp apps/mobile/.env.example apps/mobile/.env
```

The back-end requires `DATABASE_URL` and a random `BETTER_AUTH_SECRET` of at
least 32 characters. Set `SEED_PASSWORD` for development users; do not commit
real environment files or secrets. The mobile LAN URL should point to the
computer's reachable address, for example `http://192.168.1.10:3001`.

## Run locally

One-time database setup:

```bash
pnpm --filter zola-back-end db:migrate
SEED_PASSWORD='your-local-development-password' pnpm --filter zola-back-end seed
```

Start each app in its own terminal:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```

The API listens on `http://localhost:3001`, the web app on Vite's displayed
port, Scalar is at `/docs`, and the OpenAPI document is `/openapi.json`.

If port 3001 is stale or already occupied, stop the old API process or use:

```bash
PORT=3011 pnpm dev:api
```

For Expo Go on a physical phone, use the computer LAN IP in
`apps/mobile/.env`. Android emulators use `http://10.0.2.2:3001`; iOS
simulators use `http://localhost:3001`. The phone and computer must share a
network and port 3001 must be reachable.

## Seeded development users

The seeded users are `admin@zola.local`, `storekeeper@zola.local`,
`sales.one@zola.local`, `sales.two@zola.local`, and `accountant@zola.local`.
All use the value supplied through `SEED_PASSWORD`. Local credentials are kept
in the ignored `credentials.md` file.

Reset the disposable local database and seed it again:

```bash
pnpm --filter zola-back-end db:reset
```

## Checks and smoke test

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter zola-back-end smoke
```

The smoke test requires the API to be running, refuses production mode, and
does not reset the database. Run `db:reset` before it when a clean database is
required.

Mobile checks:

```bash
EXPO_OFFLINE=1 CI=1 pnpm --filter mobile exec expo export --platform android --output-dir /tmp/zola-export-check
pnpm dlx expo-doctor
```
