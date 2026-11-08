# Back-end setup

## Chapa payments

The payment integration runs in the Node/Hono back-end. Keep all provider keys
in `apps/back-end/.env` (or the production secret store); never put them in
mobile or browser environment variables. Production startup fails with the
names of missing Chapa variables, without printing their values. In development,
leave the provider block entirely unset to run other API features; if you start
configuring it, supply the complete block.

| Variable               | Example                                                 | Where it comes from                                                  | Secret?             |
| ---------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- | ------------------- |
| `CHAPA_SECRET_KEY`     | `CHASECK_TEST-…`                                        | Chapa Dashboard → Settings → API; use the test key before live mode  | Yes                 |
| `CHAPA_WEBHOOK_SECRET` | `<random-webhook-secret>`                               | Set in Chapa Dashboard → Settings → Webhooks                         | Yes                 |
| `CHAPA_BASE_URL`       | `https://api.chapa.co/v1`                               | Chapa API base URL; use test or live keys with the same API endpoint | No                  |
| `CHAPA_CALLBACK_URL`   | `https://api.example.com/api/v1/payments/chapa/webhook` | Public HTTPS URL deployed for the Chapa webhook                      | No                  |
| `CHAPA_RETURN_URL`     | `https://api.example.com/api/v1/payments/chapa/return`  | Public HTTPS return bridge on this back-end                          | No                  |
| `SERVICE_CHARGE_ETB`   | `50`                                                    | Nexa configuration; this is the platform fee for Chapa only          | No                  |
| `PAYMENT_HOLD_MINUTES` | `30`                                                    | Nexa configuration; unpaid appointment-slot hold duration            | No                  |

Set the webhook URL in the Chapa dashboard to the exact value of
`CHAPA_CALLBACK_URL`, and use the same webhook secret in both places. The HTTPS
return bridge uses the payment reference to redirect to the tenant app scheme
`nexa-<tenant-slug>://payment-return`; the existing mobile config defines that
scheme. The mobile app does not need or receive any Chapa secret.

Payment initialization sends the total amount in ETB to our merchant account.
The app displays the total amount. Reception cash/mobile-transfer
payments have no service charge and are recorded against the oldest outstanding
bills.

## Database migration

After backing up the intended database and confirming `DATABASE_URL` points to
it, apply the project migration (idempotent):

```bash
pnpm --filter back-end db:migrate:chapa-payments
```

It extends the existing billing ledger, creates payment events/allocations and
card catalog tables, installs tenant RLS and append-only payment events, and
copies the legacy annual 500 ETB card offer into tenant-owned catalog rows. Do
not manually execute migration SQL in production.

Chapa requires a patient email for hosted checkout. Verify with Chapa test-mode
credentials and a test subaccount before enabling live keys; the return bridge
and webhook both require public HTTPS access.

## Manual test script (Chapa test mode)

Prereqs: `CHAPA_MODE=test`, test keys set, webhook reachable over public HTTPS
(e.g. `cloudflared tunnel --url http://localhost:3000` for the callback URL),
and the app seeded (`pnpm --filter back-end seed`).

The dev seed creates Ahadu Dental, tenant id
`0ef815bd-15c3-4aff-b434-095ba4e5ad1a`, slug `ahadu-dental`, and a reception
account `frontdesk@ahadudental.local`. Send `X-Nexa-Tenant-Id` on every
authenticated call with the tenant that owns the session.

1. **Sign in as reception** (Better Auth, cookie session):
   ```bash
   curl -c jar -sS -X POST http://localhost:3000/api/auth/sign-in/email \
     -H 'content-type: application/json' -H 'X-Nexa-Tenant-Id: 0ef815bd-15c3-4aff-b434-095ba4e5ad1a' \
     -d '{"email":"frontdesk@ahadudental.local","password":"FrontDeskPassw0rd!2026"}'
   ```
2. **Payment config and card catalog**:
   ```bash
   curl -b jar http://localhost:3000/api/v1/payments/config \
     -H 'X-Nexa-Tenant-Id: 0ef815bd-15c3-4aff-b434-095ba4e5ad1a'
   # expect data.serviceChargeEtb = "50"
   curl -b jar http://localhost:3000/api/v1/cards \
     -H 'X-Nexa-Tenant-Id: 0ef815bd-15c3-4aff-b434-095ba4e5ad1a'
   ```
3. **Card purchase** (patient session): `POST /api/v1/payments/card` with the
   card tier id → returns `{ checkoutUrl, txRef }`. Open the URL, pay with a
   Chapa test card, then poll `GET /api/v1/payments/{txRef}/status` until
   `SUCCESS`; the patient profile then reports the tier.
4. **Book visit**: `POST /api/v1/mobile/appointments` creates the appointment in
   `PENDING_PAYMENT`; `POST /api/v1/payments/visit` starts the Chapa checkout
   for the inclusive total (service + 50). The appointment is CONFIRMED only
   after the verified payment succeeds.
5. **Pay balance** (`POST /api/v1/payments/balance`): runs one checkout and
   allocates it across the selected outstanding bills, oldest first.
6. **Reception cash payment** (reception session):
   `POST /api/v1/payments/manual` with `method: "CASH"` (or `MOBILE_TRANSFER`
   plus `transferReference`) → payment PAID, balance deducted, receipt number
   issued. Overpaying is rejected.
7. **Failed/cancelled payment**: start a checkout and close the hosted page
   without paying (or use Chapa's test failure), then call
   `GET /api/v1/payments/{txRef}/status` → `FAILED`/`CANCELLED`; the pending
   appointment/appointment hold is released.
8. **Duplicate webhook**: `POST /api/v1/payments/chapa/webhook` twice with the
   same signed payload → first returns 200/processed, the second 200 with
   `idempotent: true`; only one balance deduction.
9. **Forged webhook**: post the same body without `x-chapa-signature` or with
   a wrong secret → 401, nothing written.
