# Beer Warehouse Inventory — Phase 0 Assessment

Assessment date: 2026-11-08  
Repository: `/home/eureka/Desktop/Code/KEGNA/KEGNA`

This document records the repository state before implementation changes. No application source, configuration, schema, migration, or dependency files were changed for Phase 0.

## Decisions

Approved decisions for Phases 1–2:

1. **Database:** use the existing `DATABASE_URL` loaded from `apps/back-end/.env` (or the app's existing dotenv resolution). The database is empty and no data migration is required. Replace the old migration history with one fresh baseline containing Better Auth and inventory tables only. Never print, log, commit, or expose the connection string or other secrets; keep `.env` gitignored.
2. **Login:** email and password only. Remove phone/OTP login, OTP-only code, and OTP environment variables. Redis is removed only if it is found to be OTP-only.
3. **Roles:** remove the custom tenant-membership approach because the assessment found no Better Auth organization plugin. Use Better Auth's admin plugin with a role stored on the Better Auth user, retaining the role names `admin`, `storekeeper`, `sales`, and `accountant`. Keep the permission map centralized in one module. This is the least invasive single-tenant strategy for the actual repository: there is no organization plugin/table contract to preserve, and the existing custom membership/RBAC layer exists only to support the removed tenant model.
4. **Bank slips:** no backend storage implementation was found. Phase 2 keeps storage out of the schema; the later files phase will add a small local-disk storage interface, authenticated image reads, size limits, and client compression, with an R2-compatible adapter boundary.
5. **Push:** do not build new push infrastructure. Use polling for chat. Existing native push registration was not found, so push is deferred and will be recorded as follow-up unless a cheap existing path is discovered later.
6. **Product name:** `ZOLA`. Rename package names, app identity, titles, OpenAPI metadata, README and seed copy during the relevant implementation phases, and remove Nexa references.
7. **Issue lifetime:** issues may span multiple days. One issue is one load-out with one report and remains open until its report is submitted; there is no daily issue limit.

## 1. Decision table

### Back-end

| Path / item | What it does | Verdict |
|---|---|---|
| `apps/back-end/src/index.ts`, `src/app.ts`, `src/routes/index.ts` | Hono/Node bootstrap, middleware registration, auth handler, route mounting, request limits, CORS, rate limiting, logger and error handling. | KEEP, then MODIFY tenant-specific branches |
| `apps/back-end/src/routes/v1/index.ts` | Registers the OpenAPI v1 routes and currently wraps most routes in `requireTenantAuth`. | MODIFY to remove tenant router and register inventory routes |
| `apps/back-end/src/routes/v1/*` | Existing appointment, patient, doctor, dental chart, billing, payment, card, mobile, tips, report and admin endpoints. | REMOVE old domain routes; KEEP/MODIFY audit and user-management patterns |
| `apps/back-end/src/routes/auth.ts` | Custom registration, login, OTP, tenant onboarding, session and current-user endpoints. | MODIFY to retain login/session/current-user and replace tenant/OTP onboarding paths |
| `apps/back-end/src/services/*` | Layered business logic for auth, tenant, dental/CRM, Chapa, OTP, billing, reports, dashboard and audit. | KEEP generic auth/audit patterns; REMOVE dental/CRM, tenant, OTP and payment services; BUILD inventory services |
| `apps/back-end/src/repositories/*` | Data access layer for old domain aggregates, tenant/RBAC, users and audit. | KEEP layered convention, user/audit patterns; REMOVE old domain/tenant repositories; MODIFY RBAC; BUILD inventory repositories |
| `apps/back-end/src/middlewares/error-handler.ts`, `logger.ts`, `cors-middleware.ts`, `session.middleware.ts`, `require-auth.middleware.ts` | Shared errors, structured logging, CORS, Better Auth session hydration and authentication guard. | KEEP; MODIFY CORS/origin names and auth context as needed |
| `apps/back-end/src/middlewares/tenant-auth.middleware.ts` | Resolves active tenant from session/membership, validates membership, sets RLS context and permissions. | REMOVE or replace with single-tenant authenticated-role middleware |
| `apps/back-end/src/db/request-context.ts` | Async-local transaction database context used to keep RLS queries inside request transactions. | REMOVE after RLS removal unless a generic transaction context is still needed |
| `apps/back-end/src/db/index.ts` | Postgres/Drizzle connection and transaction-aware database access. | KEEP; remove RLS-specific comments/behavior only if no longer needed |
| `apps/back-end/src/lib/auth.ts` | Better Auth Drizzle adapter, bearer/Expo/phone plugins, email-password auth, trusted origins and field mappings. | MODIFY carefully; keep Better Auth and Expo support |
| `apps/back-end/src/lib/env.ts` | Zod environment validation and Chapa/SMS configuration resolution. | MODIFY to remove Chapa/OTP/white-label/tenant variables and retain database/auth/logging/storage variables |
| `apps/back-end/src/lib/errors/*`, `src/lib/logger/*`, `src/utils/api-response.ts`, `src/types/hono.ts` | Core errors, error codes, logger serializers, response envelope and Hono context types. | KEEP; MODIFY context types to remove tenant fields and add the inventory role model |
| `apps/back-end/src/docs/openapi-config.ts`, `src/docs/scaler-handler.ts` | OpenAPI document setup and Scalar UI. | KEEP; MODIFY metadata/title and route inventory |
| `apps/back-end/src/db/schema/auth-schema.ts` | Separate Better Auth-style `user`, `session`, `account`, `verification` schema definitions. | KEEP only if this is the active schema; reconcile with the duplicate active schema before reset |
| `apps/back-end/src/db/schema.ts` | Active exported Drizzle schema containing Better Auth-compatible tables plus tenants, memberships, RBAC, dental/CRM, payments, audit and notifications. | MODIFY heavily: keep Better Auth tables and reusable audit/notification pieces; replace old domain schema with inventory schema |
| `apps/back-end/src/db/schema/tenant.ts` | Tenant-related schema module. | REMOVE with tenant downgrade |
| `apps/back-end/src/db/schema/index.ts` | Re-exports `src/db/schema.ts`, making that file the Drizzle schema configured in `drizzle.config.ts`. | KEEP; point it at the clean baseline schema if structure changes |
| `apps/back-end/drizzle.config.ts` | Drizzle Kit PostgreSQL schema/output configuration. | KEEP; MODIFY migration/output baseline only if required |
| `apps/back-end/src/db/seed.ts` | Large tenant/dental/CRM/payment seed and destructive development reset behavior, including RLS context setup. | MODIFY into idempotent inventory seed; do not assume destructive reset until data is confirmed disposable |
| `apps/back-end/src/db/migrate-*.ts`, `src/db/payment-migration.ts`, `src/db/push-schema.ts`, verification scripts | Legacy onboarding, roles, Chapa/payment, push-schema and RLS migration utilities. | REMOVE obsolete scripts; BUILD one clean migration/baseline and retain only useful generic checks |
| `apps/back-end/src/repositories/audit-log.repository.ts`, `src/services/audit.service.ts`, `src/routes/v1/audit-logs.ts` | Append/read audit records and expose audit-log API. | MODIFY to remove tenant columns/scope assumptions and record inventory state changes |
| `apps/back-end/src/db/schema.ts` notification table and `src/routes/v1/mobile.ts` notification endpoints | In-app user notifications scoped by tenant. | MODIFY to single-tenant notifications; no confirmed native push-token implementation found |
| `apps/back-end/src/utils/permission.ts` | Reads permissions from Hono context and throws a standard 403. | KEEP concept; MODIFY to use one centralized inventory permission map and non-tenant role context |
| `apps/back-end/src/repositories/rbac.repository.ts`, RBAC tables in `schema.ts` | Stores roles, permissions and role-permission assignments, currently connected to tenant memberships. | MODIFY/reuse if retaining custom RBAC; otherwise replace with a single user-role strategy after decision |

### Better Auth and authentication surfaces

| Path / item | What it does | Verdict |
|---|---|---|
| `apps/back-end/src/lib/auth.ts` | Active Better Auth configuration. | MODIFY, preserve core |
| `apps/front-end/src/lib/auth.ts` | Browser session cache, custom API login/logout/me hydration and permission helpers. | MODIFY, remove tenant fields and rename session storage key |
| `apps/mobile/src/api/auth-client.ts` | Better Auth Expo client using SecureStore-backed storage, Expo scheme and phone-number client plugin. | MODIFY, keep Better Auth Expo client; remove tenant headers and phone OTP if login decision permits |
| `apps/mobile/src/api/client.ts` | Authenticated mobile API client, bearer token persistence, custom OTP flow, request timeout and API envelope handling. | MODIFY, keep request/token/storage foundation; remove tenant and OTP/payment behavior |
| `apps/back-end/src/services/auth.service.ts`, `src/routes/auth.ts` | Custom email/password, phone OTP, tenant registration and membership/session assembly. | MODIFY substantially; keep existing login/session behavior where compatible |

### Web

| Path / item | What it does | Verdict |
|---|---|---|
| `apps/front-end/src/components/layout/AppShell.tsx` | Dashboard shell, sidebar, role-dependent navigation and user menu. | KEEP shell; MODIFY labels, nav entries and role names |
| `apps/front-end/src/components/ui/*` | Existing theme-compatible buttons, cards, fields, modal, page, table, pagination and stat components. | KEEP and reuse |
| `apps/front-end/src/router.ts`, `src/routes/*` | TanStack Router setup and authenticated route tree. | KEEP router pattern; REMOVE old routes; BUILD inventory routes and role gates |
| `apps/front-end/src/lib/api.ts`, `src/lib/query.ts`, `src/lib/env.ts` | API envelope client, uploads, query client and frontend environment handling. | KEEP; MODIFY path/session/tenant handling; reuse upload helper if backend storage is confirmed |
| `apps/front-end/src/features/auth/*` | Login page and auth entry flow. | MODIFY to the chosen identifier and single-app login |
| `apps/front-end/src/features/staff/*`, user routes | Existing staff/user management with roles and permissions. | MODIFY into admin user management |
| `apps/front-end/src/features/audit-logs/*` | Audit-log page. | MODIFY and reuse |
| `apps/front-end/src/features/dashboard/*` | Existing role-aware CRM dashboard widgets. | MODIFY into warehouse overview |
| `apps/front-end/src/features/appointments`, `calendar`, `doctors`, `patients`, `medical-records`, `billing`, `payments`, `tips`, `super-admin`, related routes/components | Dental/CRM and payment UI. | REMOVE |
| `apps/front-end/src/styles/index.css`, `src/lib/*`, shared types/status helpers | Theme tokens and reusable frontend helpers. | KEEP selectively; MODIFY names/role/status types |
| `apps/front-end/index.html`, `public/*`, `README.md`, package metadata | Browser title/assets/documentation/package identity. | MODIFY to the confirmed product name; avoid new colors/shadows |

### Mobile

| Path / item | What it does | Verdict |
|---|---|---|
| `apps/mobile/App.tsx`, `src/AppRoot.tsx` | Expo app root and existing providers/auth/navigation composition. | KEEP foundation; MODIFY providers for inventory |
| `apps/mobile/app.config.ts`, `app.json`, `eas.json` | Expo build/app identity, scheme, bundle ID, icons and EAS metadata. | MODIFY to one fixed app config; remove build-time tenant/white-label logic |
| `apps/mobile/config/tenant.config.ts`, `src/config/tenant.ts`, `src/config/runtime.ts` | Tenant identity, branding/content, tenant headers and tenant-derived storage keys/API configuration. | REMOVE tenant model; MODIFY runtime API URL/storage key logic into single-app config |
| `apps/mobile/src/api/auth-client.ts`, `src/api/client.ts`, `src/api/storage.ts` | Better Auth Expo client, authenticated API client and SecureStore/browser persistence. | KEEP foundation; MODIFY endpoint/auth/header behavior |
| `apps/mobile/src/navigation/*` | React Navigation stack, tabs and route definitions for the old patient flow. | KEEP navigation library/setup; REMOVE old route graph and BUILD chat-list/conversation/profile graph |
| `apps/mobile/src/components/*`, `src/constants/colors.ts`, `src/styles/*` | Existing small UI components, theme values and styles. | KEEP/reuse existing tokens; BUILD only the requested Telegram-style composition without new palette/shadows |
| `apps/mobile/src/screens/auth/*` | Welcome/register/OTP/profile-completion/terms/login screens. | MODIFY auth screens; remove OTP/register screens if not used by final login strategy |
| `apps/mobile/src/screens/appointments`, `card`, `home`, `payments`, `services`, old profile history/support screens | Patient appointments, membership card, Chapa payments, dental services and old home/profile UI. | REMOVE |
| `apps/mobile/src/context/*`, notification APIs/components | Appointment, payment, tenant, language, avatar and in-app notification state. | REMOVE old domain contexts; KEEP/adapt notification foundation if useful; BUILD inventory/thread state |
| New chat components and screens from section 10 | Telegram-style issue list, event timeline, report/deposit sheets, reconciliation, profile and wrong-role screen. | BUILD |

### Infrastructure and repository-level files

| Path / item | What it does | Verdict |
|---|---|---|
| `package.json`, workspace files and lockfiles | pnpm workspace scripts and dependency locks. | MODIFY scripts/package names only after app changes; keep pnpm and lockfiles |
| `apps/mobile/package-lock.json` | npm lockfile in the mobile app despite the repository rule. | REMOVE as an obsolete package-manager artifact after confirming no workflow depends on it |
| `README.md`, app READMEs, `project-impl.md`, `SRS.md` | Repository/product documentation. `SRS.md` and `project-impl.md` are currently untracked user files. | MODIFY relevant docs; preserve untracked user files unless explicitly superseded |
| Docker/Compose, CI, deployment and monitoring files | No Docker Compose, CI workflow, deployment manifest, Redis, Prometheus or Grafana file was found in the repository file inventory. | VERIFY outside this repo/deployment configuration; no removal can be safely performed from this checkout |

## 2. Exact Better Auth setup

The active server configuration is `apps/back-end/src/lib/auth.ts` and uses the Drizzle adapter against the exported tables `users`, `accounts`, `sessions`, and `verifications` from `apps/back-end/src/db/schema.ts`.

- Core authentication: Better Auth email/password is enabled.
- Plugins: `bearer()`, `expo()`, and `phoneNumber(...)`.
- Phone plugin behavior: six-digit OTP, SMS Ethiopia sender, temporary mobile email/name generation, and custom user field mappings (`phoneNumber` → `phone`, `phoneNumberVerified` → `phoneVerified`).
- Expo support: server `expo()` plugin plus trusted Expo/deep-link origins; mobile uses `expoClient(...)` with SecureStore-backed storage.
- Session strategy: Better Auth database-backed sessions. The custom API also returns a session token and clients send it as a bearer token; web additionally keeps a local session cache and mobile persists its token.
- Role storage: not in Better Auth's user record and no Better Auth admin/organization plugin is configured. Roles and permissions are custom tables (`roles`, `permissions`, `role_permissions`) and are resolved through `tenant_memberships` by `tenant-auth.middleware.ts`. The user table has `isSuperAdmin`, but ordinary role checks use the custom membership/RBAC path.
- Organization support: no Better Auth organization plugin is configured. Multi-tenancy is implemented by custom tenant tables, session tenant binding, tenant headers, and PostgreSQL RLS.

Assessment decision: because roles currently depend on custom membership/RBAC and not on Better Auth's organization plugin, the least invasive downgrade is to preserve the custom role/permission concepts while removing tenant membership and resolving one role directly for each user. This must be implemented only after confirming the existing database/data decision. A direct Better Auth admin-plugin migration is not justified by the current setup.

## 3. Reusable pieces found

- Layered Hono/OpenAPI structure: routes, services, repositories, shared middleware, response envelopes, error classes and Scalar documentation.
- Better Auth web and Expo client integration, including session persistence and bearer-token support.
- Frontend API client has a generic `upload(path, file)` helper, but no matching backend file/storage endpoint or provider implementation was found.
- Audit logging exists in `audit_logs`, `audit-log.repository.ts`, `audit.service.ts`, and an audit-log route/page. It is tenant-bound today and needs single-tenant changes.
- In-app notifications exist in the database schema and mobile API/context/screens. No `expo-notifications` dependency, push-token table, or native push registration implementation was found.
- `utils/permission.ts` and custom RBAC repositories/tables provide a permission-checking pattern, but the current context is tenant-derived and role names are dental/CRM-specific.
- Web data tables, forms, modals, stat cards, layout/shell, TanStack Query and TanStack file-based routing are reusable.
- Mobile SecureStore storage, image-picker dependency, API timeout/envelope handling and React Navigation are reusable foundations.

## 4. Risks and questions requiring confirmation

These are blockers for the destructive portions of the requested downgrade. Phase 1 must not begin until they are answered.

1. **Existing database data is unknown.** The requested schema reset deletes the current tenant, dental/CRM, billing, card and payment schema. Confirm whether the database is disposable. If any data must be preserved, stop the reset and define a migration/export plan.
2. **The active schema has duplicate Better Auth definitions.** `schema.ts` defines plural tables (`users`, `sessions`, etc.) used by `lib/auth.ts`, while `schema/auth-schema.ts` defines singular Better Auth tables. Confirm which database tables actually exist before generating a baseline; do not silently change auth table names.
3. **Login identifier is not settled.** The current web flow is email/password, while mobile prominently uses phone OTP. Confirm whether inventory users log in by email/password, phone/password, or retain OTP. The brief says to follow the current auth flow but also lists OTP as out of scope.
4. **Role migration is ambiguous.** Current roles are custom membership/RBAC roles and include dental roles. Confirm whether to retain the custom RBAC tables with a direct `user_role` mapping or introduce a simpler user-role field during the baseline reset.
5. **Bank-slip storage is not implemented end-to-end.** The web client has an upload helper, but no backend upload route/provider was found. Choose existing object storage, a local volume, or a new object-storage adapter and define authenticated/signed reads and size/type limits.
6. **Push notifications are not implemented natively.** Existing notifications are in-app only. Confirm whether MVP may use polling/in-app events only, or provide the Expo push-token/provider requirements before promising push behavior.
7. **Deployment/CI scope is incomplete.** No Docker Compose, CI, deployment, Redis, Prometheus or Grafana files were found in this checkout. Confirm whether those live outside the repository and must be changed separately.
8. **Product identity is open.** The brief proposes `ZOLA`; confirm the final product name, app slug, Expo scheme, bundle/package identifier, OpenAPI title and visible copy before the rename sweep.
9. **Operational flow decisions remain open.** Confirm whether an issue can span multiple days and whether the one-report-per-issue assumption is acceptable. Also confirm whether the default existing theme tokens are the complete mobile visual direction.
10. **Untracked user files exist.** `SRS.md` and `project-impl.md` are untracked in Git. They were not modified and should be reviewed before any cleanup or rename operation.

## 5. Phase 0 result

`ASSESSMENT.md` is complete. Implementation is intentionally paused here because the schema reset and authentication/storage choices carry data-loss and product-behavior risk. After confirmation of the risks above—especially database preservation, login identifier, role strategy, storage, push scope, and product name—the next action can be Phase 1.
