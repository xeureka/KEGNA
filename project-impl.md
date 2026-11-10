# Beer Warehouse Inventory: Implementation and Downgrade Plan

Agent brief for converting the existing multi-tenant monorepo into a single-tenant beer warehouse inventory system.

- **Package manager:** pnpm (workspaces). Never use npm or yarn.
- **Apps:** `apps/front-end` (web), `apps/back-end` (Hono API), `apps/mobile` (Expo).
- **Principle:** keep the core. Lean the project down and add inventory on top. Do not re-implement anything that already exists.

---

## 0. Rules for the Agent

1. **Assess first.** Do not modify anything until Phase 0 is finished and `ASSESSMENT.md` is written.
2. **Keep the core untouched:** Hono app structure, layered `routes / services / repositories`, middlewares, logger, error handling, env validation, API response helpers, OpenAPI/Scalar docs, and Better Auth setup on both web and Expo.
3. **Reuse before building.** If something exists (file upload, notifications, audit log, permission helpers, data tables, forms, layouts), modify it instead of creating a new one.
4. **Database:** keep only the Better Auth tables. Everything else in the old schema is replaced by the inventory schema in section 6.
5. **Web dashboard:** keep the layout, shell, navigation pattern and component library as they are. Only rename and swap the content.
6. **Mobile:** the whole layout changes to a Telegram-style UI (section 10). Auth, API client and navigation setup are kept.
7. **Styling:** introduce no new colors, gradients or box-shadows. Use the existing theme tokens only.
8. **Components:** small and modular, matching the stack already used. Minimal UX: show only what is necessary.
9. **Work in phases** (section 12). Run typecheck and lint at the end of each phase and commit with a clear message.
10. **If something is ambiguous or risky** (existing data to preserve, an unclear dependency), stop and ask instead of guessing.

---

## 1. Product Scope

A simple inventory system for one beer warehouse.

| Role                     | App    | Responsibility                                                                                                                                 |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**                | Web    | Manage platform users (create, set initial password, assign role, activate/deactivate, list all). Manage products and prices. View everything. |
| **Storekeeper**          | Web    | Receive stock, issue racks to salespeople, confirm returns and damages, stock counts and adjustments.                                          |
| **Sales**                | Mobile | Receive racks, sell, deposit cash at the bank, submit a report (racks sold + money deposited + bank slip).                                     |
| **Accountant / Auditor** | Mobile | Verify sales reports against stock and bank deposits, approve or flag, view reports.                                                           |

**Out of scope for the MVP:** customers and credit sales, returnable-empties deposits, suppliers module, multi-warehouse, online payments, patient-style OTP login, white-label apps.

---

## 2. Phase 0: Assessment (mandatory)

Produce `ASSESSMENT.md` at the repo root before any change. For every item below, record: **path, what it does, and a verdict: KEEP / MODIFY / REMOVE / BUILD**.

### 2.1 Discovery commands

Run from the repo root (adjust globs as needed):

```bash
# repo shape
ls apps/* && cat package.json pnpm-workspace.yaml

# multi-tenant and domain leftovers
rg -il "tenant|organizationId|organization_id|slug|rls|row level" apps -g '!node_modules'
rg -il "nexa|dental|dentist|patient|clinic|appointment|treatment|invoice|membership" apps -g '!node_modules'
rg -il "chapa|otp|redis|CLIENT_ID|white.?label" apps -g '!node_modules'

# auth surface
rg -il "better-auth|betterAuth|authClient" apps -g '!node_modules'

# reusable infrastructure
rg -il "upload|multer|r2|s3|storage" apps/back-end -g '!node_modules'
rg -il "audit|notification|push|expo-notifications" apps -g '!node_modules'
rg -il "permission|rbac|role" apps/back-end -g '!node_modules'
```

### 2.2 What to inspect and decide

**Back-end (`apps/back-end`)**

