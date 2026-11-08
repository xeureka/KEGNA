# ZOLA backend architecture guide

Keep the API single-site and preserve the existing Hono, OpenAPI, routes,
services, repositories, middleware, error, logger, response, and Better Auth
patterns.

Routes validate input with the established OpenAPI schemas, enforce the
central permission map, call services, and return the shared response
envelope. Services own transactions and business rules. Repositories own
database access. Expected domain failures use `AppError`; unexpected failures
are logged centrally and do not expose implementation details.

Inventory ledger rows and verification rows are append-only. State-changing
operations use transactions and record the required audit and thread events.
Money arithmetic is performed in integer cents before conversion at the API
boundary. Never log credentials, tokens, connection strings, or raw secrets.
