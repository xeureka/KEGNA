import { sql, type SQLWrapper } from "drizzle-orm";
import { db, pool } from "./index";
import { CARD_TIERS } from "@/config/card-tiers";

/**
 * Non-destructive, idempotent payment schema.
 *
 * Every statement is safe to re-run against a database that already has the
 * object, so the same function can be used both by `pnpm db:migrate:payments`
 * and by the boot-time guard that guarantees the columns the payment flows
 * query actually exist before the API starts serving traffic.
 */

export type PaymentSchemaProblem = {
	object: string;
	problem: string;
	fix: string;
};

const APPLY_COMMAND = "pnpm --filter back-end db:migrate:payments";

/**
 * Add the payment-flow enum values on their own committed connection.
 *
 * `ALTER TYPE ... ADD VALUE` cannot be used in the same transaction that
 * references the new value (Postgres error 55P04). Because callers such as the
 * seed run inside an outer transaction (and `db` transparently redirects to it),
 * issuing the ALTER through `db` would only create a savepoint and never commit.
 * Running it on a dedicated pooled connection guarantees the values are
 * committed before any index or query below references them.
 */
async function addPaymentEnumValues(): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query(
			`ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT'`,
		);
		for (const value of ["SUCCESS", "CANCELLED", "EXPIRED"]) {
			await client.query(
				`ALTER TYPE payment_status ADD VALUE IF NOT EXISTS '${value}'`,
			);
		}
		for (const value of ["CHAPA", "MOBILE_TRANSFER"]) {
			await client.query(
				`ALTER TYPE payment_method ADD VALUE IF NOT EXISTS '${value}'`,
			);
		}
	} finally {
		client.release();
	}
}