- App bootstrap, route registration, `routes/v1`, services, repositories, middlewares, `lib` (auth, env, errors, logger), docs (OpenAPI/Scalar), `utils` (api-response, permission), `types/hono.ts`. Verdict is expected to be **KEEP**.
- Tenant resolution middleware (slug/URL based), request-context, RLS policies and `set_config` calls. Verdict is expected to be **REMOVE** or **MODIFY to a no-op**.
- Better Auth config: which plugins are used (admin, organization, phone/OTP, etc.), how roles are stored, how Expo is supported (trusted origins, `expo` plugin). Record this precisely, because the role strategy in section 5 depends on it.
- Database folder: schema files, migrations, seeds, drizzle config. Better Auth tables are **KEEP**, all other tables are **REMOVE**.
- Domain modules (patients, appointments, treatments, billing, payments/Chapa, staff, tenants, notifications, etc.): **REMOVE**, except generic infrastructure that is reusable (audit log, file upload, push notifications, admin user management), which is **MODIFY**.
- Redis, Prometheus/Grafana, Docker Compose, deployment files: keep what the app still needs. Remove services used only by removed features (for example Redis if it served only phone OTP).

**Web (`apps/front-end`)**

- App shell, layout, sidebar/navigation, routing, auth client, API client, data fetching, form and table components, theme. Verdict: **KEEP**.
- Pages and features for dental/CRM domains: **REMOVE**.
- User management screens: **MODIFY** for the admin role (create user, set initial password, role, status).
- Tenant selection or slug logic in the router and API client: **REMOVE**.

**Mobile (`apps/mobile`)**

- Expo config, auth client, API client, storage, theming, push setup: **KEEP**.
- Existing screens and navigation (patient flow, Chapa payments, appointments): **REMOVE**.
- `app.config.ts` white-label logic driven by `CLIENT_ID`: **REMOVE** and make it a single app config.
- New Telegram-style screens: **BUILD**.

### 2.3 Required output

`ASSESSMENT.md` must contain:

1. A KEEP / MODIFY / REMOVE / BUILD table covering every item above.
2. The exact Better Auth setup (plugins, role storage, session strategy, Expo support).
3. Existing reusable pieces found (upload, audit, notifications, permissions).
4. Risks and questions (existing data, external services, CI or deploy dependencies).

Stop after writing it and wait for confirmation if any risk is flagged.

---

## 3. Target Architecture

- Same monorepo, same three apps, same layered back-end.
- **Single-tenant:** no tenant resolution, no tenant slug in URLs, no `organizationId` on domain tables, no RLS.
- One database, one Better Auth instance shared by web and Expo.
- Domain code lives in the existing layering:

```
apps/back-end/src/
  routes/v1/
    products.ts  stock.ts  issues.ts  reports.ts
    deposits.ts  verifications.ts  threads.ts  files.ts
  services/      (one service per route group)
  repositories/  (one repository per aggregate)
  db/schema/     (better-auth tables + inventory tables)
```

Follow whatever file and naming conventions already exist. This tree shows intent, not exact names.

---

## 4. Downgrade Plan (multi-tenant to single app)

Do these in order, committing after each step.

1. **Tenant layer:** remove tenant resolution middleware, request-context and any `tenantId/organizationId` plumbing in services and repositories.
2. **RLS:** drop policies and any per-request `set_config` calls. Disable RLS on any table that remains.
3. **Better Auth tables:** keep them intact. If the organization plugin is in use and role checks depend on it, take the least invasive route: keep the tables and the plugin, seed one fixed organization, and resolve it as a constant instead of from the URL. Do not rewrite the role mechanism. If the organization plugin was only there for multi-tenancy, remove it and store the role on the user via the admin plugin. Record the chosen path in `ASSESSMENT.md`.
4. **Domain modules:** delete routes, services, repositories, schemas, seeds, OpenAPI entries and tests for all dental/CRM features and payments.
5. **Schema reset:** assuming no data needs preserving (confirm in the assessment), delete old migrations and generate one fresh baseline containing Better Auth tables plus the inventory tables from section 6.
6. **Extras:** remove OTP, Chapa, white-label and tenant-related env vars and config. Update `.env.example`.
7. **Frontend:** remove tenant routing and removed-feature pages, navigation entries and API calls.
8. **Mobile:** remove all old screens, white-label config and Chapa code.
9. **Infra:** clean Docker Compose, scripts and CI of removed services.
10. **Dead code sweep:** `pnpm -r typecheck`, then search for unused exports and files.

