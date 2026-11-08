import { db } from "@/db";
import { sql } from "drizzle-orm";

async function pushSchema() {
	console.log("🛠️ Pushing Drizzle database schema tables...");

	await db.execute(sql`
    -- ENUMS
    DO $$ BEGIN
      CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
	EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE membership_status AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'INACTIVE');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE appointment_status AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE dental_chart_status AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE discount_type AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE bill_status AS ENUM ('DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT', 'VIEW');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE audit_scope AS ENUM ('TENANT', 'SUPER_ADMIN', 'BREAK_GLASS');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE notification_type AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE notification_status AS ENUM ('UNREAD', 'READ');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- TABLES
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      status tenant_status NOT NULL DEFAULT 'ACTIVE',
      logo_url TEXT,
      brand_color VARCHAR(20) NOT NULL DEFAULT '#0f766e',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_color VARCHAR(20) NOT NULL DEFAULT '#0f766e';

    CREATE TABLE IF NOT EXISTS tenant_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),
      timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
      currency VARCHAR(10) NOT NULL,
      default_appointment_duration INT,
      allow_online_booking BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      image TEXT,
      phone VARCHAR(50),
      status user_status NOT NULL DEFAULT 'ACTIVE',
      is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      account_id VARCHAR(255) NOT NULL,
      provider_id VARCHAR(100) NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TIMESTAMPTZ,
      refresh_token_expires_at TIMESTAMPTZ,
      scope TEXT,
      password TEXT,
      issuer TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT accounts_provider_account_unique UNIQUE (provider_id, account_id)
    );

    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS id_token TEXT;
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS scope TEXT;
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS issuer TEXT;

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      ip_address VARCHAR(100),
      user_agent TEXT,
      active_tenant_id UUID REFERENCES tenants(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_tenant_id UUID REFERENCES tenants(id);

    CREATE TABLE IF NOT EXISTS verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier VARCHAR(255) NOT NULL,
      value VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(150) NOT NULL UNIQUE,
      resource VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT permissions_resource_action_unique UNIQUE (resource, action)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID NOT NULL REFERENCES roles(id),
      permission_id UUID NOT NULL REFERENCES permissions(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS tenant_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      user_id UUID NOT NULL REFERENCES users(id),
      role_id UUID NOT NULL REFERENCES roles(id),
      status membership_status NOT NULL DEFAULT 'ACTIVE',
      joined_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT tenant_memberships_tenant_user_unique UNIQUE (tenant_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id),
      license_number VARCHAR(100) NOT NULL,
      specialization VARCHAR(255),
      bio TEXT,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT doctors_tenant_license_number_unique UNIQUE (tenant_id, license_number)
    );

    CREATE TABLE IF NOT EXISTS patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      patient_number VARCHAR(100) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      date_of_birth DATE,
      gender VARCHAR(50),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      emergency_contact_name VARCHAR(255),
      emergency_contact_phone VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT patients_tenant_patient_number_unique UNIQUE (tenant_id, patient_number)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS patients_tenant_phone_unique
      ON patients (tenant_id, phone)
      WHERE phone IS NOT NULL AND deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS patients_tenant_name_unique
      ON patients (tenant_id, lower(first_name), lower(last_name))
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      patient_id UUID NOT NULL REFERENCES patients(id),
      doctor_id UUID NOT NULL REFERENCES doctors(id),
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      status appointment_status NOT NULL DEFAULT 'SCHEDULED',
      reason TEXT,
      notes TEXT,
      cancelled_at TIMESTAMPTZ,
      cancelled_reason TEXT,
      created_by_user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE EXTENSION IF NOT EXISTS btree_gist;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_window tstzrange
      GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;
    DO $$ BEGIN
      ALTER TABLE appointments ADD CONSTRAINT appointments_no_doctor_overlap
        EXCLUDE USING gist (tenant_id WITH =, doctor_id WITH =, booking_window WITH &&)
        WHERE (deleted_at IS NULL AND status NOT IN ('CANCELLED', 'NO_SHOW'));
    EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

    CREATE TABLE IF NOT EXISTS appointment_status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      appointment_id UUID NOT NULL REFERENCES appointments(id),
      old_status appointment_status,
      new_status appointment_status NOT NULL,
      changed_by_user_id UUID REFERENCES users(id),
      reason TEXT,
      changed_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      doctor_id UUID NOT NULL REFERENCES doctors(id),
      day_of_week INT NOT NULL,
      start_time VARCHAR(5) NOT NULL,
      end_time VARCHAR(5) NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT doctor_schedules_day_of_week_range CHECK (day_of_week BETWEEN 0 AND 6),
      CONSTRAINT doctor_schedules_time_order CHECK (start_time < end_time)
    );

    -- Dental chart entries reference procedures, so create the catalog before
    -- creating the foreign key below. The full idempotent definition later in
    -- this script remains safe and is skipped once this exists.
    CREATE TABLE IF NOT EXISTS procedures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      code VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      default_price NUMERIC(12, 2),
      default_duration_minutes INT,
      discount_type discount_type NOT NULL DEFAULT 'NONE',
      discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT procedures_tenant_code_unique UNIQUE (tenant_id, code)
    );

    CREATE TABLE IF NOT EXISTS dental_chart_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      patient_id UUID NOT NULL REFERENCES patients(id),
      doctor_id UUID NOT NULL REFERENCES doctors(id),
      appointment_id UUID REFERENCES appointments(id),
      tooth_number INT NOT NULL,
      surface VARCHAR(10),
      procedure_id UUID REFERENCES procedures(id),
      procedure_name VARCHAR(150) NOT NULL,
      notes TEXT,
      charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
      status dental_chart_status NOT NULL DEFAULT 'PLANNED',
      date_performed DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT dental_chart_entries_tooth_number_range CHECK (tooth_number BETWEEN 1 AND 32),
      CONSTRAINT dental_chart_entries_charge_non_negative CHECK (charge >= 0),
      CONSTRAINT dental_chart_entries_status_requires_date CHECK ((status = 'COMPLETED') = (date_performed IS NOT NULL))
    );

    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
    ALTER TABLE procedures ADD COLUMN IF NOT EXISTS discount_type discount_type NOT NULL DEFAULT 'NONE';
    ALTER TABLE procedures ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0;

    DO $$ BEGIN
      ALTER TABLE appointments ADD CONSTRAINT appointments_cancelled_has_reason
        CHECK ((status <> 'CANCELLED' AND status <> 'NO_SHOW') OR (cancelled_at IS NOT NULL AND cancelled_reason IS NOT NULL AND length(btrim(cancelled_reason)) > 0));
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS medical_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      patient_id UUID NOT NULL REFERENCES patients(id),
      doctor_id UUID REFERENCES doctors(id),
      appointment_id UUID REFERENCES appointments(id),
      chief_complaint TEXT,
      diagnosis TEXT,
      treatment TEXT,
      notes TEXT,
      created_by_user_id UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS procedures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      code VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      default_price NUMERIC(12, 2),
      default_duration_minutes INT,
      discount_type discount_type NOT NULL DEFAULT 'NONE',
      discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT procedures_tenant_code_unique UNIQUE (tenant_id, code)
    );

    CREATE TABLE IF NOT EXISTS medical_record_procedures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      medical_record_id UUID NOT NULL REFERENCES medical_records(id),
      procedure_id UUID NOT NULL REFERENCES procedures(id),
      tooth_number VARCHAR(10),
      quadrant VARCHAR(20),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      patient_id UUID NOT NULL REFERENCES patients(id),
      appointment_id UUID REFERENCES appointments(id),
      bill_number VARCHAR(100) NOT NULL,
      status bill_status NOT NULL DEFAULT 'DRAFT',
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      issued_at TIMESTAMPTZ,
      due_at TIMESTAMPTZ,
      created_by_user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT bills_tenant_bill_number_unique UNIQUE (tenant_id, bill_number)
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      bill_id UUID NOT NULL REFERENCES bills(id),
      procedure_id UUID REFERENCES procedures(id),
      description TEXT NOT NULL,
      quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
      unit_price NUMERIC(12, 2) NOT NULL,
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      bill_id UUID NOT NULL REFERENCES bills(id),
      amount NUMERIC(12, 2) NOT NULL,
      method payment_method NOT NULL,
      status payment_status NOT NULL DEFAULT 'PENDING',
      reference VARCHAR(255),
      paid_at TIMESTAMPTZ,
      received_by_user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_reference_unique
      ON payments (tenant_id, reference) WHERE reference IS NOT NULL;

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      actor_user_id UUID REFERENCES users(id),
      action audit_action NOT NULL,
      scope audit_scope NOT NULL DEFAULT 'TENANT',
      entity_type VARCHAR(100) NOT NULL,
      entity_id UUID,
      old_values JSONB,
      new_values JSONB,
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS scope audit_scope NOT NULL DEFAULT 'TENANT';

    -- Notifications must exist before the RLS loop below references it.
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      user_id UUID REFERENCES users(id),
      type notification_type NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status notification_status NOT NULL DEFAULT 'UNREAD',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Database-level tenant isolation. Authentication/membership lookup tables
    -- remain outside this policy because they are needed to resolve a tenant;
    -- all clinical, financial, settings, notifications, and audit data is RLS
    -- protected inside the request transaction.
    DO $$ DECLARE table_name TEXT; BEGIN
      FOREACH table_name IN ARRAY ARRAY[
        'tenant_settings', 'doctors', 'patients', 'appointments',
        'appointment_status_history', 'doctor_schedules',
        'dental_chart_entries', 'medical_records', 'procedures',
        'medical_record_procedures', 'bills', 'bill_items', 'payments',
        'audit_logs', 'notifications'
      ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
        EXECUTE format(
          'CREATE POLICY tenant_isolation ON %I USING (current_setting(''app.is_super_admin'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (current_setting(''app.is_super_admin'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
          table_name
        );
      END LOOP;
    END $$;

    ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_membership_isolation ON tenant_memberships;
    CREATE POLICY tenant_membership_isolation ON tenant_memberships
      USING (current_setting('app.is_super_admin', true) = 'true'
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR user_id::text = NULLIF(current_setting('app.user_id', true), ''))
      WITH CHECK (current_setting('app.is_super_admin', true) = 'true'
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      user_id UUID REFERENCES users(id),
      type notification_type NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status notification_status NOT NULL DEFAULT 'UNREAD',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

	console.log("✅ Database schema pushed successfully!");
}

pushSchema()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("❌ Schema push failed:", err);
		process.exit(1);
	});