export async function applyPaymentMigration(): Promise<void> {
	// PostgreSQL forbids referencing a newly added enum value until the
	// transaction that added it has committed (55P04). Neon's pooled endpoints
	// enforce this even for partial-index predicates, so add the enum values in
	// their own committed transaction first, then apply the rest below.
	await addPaymentEnumValues();

	// One transaction: either the whole payment ledger lands or nothing does,
	// and the elevated RLS context is transaction-local so it can never leak
	// onto a pooled connection that later serves a tenant request.
	await db.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('app.is_super_admin', 'true', true)`,
		);
		await tx.execute(sql`select set_config('app.tenant_id', '', true)`);

		for (const [name, values] of [
			["payment_purpose", "'visit', 'card', 'balance'"],
			[
				"payment_event_type",
				"'initialized', 'webhook', 'verified', 'status_changed', 'manual_recorded'",
			],
			[
				"card_purchase_status",
				"'pending', 'active', 'failed', 'cancelled', 'expired'",
			],
		] as const) {
			await tx.execute(
				sql.raw(`DO $$ BEGIN
				CREATE TYPE ${name} AS ENUM (${values});
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`),
			);
		}

		// The membership tier a patient currently holds. Denormalised on
		// purpose: dashboards list patients without an extra join, and it is
		// rewritten from `user_cards` whenever a card activates.
		await tx.execute(
			sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(50)`,
		);

		await tx.execute(
			sql`ALTER TABLE payments ALTER COLUMN bill_id DROP NOT NULL`,
		);
		for (const column of [
			"tx_ref VARCHAR(100)",
			"chapa_reference VARCHAR(255)",
			"user_id UUID REFERENCES users(id)",
			"patient_id UUID REFERENCES patients(id)",
			"purpose payment_purpose",
			"reference_id UUID",
			"base_amount NUMERIC(12, 2)",
			"service_charge NUMERIC(12, 2) NOT NULL DEFAULT 0",
			"total_amount NUMERIC(12, 2)",
			"currency VARCHAR(3) NOT NULL DEFAULT 'ETB'",
			"checkout_url VARCHAR(1000)",
			"transfer_reference VARCHAR(255)",
			"recorded_by UUID REFERENCES users(id)",
			"verify_payload JSONB",
			"expires_at TIMESTAMPTZ",
		]) {
			await tx.execute(
				sql.raw(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ${column}`),
			);
		}

		// Backfill legacy bill payments before the NOT NULL / CHECK guards land.
		await tx.execute(
			sql`UPDATE payments SET base_amount = amount WHERE base_amount IS NULL`,
		);
		await tx.execute(
			sql`UPDATE payments SET total_amount = amount WHERE total_amount IS NULL`,
		);
		await tx.execute(sql`UPDATE payments p
			SET patient_id = b.patient_id,
				purpose = COALESCE(p.purpose, 'balance'),
				reference_id = COALESCE(p.reference_id, p.bill_id),
				recorded_by = COALESCE(p.recorded_by, p.received_by_user_id)
			FROM bills b
			WHERE p.bill_id = b.id
			  AND (p.patient_id IS NULL OR p.purpose IS NULL
			       OR p.reference_id IS NULL OR p.recorded_by IS NULL)`);
		await tx.execute(
			sql`UPDATE payments SET purpose = 'balance' WHERE purpose IS NULL`,
		);
		await tx.execute(
			sql`ALTER TABLE payments ALTER COLUMN purpose SET NOT NULL`,
		);
		await tx.execute(
			sql`ALTER TABLE payments ALTER COLUMN base_amount SET NOT NULL`,
		);
		await tx.execute(
			sql`ALTER TABLE payments ALTER COLUMN total_amount SET NOT NULL`,
		);

		for (const constraint of [
			"payments_total_matches_breakdown CHECK (amount = total_amount AND base_amount + service_charge = total_amount)",
			"payments_amounts_non_negative CHECK (base_amount >= 0 AND service_charge >= 0 AND total_amount >= 0)",
		]) {
			const [name, body] = constraint.split(" CHECK ");
			await tx.execute(
				sql.raw(`DO $$ BEGIN
				ALTER TABLE payments ADD CONSTRAINT ${name} CHECK ${body};
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`),
			);
		}

		await tx.execute(
			sql`CREATE UNIQUE INDEX IF NOT EXISTS payments_tx_ref_unique ON payments(tx_ref)`,
		);
		for (const index of [
			"payments_tenant_id_idx ON payments(tenant_id)",
			"payments_bill_id_idx ON payments(bill_id)",
			"payments_tenant_bill_idx ON payments(tenant_id, bill_id)",
			"payments_tenant_status_idx ON payments(tenant_id, status)",
			"payments_tenant_paid_at_idx ON payments(tenant_id, paid_at)",
			"payments_user_id_idx ON payments(user_id)",
			"payments_status_idx ON payments(status)",
			"payments_method_idx ON payments(method)",
			"payments_purpose_idx ON payments(purpose)",
			"payments_created_at_idx ON payments(created_at)",
			"payments_tenant_patient_idx ON payments(tenant_id, patient_id)",
		]) {
			const [name, definition] = index.split(" ON ");
			await tx.execute(
				sql.raw(`CREATE INDEX IF NOT EXISTS ${name} ON ${definition}`),
			);
		}

		await tx.execute(
			sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id)`,
		);
		await tx.execute(
			sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ`,
		);
		await tx.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist`);
		await tx.execute(sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_window tstzrange
			GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED`);
		await tx.execute(sql`DO $$ BEGIN
			ALTER TABLE appointments ADD CONSTRAINT appointments_no_doctor_overlap
				EXCLUDE USING gist (tenant_id WITH =, doctor_id WITH =, booking_window WITH &&)
				WHERE (deleted_at IS NULL AND status NOT IN ('CANCELLED', 'NO_SHOW'));
		EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$`);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS appointments_payment_expires_at_idx ON appointments(payment_expires_at)`,
		);
		// Serves the expired-hold sweep: narrow to the only status it touches.
		await tx.execute(sql`CREATE INDEX IF NOT EXISTS appointments_tenant_hold_sweep_idx
			ON appointments(tenant_id, payment_expires_at)
			WHERE status = 'PENDING_PAYMENT'`);

		await tx.execute(sql`CREATE TABLE IF NOT EXISTS payment_events (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			payment_id UUID NOT NULL REFERENCES payments(id),
			type payment_event_type NOT NULL,
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS payment_events_tenant_id_idx ON payment_events(tenant_id)`,
		);
		await tx.execute(sql`CREATE INDEX IF NOT EXISTS payment_events_payment_id_created_at_idx
			ON payment_events(payment_id, created_at)`);
		// Append-only for application traffic. A Super Admin context (which
		// only trusted server-side code can set) may still delete events, so
		// `pnpm seed` can reset the ledger without dropping the trigger.
		await tx.execute(sql`CREATE OR REPLACE FUNCTION reject_payment_event_mutation()
			RETURNS TRIGGER LANGUAGE plpgsql AS $$
			BEGIN
				IF current_setting('app.is_super_admin', true) = 'true' THEN
					RETURN COALESCE(NEW, OLD);
				END IF;
				RAISE EXCEPTION 'payment_events is append-only';
			END $$`);
		await tx.execute(
			sql`DROP TRIGGER IF EXISTS payment_events_append_only ON payment_events`,
		);
		await tx.execute(sql`CREATE TRIGGER payment_events_append_only
			BEFORE UPDATE OR DELETE ON payment_events
			FOR EACH ROW EXECUTE FUNCTION reject_payment_event_mutation()`);

		await tx.execute(sql`CREATE TABLE IF NOT EXISTS payment_allocations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			payment_id UUID NOT NULL REFERENCES payments(id),
			bill_id UUID NOT NULL REFERENCES bills(id),
			amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS payment_allocations_tenant_id_idx ON payment_allocations(tenant_id)`,
		);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS payment_allocations_payment_id_idx ON payment_allocations(payment_id)`,
		);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS payment_allocations_bill_id_idx ON payment_allocations(bill_id)`,
		);

		await tx.execute(sql`CREATE TABLE IF NOT EXISTS card_products (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			name VARCHAR(150) NOT NULL,
			description TEXT,
			price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
			validity_days INTEGER CHECK (validity_days IS NULL OR validity_days > 0),
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS card_products_tenant_active_idx ON card_products(tenant_id, is_active)`,
		);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS card_products_tenant_name_idx ON card_products(tenant_id, name)`,
		);
		// Preserve the legacy mobile app's published 500 ETB annual registration
		// card as tenant-owned catalog data rather than a price in UI code.
		await tx.execute(sql`INSERT INTO card_products (tenant_id, name, description, price, validity_days)
			SELECT t.id, 'Annual registration card',
			       'Annual dental clinic registration and patient card', 500.00, 365
			FROM tenants t
			WHERE NOT EXISTS (
				SELECT 1 FROM card_products cp
				WHERE cp.tenant_id = t.id AND cp.name = 'Annual registration card'
			)`);

		await tx.execute(sql`CREATE TABLE IF NOT EXISTS user_cards (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			user_id UUID NOT NULL REFERENCES users(id),
			patient_id UUID NOT NULL REFERENCES patients(id),
			card_product_id UUID NOT NULL REFERENCES card_products(id),
			payment_id UUID REFERENCES payments(id),
			status card_purchase_status NOT NULL DEFAULT 'pending',
			activated_at TIMESTAMPTZ,
			expires_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS user_cards_tenant_user_idx ON user_cards(tenant_id, user_id)`,
		);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS user_cards_tenant_patient_idx ON user_cards(tenant_id, patient_id)`,
		);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS user_cards_payment_id_idx ON user_cards(payment_id)`,
		);
		await tx.execute(
			sql`CREATE INDEX IF NOT EXISTS user_cards_tenant_status_idx ON user_cards(tenant_id, status)`,
		);

		await syncCardTiers(tx);

		for (const table of [
			"payments",
			"payment_events",
			"payment_allocations",
			"card_products",
			"user_cards",
		]) {
			await tx.execute(
				sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`),
			);
			await tx.execute(
				sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`),
			);
			await tx.execute(
				sql.raw(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`),
			);
			await tx.execute(
				sql.raw(`CREATE POLICY tenant_isolation ON ${table} USING (
				current_setting('app.is_super_admin', true) = 'true'
				OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
			) WITH CHECK (
				current_setting('app.is_super_admin', true) = 'true'
				OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
			)`),
			);
		}
	});
}