### Rename map

| Find                                                 | Replace with                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Nexa / NexaCare / NexaDental / Nexa CRM              | the new product name (placeholder: `APP_NAME`, confirm)                   |
| `crm-api`, `monolithflow`, `V3` (package/root names) | `inventory-*` equivalents                                                 |
| clinic, dental, dentist, patient                     | remove, or map to warehouse, salesperson, etc. only where UI text remains |
| tenant, organization (in UI copy)                    | remove                                                                    |

Update package names, titles, app name and slug in `app.config`, README, OpenAPI info, page titles and seed data. Run the discovery greps again at the end: there must be no matches for `nexa|dental|clinic|patient|tenant`.

---

## 5. Roles and Permissions

Roles: `admin`, `storekeeper`, `sales`, `accountant`.

Reuse the existing role mechanism and permission helper (`utils/permission` or equivalent). Do not hard-code role names across the code: add a permission map in one place.

| Permission                      | admin |  storekeeper   |  sales  | accountant |
| ------------------------------- | :---: | :------------: | :-----: | :--------: |
| Manage users                    |   ✓   |                |         |            |
| Manage products and prices      |   ✓   |                |         |            |
| View products                   |   ✓   |       ✓        |    ✓    |     ✓      |
| Receive stock, adjust stock     |   ✓   |       ✓        |         |            |
| View stock ledger and balances  |   ✓   |       ✓        |         |  ✓ (read)  |
| Create issue (load-out)         |   ✓   |       ✓        |         |            |
| View own issues                 |       |                |    ✓    |            |
| View all issues                 |   ✓   |       ✓        |         |     ✓      |
| Submit sales report and deposit |       |                | ✓ (own) |            |
| Confirm returns and damages     |   ✓   |       ✓        |         |            |
| Verify (approve / flag) report  |       |                |         |     ✓      |
| View reports and discrepancies  |   ✓   | ✓ (stock only) | ✓ (own) |     ✓      |
| Post thread comments            |   ✓   |       ✓        | ✓ (own) |     ✓      |

Platform rule: web serves admin and storekeeper, mobile serves sales and accountant. Enforce this at login (reject a role on the wrong app with a clear message) only if it fits the existing auth flow. Otherwise keep the API role-based and let each app show only its own screens.

---

## 6. Database (Drizzle + Postgres)

Keep Better Auth tables as they are (`user`, `session`, `account`, `verification`, plus any plugin tables already in use). Add the tables below, following the existing conventions for ids (UUID type), timestamps and naming.

**Money:** `numeric(12,2)`, currency ETB. Compute in integer cents inside services to avoid float errors.
**Quantities:** whole racks (`integer`). Add `bottles_per_rack` on products for display only.

### 6.1 `products`

| Column                 | Type          | Notes               |
| ---------------------- | ------------- | ------------------- |
| id                     | uuid pk       |                     |
| name                   | text          | e.g. brand and size |
| sku                    | text unique   |                     |
| bottles_per_rack       | integer       |                     |
| price_per_rack         | numeric(12,2) | current price       |
| is_active              | boolean       | default true        |
| created_at, updated_at | timestamptz   |                     |

### 6.2 `issues` (load-outs)

| Column        | Type              | Notes                                                          |
| ------------- | ----------------- | -------------------------------------------------------------- |
| id            | uuid pk           |                                                                |
| issue_no      | text unique       | human readable, for example `LO-000123`                        |
| sales_user_id | text fk → user.id |                                                                |
| issued_by     | text fk → user.id | storekeeper                                                    |
| status        | enum              | `open`, `reported`, `returns_confirmed`, `verified`, `flagged` |
| note          | text null         |                                                                |
| issued_at     | timestamptz       |                                                                |
| closed_at     | timestamptz null  |                                                                |

### 6.3 `issue_items`

