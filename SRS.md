# Beer Warehouse Inventory Management

A simple system to track beer stock from receiving, to issuing racks to salespeople, to cash reporting and accountant verification.

---

## 1. Roles and Apps

| Role                     | App    | Main Job                                                                                              |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| **Admin**                | Web    | Create users, set initial passwords, assign roles, activate/deactivate, view all users                |
| **Storekeeper**          | Web    | Receive stock, issue racks to sales, take back unsold racks and empties, record damages, stock counts |
| **Sales**                | Mobile | Take racks, sell, deposit cash at the bank, submit a report (racks sold + money)                      |
| **Accountant / Auditor** | Mobile | Verify sales reports against bank deposits, approve or flag, view reports                             |

---

## 2. Core Flow

1. **Receive:** Storekeeper records incoming stock (product, quantity, batch/date).
2. **Issue:** Storekeeper gives racks to a salesperson, creating a load-out record.
3. **Sell:** Salesperson sells and deposits the cash at the bank.
4. **Report:** Salesperson submits racks sold, racks returned, cash amount, and a photo of the bank slip.
5. **Return:** Storekeeper confirms unsold racks and empties actually come back.
6. **Verify:** Accountant checks the report against the bank deposit and approves or flags it.

### Reconciliation Rules

For each salesperson and day, these must match:

- **Issued** = **Sold** + **Returned** (+ **Damaged**)
- **Money expected** (sold × price) = **Money deposited**

Any gap becomes a flagged discrepancy visible to the accountant.

---

## 3. Modules

| Module             | Purpose                                      |
| ------------------ | -------------------------------------------- |
| Auth and Users     | Login, roles, admin-managed passwords        |
| Products           | Beer types, rack size, price                 |
| Stock              | Receiving, current balance, movement history |
| Issues (Load-outs) | Stock given to a salesperson                 |
| Sales Reports      | Items sold, returns, cash, bank slip         |
| Verification       | Approve, reject, or flag with a note         |
| Reports            | Daily, per salesperson, discrepancies        |

---

## 4. Data Model (Starting Point)

- `users`
- `products`
- `stock_movements` (receive, issue, return, damage)
- `issues`
- `issue_items`
- `sales_reports`
- `report_items`
- `deposits` (amount, bank, slip image)
- `verifications`
- `audit_log`

> **Key rule:** Stock is a ledger. Never edit a balance directly, only append movements. The balance is the sum of movements, which keeps auditing reliable.

---

## 5. Tech Stack

| Layer                      | Technology                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Web (Storekeeper, Admin)   | React 19, TypeScript, TanStack file-based routing                                          |
| Mobile (Sales, Accountant) | React Native with Expo                                                                     |
| Backend                    | Hono, TypeScript, Drizzle, PostgreSQL                                                      |
| Auth                       | Better Auth (admin plugin for admin-created users, roles, banning; Expo client for mobile) |

### Extras to Plan

- File storage for bank slip photos (for example Cloudflare R2)
- pnpm monorepo with shared types
- Hono typed RPC client so web and mobile share API types

---

## 6. MVP Build Order

1. Auth, users, roles
2. Products and stock receiving
3. Issue to sales
4. Sales report with slip upload
5. Accountant verification
6. Reports

---

## 7. Open Decisions

- [ ] One Expo app with role-based screens, or two separate mobile apps?
- [ ] Dispatcher/driver role: add now or later?
- [ ] Track returnable empties (crates/bottles) and deposits in the MVP?
- [ ] Track batch and expiry dates (FEFO/FIFO)?
