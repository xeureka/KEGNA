import { sql } from "drizzle-orm";
import { db } from "./index";

/** Idempotent additive migration for tenant branding and platform audit scope. */
async function migrate() {
	await db.execute(sql`DO $$ BEGIN
		CREATE TYPE audit_scope AS ENUM ('TENANT', 'SUPER_ADMIN', 'BREAK_GLASS');
	EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
	await db.execute(
		sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_color VARCHAR(20) NOT NULL DEFAULT '#0f766e'`,
	);
	await db.execute(
		sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE`,
	);
	await db.execute(
		sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS scope audit_scope NOT NULL DEFAULT 'TENANT'`,
	);
	await db.execute(
		sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_tenant_id UUID REFERENCES tenants(id)`,
	);
	await db.execute(sql`DO $$ DECLARE table_name TEXT; BEGIN
		FOREACH table_name IN ARRAY ARRAY[
			'tenant_settings', 'doctors', 'patients', 'appointments',
			'appointment_status_history', 'doctor_schedules', 'dental_chart_entries',
			'medical_records', 'procedures', 'medical_record_procedures', 'bills',
			'bill_items', 'payments', 'audit_logs', 'notifications'
		] LOOP
			EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
			EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
			EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
			EXECUTE format(
				'CREATE POLICY tenant_isolation ON %I USING (current_setting(''app.is_super_admin'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (current_setting(''app.is_super_admin'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
				table_name
			);
		END LOOP;
	END $$`);
	await db.execute(
		sql`ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY`,
	);
	await db.execute(
		sql`ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY`,
	);
	await db.execute(
		sql`DROP POLICY IF EXISTS tenant_membership_isolation ON tenant_memberships`,
	);
	await db.execute(sql`CREATE POLICY tenant_membership_isolation ON tenant_memberships USING (
		current_setting('app.is_super_admin', true) = 'true'
		OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR user_id::text = NULLIF(current_setting('app.user_id', true), '')
	) WITH CHECK (
		current_setting('app.is_super_admin', true) = 'true'
		OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
	)`);
	console.log("Onboarding schema migration applied");
}

migrate().catch((error) => {
	console.error("Onboarding schema migration failed", error);
	process.exitCode = 1;
});