| Column     | Type          | Notes                        |
| ---------- | ------------- | ---------------------------- |
| id         | uuid pk       |                              |
| issue_id   | uuid fk       |                              |
| product_id | uuid fk       |                              |
| quantity   | integer       | racks issued                 |
| unit_price | numeric(12,2) | price snapshot at issue time |

Unique on `(issue_id, product_id)`.

### 6.4 `stock_movements` (the ledger)

Append-only. Never update or delete rows. Balances are sums.

| Column          | Type              | Notes                                                 |
| --------------- | ----------------- | ----------------------------------------------------- |
| id              | uuid pk           |                                                       |
| product_id      | uuid fk           |                                                       |
| type            | enum              | `receive`, `issue`, `return`, `damage`, `adjustment`  |
| warehouse_delta | integer           | signed effect on warehouse stock                      |
| holder_delta    | integer           | signed effect on the salesperson's holding, default 0 |
| holder_user_id  | text fk null      | salesperson, when `holder_delta` is not 0             |
| issue_id        | uuid fk null      |                                                       |
| batch_no        | text null         | for `receive`                                         |
| expiry_date     | date null         | for `receive`                                         |
| reference       | text null         | delivery note, supplier doc                           |
| note            | text null         | required for `adjustment`                             |
| created_by      | text fk → user.id |                                                       |
| created_at      | timestamptz       |                                                       |

Movement effects:

| Type                  | warehouse_delta | holder_delta |
| --------------------- | --------------- | ------------ |
| receive               | +q              | 0            |
| issue                 | −q              | +q           |
| return                | +q              | −q           |
| damage (in custody)   | 0               | −q           |
| damage (in warehouse) | −q              | 0            |
| adjustment            | ±q              | 0            |

Warehouse balance per product = `SUM(warehouse_delta)`. A salesperson's holding = `SUM(holder_delta)` for that user. Add database `CHECK`s or service-level guards so balances can never go negative.

### 6.5 `sales_reports`

| Column        | Type           | Notes                              |
| ------------- | -------------- | ---------------------------------- |
| id            | uuid pk        |                                    |
| issue_id      | uuid fk unique | one report per issue               |
| sales_user_id | text fk        |                                    |
| status        | enum           | `submitted`, `verified`, `flagged` |
| note          | text null      |                                    |
| submitted_at  | timestamptz    |                                    |

### 6.6 `report_items`

| Column     | Type    | Notes                    |
| ---------- | ------- | ------------------------ |
| id         | uuid pk |                          |
| report_id  | uuid fk |                          |
| product_id | uuid fk |                          |
| sold       | integer | racks sold, declared     |
| returned   | integer | racks returned, declared |
| damaged    | integer | racks damaged, declared  |

### 6.7 `deposits`

| Column        | Type          | Notes                      |
| ------------- | ------------- | -------------------------- |
| id            | uuid pk       |                            |
| report_id     | uuid fk       |                            |
| amount        | numeric(12,2) |                            |
| bank_name     | text          |                            |
| reference_no  | text          | bank transaction reference |
| slip_file_key | text          | uploaded bank slip image   |
| deposited_at  | timestamptz   |                            |

A report can have several deposits (partial deposits). The total is the sum.

### 6.8 `return_confirmations`

Storekeeper confirmation of what physically came back.

| Column       | Type              | Notes |
| ------------ | ----------------- | ----- |
| id           | uuid pk           |       |
| issue_id     | uuid fk unique    |       |
| confirmed_by | text fk → user.id |       |
| confirmed_at | timestamptz       |       |
| note         | text null         |       |

### 6.9 `return_confirmation_items`

| Column          | Type    | Notes                      |
| --------------- | ------- | -------------------------- |
| id              | uuid pk |                            |
| confirmation_id | uuid fk |                            |
| product_id      | uuid fk |                            |
| returned        | integer | actual racks received back |
| damaged         | integer | actual damaged racks       |

Creating a confirmation also writes the `return` and `damage (in custody)` ledger movements in the same transaction.

### 6.10 `verifications`

