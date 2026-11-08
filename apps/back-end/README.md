# ZOLA back-end

The Hono API runs on port 3001 by default and serves the inventory API under
`/api`, Scalar at `/docs`, and OpenAPI JSON at `/openapi.json`.

```bash
pnpm --filter zola-back-end db:migrate
pnpm --filter zola-back-end seed
pnpm --filter zola-back-end dev
```

Required environment values are documented in `.env.example`. Keep the real
`.env` file local and never commit `DATABASE_URL`, `BETTER_AUTH_SECRET`, or
`SEED_PASSWORD`. The seed password is supplied by `SEED_PASSWORD`.

To recreate the disposable development database:

```bash
pnpm --filter zola-back-end db:reset
```

If port 3001 is already occupied, stop the old development process or use a
different port for the new process:

```bash
PORT=3011 pnpm --filter zola-back-end dev
```