type SqlExecutor = {
	execute: (query: string | SQLWrapper) => Promise<unknown>;
};

/** Push `CARD_TIERS` into every tenant's `card_products` catalog. */
export async function syncCardTiers(tx: SqlExecutor): Promise<void> {
	for (const tier of CARD_TIERS) {
		await tx.execute(sql`UPDATE card_products
			SET price = ${tier.price},
				description = ${tier.summary},
				validity_days = ${tier.validityDays},
				updated_at = NOW()
			WHERE name = ${tier.name} AND price IS DISTINCT FROM ${tier.price}`);
		await tx.execute(sql`INSERT INTO card_products (tenant_id, name, description, price, validity_days)
			SELECT t.id, ${tier.name}, ${tier.summary}, ${tier.price}, ${tier.validityDays}
			FROM tenants t
			WHERE NOT EXISTS (
				SELECT 1 FROM card_products cp
				WHERE cp.tenant_id = t.id AND cp.name = ${tier.name}
			)`);
	}
}

/**
 * Compare the payment-related tables against what the code expects and return
 * a human-readable list of drift. Empty means the live database matches.
 */
export async function verifyPaymentSchema(): Promise<PaymentSchemaProblem[]> {
	const problems: PaymentSchemaProblem[] = [];

	const columns = await db.execute(sql`
		SELECT table_name, column_name
		FROM information_schema.columns
		WHERE table_schema = 'public'
	`);
	const present = new Set(
		(columns.rows as Array<{ table_name: string; column_name: string }>).map(
			(row) => `${row.table_name}.${row.column_name}`,
		),
	);

	const expectedColumns = [
		"payments.tenant_id",
		"payments.tx_ref",
		"payments.chapa_reference",
		"payments.user_id",
		"payments.patient_id",
		"payments.purpose",
		"payments.reference_id",
		"payments.base_amount",
		"payments.service_charge",
		"payments.total_amount",
		"payments.currency",
		"payments.method",
		"payments.status",
		"payments.checkout_url",
		"payments.transfer_reference",
		"payments.recorded_by",
		"payments.verify_payload",
		"payments.expires_at",
		"payments.paid_at",
		"appointments.payment_id",
		"appointments.payment_expires_at",
		"patients.membership_tier",
		"payment_events.payment_id",
		"user_cards.card_product_id",
		"card_products.price",
	];
	for (const column of expectedColumns) {
		if (!present.has(column)) {
			problems.push({
				object: column,
				problem: "column is missing",
				fix: APPLY_COMMAND,
			});
		}
	}

	const tables = await db.execute(sql`
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public'
	`);
	const presentTables = new Set(
		(tables.rows as Array<{ table_name: string }>).map((row) => row.table_name),
	);
	for (const table of [
		"payments",
		"payment_events",
		"payment_allocations",
		"card_products",
		"user_cards",
	]) {
		if (!presentTables.has(table)) {
			problems.push({
				object: table,
				problem: "table is missing",
				fix: APPLY_COMMAND,
			});
		}
	}

	if (problems.length > 0) return problems;

	const enums = await db.execute(sql`
		SELECT t.typname AS name, e.enumlabel AS label
		FROM pg_type t
		JOIN pg_enum e ON e.enumtypid = t.oid
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
	`);
	const enumValues = new Map<string, Set<string>>();
	for (const row of enums.rows as Array<{ name: string; label: string }>) {
		if (!enumValues.has(row.name)) enumValues.set(row.name, new Set());
		enumValues.get(row.name)!.add(row.label);
	}
	const expectedEnums: Record<string, string[]> = {
		appointment_status: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
		payment_status: ["PENDING", "SUCCESS", "FAILED", "CANCELLED", "EXPIRED"],
		payment_method: ["CHAPA", "CASH", "MOBILE_TRANSFER"],
		payment_purpose: ["visit", "card", "balance"],
		payment_event_type: [
			"initialized",
			"webhook",
			"verified",
			"status_changed",
		],
		card_purchase_status: [
			"pending",
			"active",
			"failed",
			"cancelled",
			"expired",
		],
	};
	for (const [name, values] of Object.entries(expectedEnums)) {
		const available = enumValues.get(name);
		if (!available) {
			problems.push({
				object: `enum ${name}`,
				problem: "enum type is missing",
				fix: APPLY_COMMAND,
			});
			continue;
		}
		for (const value of values) {
			if (!available.has(value)) {
				problems.push({
					object: `enum ${name}.${value}`,
					problem: "enum value is missing",
					fix: APPLY_COMMAND,
				});
			}
		}
	}

	const indexes = await db.execute(sql`
		SELECT indexname FROM pg_indexes
		WHERE schemaname = 'public'
	`);
	const presentIndexes = new Set(
		(indexes.rows as Array<{ indexname: string }>).map((row) => row.indexname),
	);
	for (const index of [
		"payments_tx_ref_unique",
		"payments_tenant_id_idx",
		"payments_tenant_status_idx",
		"payments_status_idx",
		"payments_method_idx",
		"payments_purpose_idx",
		"payments_user_id_idx",
		"payments_created_at_idx",
		"appointments_payment_expires_at_idx",
	]) {
		if (!presentIndexes.has(index)) {
			problems.push({
				object: `index ${index}`,
				problem: "index is missing",
				fix: APPLY_COMMAND,
			});
		}
	}

	return problems;
}

/** Applies the migration and fails loudly when the schema still drifts. */
export async function ensurePaymentSchema(): Promise<void> {
	await applyPaymentMigration();
	const problems = await verifyPaymentSchema();
	if (problems.length > 0) {
		const detail = problems
			.map((problem) => ` - ${problem.object}: ${problem.problem}`)
			.join("\n");
		throw new Error(
			`Payment schema verification failed:\n${detail}\nRun: ${APPLY_COMMAND}`,
		);
	}
}