| Column         | Type              | Notes                                 |
| -------------- | ----------------- | ------------------------------------- |
| id             | uuid pk           |                                       |
| report_id      | uuid fk unique    |                                       |
| accountant_id  | text fk → user.id |                                       |
| decision       | enum              | `approved`, `flagged`                 |
| expected_cash  | numeric(12,2)     | snapshot at decision time             |
| deposited_cash | numeric(12,2)     | snapshot                              |
| cash_variance  | numeric(12,2)     | deposited − expected                  |
| racks_variance | integer           | declared sold − expected sold, summed |
| note           | text null         | required when flagged                 |
| decided_at     | timestamptz       |                                       |

### 6.11 `thread_events` and `thread_reads` (for the chat-style UI)

One thread per issue. Events are generated by the system and by comments.

`thread_events`

| Column     | Type                   | Notes                                                                                                |
| ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| id         | uuid pk                | time-ordered ids preferred                                                                           |
| issue_id   | uuid fk                | thread key                                                                                           |
| actor_id   | text fk → user.id null | null for system events                                                                               |
| type       | enum                   | `issued`, `report_submitted`, `deposit_added`, `returns_confirmed`, `verified`, `flagged`, `comment` |
| payload    | jsonb                  | small summary for the message card                                                                   |
| created_at | timestamptz            |                                                                                                      |

`thread_reads`

| Column       | Type        | Notes |
| ------------ | ----------- | ----- |
| user_id      | text fk     |       |
| issue_id     | uuid fk     |       |
| last_read_at | timestamptz |       |

Primary key `(user_id, issue_id)`. Unread count = events after `last_read_at`.

### 6.12 Reused tables

Reuse an existing audit log table if present (write an entry for every state change). Reuse existing push token and notification tables if present; otherwise add a minimal `push_tokens (user_id, token, platform)`.

### 6.13 Indexes

`stock_movements(product_id)`, `stock_movements(holder_user_id)`, `issues(sales_user_id, status)`, `thread_events(issue_id, created_at)`, `deposits(report_id)`.

---

## 7. Business Rules and State Flow

```
open ──(sales submits report)──► reported
reported ──(storekeeper confirms returns)──► returns_confirmed
returns_confirmed ──(accountant approves)──► verified
reported | returns_confirmed ──(accountant flags)──► flagged
```

1. **Issue:** storekeeper picks a salesperson and products. Creating it writes `issue` ledger movements (warehouse −q, holder +q) and snapshots prices. Reject if warehouse stock is insufficient.
2. **Report:** the salesperson submits per product `sold`, `returned`, `damaged`, plus at least one deposit with a bank slip. Validation: `sold + returned + damaged = issued` per product.
3. **Return confirmation:** storekeeper records actual returned and damaged racks per product. This writes the `return` and `damage` movements.
4. **Verification:** the accountant sees one reconciliation view per issue:

```
expected_sold   = issued − confirmed_returned − confirmed_damaged
racks_variance  = declared_sold − expected_sold
expected_cash   = Σ expected_sold × unit_price
deposited_cash  = Σ deposits.amount
cash_variance   = deposited_cash − expected_cash
```

- **Approve** is allowed only when returns are confirmed and both variances are zero.
- **Flag** is always allowed and requires a note. Variances are stored on the verification.

5. **Closing stock:** on approval, write the final ledger movement that removes the sold racks from the salesperson's holding (`holder_delta = −expected_sold`, `warehouse_delta = 0`). After that the salesperson's holding for the issue is zero.
6. **Immutability:** ledger rows and verifications are never edited. Corrections are new adjustment movements with a mandatory note.
7. **Every state change** writes an audit log entry and a `thread_events` row.
8. **Roles on the server:** the API checks the permission map on every route. The UI hiding a button is not a security measure.

---

## 8. Back-end API (`/v1`)

Use the existing route pattern (OpenAPIHono `createRoute` if that is what the project uses), validation schemas, response helpers and error classes. Add OpenAPI metadata so Scalar shows the new endpoints. Remove the old ones.

| Group         | Endpoints                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Users (admin) | reuse the existing admin user endpoints; ensure: create user with role and initial password, list, update role, activate/deactivate, reset password    |
| Products      | `GET /products`, `POST /products`, `PATCH /products/:id` (admin)                                                                                       |
| Stock         | `GET /stock/balances`, `GET /stock/movements`, `POST /stock/receive`, `POST /stock/adjust`                                                             |
| Issues        | `POST /issues`, `GET /issues` (role-filtered), `GET /issues/:id` (with items, report, deposits, confirmation, verification, reconciliation)            |
| Reports       | `POST /issues/:id/report` (sales), `GET /reports`                                                                                                      |
| Deposits      | `POST /reports/:id/deposits`, `GET /reports/:id/deposits`                                                                                              |
| Returns       | `POST /issues/:id/confirm-returns` (storekeeper)                                                                                                       |
| Verification  | `POST /reports/:id/verify` with `{ decision, note }` (accountant)                                                                                      |
| Threads       | `GET /threads` (chat list: last event, unread count), `GET /threads/:issueId/events`, `POST /threads/:issueId/comments`, `POST /threads/:issueId/read` |
| Files         | reuse the existing upload endpoint for bank slips; otherwise add `POST /files` with image type and size limits and a signed or authenticated read      |
| Dashboard     | `GET /dashboard/summary` for admin and storekeeper widgets                                                                                             |

Realtime: start with polling (query refetch interval) on thread list and open thread. Add SSE later only if needed.

---

## 9. Web App (`apps/front-end`)

Keep the dashboard shell, layout, navigation components and design system. Rename and swap content only.

### Admin

- **Users:** list (name, role, status), create user (name, email or phone depending on the current login identifier, role, initial password), edit role, activate/deactivate, reset password. Adapt the existing staff or user management screens.
- **Products:** table plus create/edit dialog (name, sku, bottles per rack, price, active).
- **Overview:** stock balances, issues in progress, flagged reports count.
- **Audit log:** reuse if it exists.

### Storekeeper

- **Overview:** warehouse balances per product, open issues.
- **Receive stock:** form (product, racks, batch, expiry, reference).
- **Stock ledger:** filterable movement table.
- **Issue load-out:** select salesperson, add product rows with quantities (shows available stock), submit.
- **Open issues:** list with status; open one to **Confirm returns** (actual returned and damaged per product).
- **Adjustments:** form with mandatory note.

### Routing and nav

Use TanStack file-based routing as already set up. Role-gate routes in the same place the app currently handles auth guards. Sidebar entries depend on role. Remove all old feature routes.

---

## 10. Mobile App (`apps/mobile`): Telegram-style UI

Keep Expo config (single app, no white-label), auth client, API client, storage, push setup. Replace all screens and navigation with the structure below. Use existing theme tokens only.

### 10.1 Structure

- **Chat list (home):** each issue (load-out) is a conversation.
    - Row: circular avatar with initials, title, last event preview, time, unread badge.
    - Top bar: title, search icon, overflow menu (profile, sign out).
    - Pull to refresh. Sorted by last activity.
    - Sales sees own loads, with today's load highlighted at the top.
    - Accountant sees all loads with filter chips: `All`, `Pending`, `Flagged`. Rows show the salesperson's name as the title.
- **Conversation screen:** timeline of message bubbles built from `thread_events`.
    - System events render as **cards inside bubbles**: _Load issued_ (items and quantities), _Report submitted_ (sold, returned, damaged, totals), _Deposit added_ (amount, bank, slip thumbnail), _Returns confirmed_, _Verified_, _Flagged_ (with note).
    - Comments render as normal text bubbles, own on the right and others on the left.
    - Date separators, timestamps, read state.
- **Composer (bottom bar):** text input and send for comments, an attach button for the bank slip, and a role-specific action button.
    - **Sales:** `Submit report` action opens a bottom sheet to enter sold, returned, damaged per product, then add deposits (amount, bank, reference, slip photo from camera or gallery). Available while the issue is `open`.
    - **Accountant:** the report card shows a reconciliation summary (expected vs declared racks, expected vs deposited cash) with inline **Approve** and **Flag** actions. Flag opens a note sheet. Approve is disabled with a clear reason until returns are confirmed and variances are zero.
- **Profile screen:** name, role, change password, sign out.

### 10.2 Components (small, reusable)

`ChatListItem`, `Avatar`, `UnreadBadge`, `MessageBubble`, `EventCard` (variants per event type), `Composer`, `ReportSheet`, `DepositForm`, `ReconciliationCard`, `FilterChips`, `DateSeparator`, `EmptyState`.

### 10.3 Behavior

- Data via the existing fetching approach (check whether TanStack Query is already used and reuse it).
- Optimistic append for comments, polling for new events, mark thread read when opened.
- Image picking with Expo's image picker, compress before upload.
- Push notifications on: issue created (sales), report submitted (accountant), returns confirmed (accountant), verified or flagged (sales). Reuse existing push setup.
- Role-based entry: after login, route sales or accountant to the same chat list with role-specific content. If admin or storekeeper log in on mobile, show a short "use the web app" screen.

---

## 11. Seed Data

Idempotent seed script using the existing seed approach:

- 1 admin, 1 storekeeper, 2 sales, 1 accountant (with known dev passwords from env, never committed secrets).
- 4 to 6 products with realistic names, rack sizes and prices.
- An initial `receive` movement per product so balances are not zero.

---

## 12. Phases and Checkpoints

| Phase | Work                                                                                                    | Done when                                                |
| ----- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **0** | Assessment, `ASSESSMENT.md`                                                                             | Written, risks reviewed                                  |
| **1** | Downgrade back-end: tenant layer, RLS, domain modules removed, schema reset to Better Auth only         | App boots, login works on web and Expo, typecheck passes |
| **2** | Inventory schema and migration, seed                                                                    | Migration applies from scratch, seed runs                |
| **3** | Back-end modules: products, stock, issues, returns, reports, deposits, verification, threads, dashboard | Endpoints in Scalar, permission map enforced             |
| **4** | Web: strip old features, rename, admin and storekeeper screens                                          | Both roles complete their flows                          |
| **5** | Mobile: strip old screens, Telegram-style UI, sales and accountant flows, push                          | Full flow works on device                                |
| **6** | Rename sweep, cleanup of infra and env, README                                                          | Greps for `nexa                                          | dental | clinic | patient | tenant` are empty |
| **7** | End-to-end pass                                                                                         | Checklist below passes                                   |

Commit after each phase. Do not start the next phase if typecheck or lint fails.

---

## 13. Verification

Always, per phase:

```bash
pnpm -r typecheck
pnpm -r lint
```

Manual end-to-end checklist:

1. Admin creates a storekeeper, a salesperson and an accountant and sets their passwords. All three can log in.
2. Storekeeper receives stock and sees balances.
3. Storekeeper issues racks to the salesperson. Warehouse balance drops, the salesperson's holding rises, the chat appears on the salesperson's phone with an unread badge.
4. Salesperson submits a report with deposit and bank slip. Validation rejects mismatched totals.
5. Storekeeper confirms returns and damages. Ledger movements are written.
6. Accountant sees the reconciliation. A matching case approves. A mismatched case can only be flagged, with a note.
7. After approval, the salesperson's holding for the issue is zero and the thread shows the verified card.
8. Wrong-role access to any endpoint returns an authorization error.
9. Scalar docs list only inventory endpoints.

---

## 14. Open Decisions

- [ ] Product name to replace Nexa (`ZOLA`).
- [ ] Is there any existing data in the database that must be preserved? (If yes, stop before the schema reset.)
- [ ] Better Auth: keep the organization plugin with a single fixed organization, or remove it and store roles on the user? (Decide from the assessment.)
- [ ] Login identifier for these roles: email, phone, or username? (Follow what the current auth uses.)
- [ ] Can a load-out span multiple days, or is it one issue per day per salesperson? (The plan assumes one report per issue.)
- [ ] Mobile look: use the existing theme tokens (default), or introduce a Telegram-like palette?
- [ ] Bank slip storage: reuse existing storage, or local volume on the VPS, or object storage?
- [ ] Add later: returnable empties and deposits, batch/expiry-based selling (FEFO), customers and credit.
