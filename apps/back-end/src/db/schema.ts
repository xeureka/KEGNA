import {
	pgTable,
	pgEnum,
	uuid,
	varchar,
	text,
	boolean,
	integer,
	numeric,
	date,
	jsonb,
	timestamp,
	unique,
	index,
	primaryKey,
	check,
	type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ENUMS

export const tenantStatus = pgEnum("tenant_status", [
	"ACTIVE",
	"SUSPENDED",
	"INACTIVE",
]);

export const membershipStatus = pgEnum("membership_status", [
	"ACTIVE",
	"INVITED",
	"SUSPENDED",
	"INACTIVE",
]);

export const userStatus = pgEnum("user_status", [
	"ACTIVE",
	"INACTIVE",
	"SUSPENDED",
]);

export const appointmentStatus = pgEnum("appointment_status", [
	"SCHEDULED",
	"PENDING_PAYMENT",
	"CONFIRMED",
	"CHECKED_IN",
	"IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
	"NO_SHOW",
]);

export const dentalChartStatus = pgEnum("dental_chart_status", [
	"PLANNED",
	"COMPLETED",
	"CANCELLED",
]);

export const discountType = pgEnum("discount_type", [
	"NONE",
	"PERCENTAGE",
	"FIXED",
]);

export const billStatus = pgEnum("bill_status", [
	"DRAFT",
	"PENDING",
	"PARTIALLY_PAID",
	"PAID",
	"CANCELLED",
	"VOID",
]);

export const paymentStatus = pgEnum("payment_status", [
	"PENDING",
	"SUCCESS",
	"COMPLETED",
	"FAILED",
	"CANCELLED",
	"EXPIRED",
	"REFUNDED",
]);

export const paymentMethod = pgEnum("payment_method", [
	"CASH",
	"CARD",
	"BANK_TRANSFER",
	"MOBILE_MONEY",
	"MOBILE_TRANSFER",
	"CHAPA",
	"OTHER",
]);

export const paymentPurpose = pgEnum("payment_purpose", [
	"visit",
	"card",
	"balance",
]);

export const paymentEventType = pgEnum("payment_event_type", [
	"initialized",
	"webhook",
	"verified",
	"status_changed",
	"manual_recorded",
]);

export const cardPurchaseStatus = pgEnum("card_purchase_status", [
	"pending",
	"active",
	"failed",
	"cancelled",
	"expired",
]);

export const auditAction = pgEnum("audit_action", [
	"CREATE",
	"UPDATE",
	"DELETE",
	"RESTORE",
	"LOGIN",
	"LOGOUT",
	"VIEW",
]);

export const auditScope = pgEnum("audit_scope", [
	"TENANT",
	"SUPER_ADMIN",
	"BREAK_GLASS",
]);

export const notificationType = pgEnum("notification_type", [
	"INFO",
	"SUCCESS",
	"WARNING",
	"ERROR",
]);

export const notificationStatus = pgEnum("notification_status", [
	"UNREAD",
	"READ",
]);

// MULTI-TENANCY

export const tenants = pgTable("tenants", {
	id: uuid("id").defaultRandom().primaryKey(),

	name: varchar("name", { length: 255 }).notNull(),
	slug: varchar("slug", { length: 100 }).notNull().unique(),

	status: tenantStatus("status").notNull().default("ACTIVE"),

	logoUrl: text("logo_url"),
	brandColor: varchar("brand_color", { length: 20 })
		.notNull()
		.default("#0f766e"),

	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const tenantSettings = pgTable("tenant_settings", {
	id: uuid("id").defaultRandom().primaryKey(),

	tenantId: uuid("tenant_id")
		.notNull()
		.unique()
		.references((): AnyPgColumn => tenants.id),

	// IANA timezone name (e.g. "Africa/Addis_Ababa"), NOT a fixed offset.
	// Used only to convert local <-> UTC at input/output boundaries -
	// all timestamptz columns everywhere are stored in UTC.
	timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),

	currency: varchar("currency", { length: 10 }).notNull(),

	defaultAppointmentDuration: integer("default_appointment_duration"),

	allowOnlineBooking: boolean("allow_online_booking").notNull().default(false),

	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

// AUTHENTICATION - BETTER AUTH

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),

	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }).notNull().unique(),

	emailVerified: boolean("email_verified").notNull().default(false),

	image: text("image"),

	phone: varchar("phone", { length: 50 }),
	phoneVerified: boolean("phone_verified").notNull().default(false),

	status: userStatus("status").notNull().default("ACTIVE"),
	isSuperAdmin: boolean("is_super_admin").notNull().default(false),

	lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const accounts = pgTable(
	"accounts",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		userId: uuid("user_id")
			.notNull()
			.references((): AnyPgColumn => users.id),

		accountId: varchar("account_id", { length: 255 }).notNull(),
		providerId: varchar("provider_id", { length: 100 }).notNull(),

		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		issuer: text("issuer"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("accounts_user_id_idx").on(table.userId),
		unique("accounts_provider_account_unique").on(
			table.providerId,
			table.accountId,
		),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		userId: uuid("user_id")
			.notNull()
			.references((): AnyPgColumn => users.id),

		token: varchar("token", { length: 255 }).notNull().unique(),

		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

		ipAddress: varchar("ip_address", { length: 100 }),
		userAgent: text("user_agent"),
		activeTenantId: uuid("active_tenant_id").references(() => tenants.id),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("sessions_user_id_idx").on(table.userId),
		index("sessions_expires_at_idx").on(table.expiresAt),
	],
);

export const verifications = pgTable(
	"verifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		identifier: varchar("identifier", { length: 255 }).notNull(),

		value: varchar("value", { length: 255 }).notNull(),

		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("verifications_identifier_idx").on(table.identifier),
		index("verifications_expires_at_idx").on(table.expiresAt),
	],
);

// AUTHORIZATION / RBAC

export const roles = pgTable("roles", {
	id: uuid("id").defaultRandom().primaryKey(),

	name: varchar("name", { length: 100 }).notNull().unique(),

	description: text("description"),

	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const permissions = pgTable(
	"permissions",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		name: varchar("name", { length: 150 }).notNull().unique(),

		resource: varchar("resource", { length: 100 }).notNull(),
		action: varchar("action", { length: 100 }).notNull(),

		description: text("description"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		unique("permissions_resource_action_unique").on(
			table.resource,
			table.action,
		),
	],
);

export const rolePermissions = pgTable(
	"role_permissions",
	{
		roleId: uuid("role_id")
			.notNull()
			.references((): AnyPgColumn => roles.id),

		permissionId: uuid("permission_id")
			.notNull()
			.references((): AnyPgColumn => permissions.id),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.roleId, table.permissionId] }),
		index("role_permissions_permission_id_idx").on(table.permissionId),
	],
);

// TENANT MEMBERSHIPS

export const tenantMemberships = pgTable(
	"tenant_memberships",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		userId: uuid("user_id")
			.notNull()
			.references((): AnyPgColumn => users.id),

		roleId: uuid("role_id")
			.notNull()
			.references((): AnyPgColumn => roles.id),

		status: membershipStatus("status").notNull().default("ACTIVE"),

		joinedAt: timestamp("joined_at", { withTimezone: true }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("tenant_memberships_tenant_user_unique").on(
			table.tenantId,
			table.userId,
		),
		index("tenant_memberships_tenant_id_idx").on(table.tenantId),
		index("tenant_memberships_user_id_idx").on(table.userId),
		index("tenant_memberships_role_id_idx").on(table.roleId),
	],
);

// PEOPLE

export const doctors = pgTable(
	"doctors",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		userId: uuid("user_id")
			.notNull()
			.unique()
			.references((): AnyPgColumn => users.id),

		licenseNumber: varchar("license_number", { length: 100 }).notNull(),

		specialization: varchar("specialization", { length: 255 }),

		bio: text("bio"),

		isAvailable: boolean("is_available").notNull().default(true),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("doctors_tenant_id_idx").on(table.tenantId),
		index("doctors_license_number_idx").on(table.licenseNumber),
		unique("doctors_tenant_license_number_unique").on(
			table.tenantId,
			table.licenseNumber,
		),
	],
);

export const patients = pgTable(
	"patients",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		patientNumber: varchar("patient_number", { length: 100 }).notNull(),

		firstName: varchar("first_name", { length: 100 }).notNull(),
		lastName: varchar("last_name", { length: 100 }).notNull(),

		dateOfBirth: date("date_of_birth"),

		gender: varchar("gender", { length: 50 }),

		phone: varchar("phone", { length: 50 }),
		email: varchar("email", { length: 255 }),

		address: text("address"),

		emergencyContactName: varchar("emergency_contact_name", {
			length: 255,
		}),
		emergencyContactPhone: varchar("emergency_contact_phone", {
			length: 50,
		}),

		// Highest membership tier the patient currently holds, denormalised so
		// dashboards can badge patients without joining `user_cards`. Rewritten
		// from the active cards whenever a payment activates one.
		membershipTier: varchar("membership_tier", { length: 50 }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		unique("patients_tenant_patient_number_unique").on(
			table.tenantId,
			table.patientNumber,
		),
		index("patients_tenant_id_idx").on(table.tenantId),
		index("patients_tenant_phone_idx").on(table.tenantId, table.phone),
		index("patients_tenant_created_at_idx").on(table.tenantId, table.createdAt),
		// Migration-only (not expressible in Drizzle's query builder):
		// CREATE INDEX idx_patients_tenant_active ON patients (tenant_id)
		//   WHERE deleted_at IS NULL;
	],
);

// APPOINTMENTS / SCHEDULING

export const appointments = pgTable(
	"appointments",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		patientId: uuid("patient_id")
			.notNull()
			.references((): AnyPgColumn => patients.id),
		doctorId: uuid("doctor_id")
			.notNull()
			.references((): AnyPgColumn => doctors.id),

		startAt: timestamp("start_at", { withTimezone: true }).notNull(),
		endAt: timestamp("end_at", { withTimezone: true }).notNull(),

		status: appointmentStatus("status").notNull().default("SCHEDULED"),
		paymentId: uuid("payment_id").references((): AnyPgColumn => payments.id),
		paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true }),

		reason: text("reason"),
		notes: text("notes"),

		// Populated only when the appointment is CANCELLED / NO_SHOW. The
		// check constraint below enforces that a cancellation always carries
		// a non-empty reason the same way the app layer does.
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		cancelledReason: text("cancelled_reason"),

		createdByUserId: uuid("created_by_user_id").references(
			(): AnyPgColumn => users.id,
		),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("appointments_tenant_id_idx").on(table.tenantId),
		index("appointments_tenant_doctor_start_idx").on(
			table.tenantId,
			table.doctorId,
			table.startAt,
		),
		index("appointments_tenant_patient_start_idx").on(
			table.tenantId,
			table.patientId,
			table.startAt,
		),
		index("appointments_tenant_status_start_idx").on(
			table.tenantId,
			table.status,
			table.startAt,
		),
		index("appointments_payment_expires_at_idx").on(table.paymentExpiresAt),
		check(
			"appointments_cancelled_has_reason",
			sql`("status" <> 'CANCELLED' AND "status" <> 'NO_SHOW') OR ("cancelled_at" IS NOT NULL AND "cancelled_reason" IS NOT NULL AND length(btrim("cancelled_reason")) > 0)`,
		),
		// Migration-only additions (not expressible in Drizzle):
		//
		// Cross-tenant integrity: enforce in app layer (tenant-scoped
		// lookups on patient/doctor before insert) or via a
		// BEFORE INSERT/UPDATE trigger for a stronger guarantee.
		//
		// The exclusion constraint is installed by db:push:custom because
		// Drizzle does not model generated range columns.
	],
);

export const appointmentStatusHistory = pgTable(
	"appointment_status_history",
	{
		// Consider UUID v7 for this append-heavy table (insert-order
		// locality avoids index bloat at scale) instead of defaultRandom().
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		appointmentId: uuid("appointment_id")
			.notNull()
			.references((): AnyPgColumn => appointments.id),

		oldStatus: appointmentStatus("old_status"),
		newStatus: appointmentStatus("new_status").notNull(),

		changedByUserId: uuid("changed_by_user_id").references(
			(): AnyPgColumn => users.id,
		),

		reason: text("reason"),

		changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		index("appointment_status_history_tenant_id_idx").on(table.tenantId),
		index("appointment_status_history_appointment_id_idx").on(
			table.appointmentId,
		),
		index("appointment_status_history_appointment_changed_idx").on(
			table.appointmentId,
			table.changedAt,
		),
	],
);

// Doctor weekly schedule. One row per available day slot; a doctor is
// unavailable on days that have no rows. `replaceDoctorSchedule` swaps the
// whole week template atomically.
export const doctorSchedules = pgTable(
	"doctor_schedules",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		doctorId: uuid("doctor_id")
			.notNull()
			.references((): AnyPgColumn => doctors.id),

		dayOfWeek: integer("day_of_week").notNull(),

		startTime: varchar("start_time", { length: 5 }).notNull(),
		endTime: varchar("end_time", { length: 5 }).notNull(),

		isAvailable: boolean("is_available").notNull().default(true),
	},
	(table) => [
		index("doctor_schedules_tenant_id_idx").on(table.tenantId),
		index("doctor_schedules_tenant_doctor_day_idx").on(
			table.tenantId,
			table.doctorId,
			table.dayOfWeek,
		),
		check(
			"doctor_schedules_day_of_week_range",
			sql`"day_of_week" BETWEEN 0 AND 6`,
		),
		check("doctor_schedules_time_order", sql`"start_time" < "end_time"`),
	],
);

// DENTAL CHART
export const dentalChartEntries = pgTable(
	"dental_chart_entries",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		patientId: uuid("patient_id")
			.notNull()
			.references((): AnyPgColumn => patients.id),

		doctorId: uuid("doctor_id")
			.notNull()
			.references((): AnyPgColumn => doctors.id),

		appointmentId: uuid("appointment_id").references(
			(): AnyPgColumn => appointments.id,
		),

		toothNumber: integer("tooth_number").notNull(),
		surface: varchar("surface", { length: 10 }),

		procedureId: uuid("procedure_id").references(
			(): AnyPgColumn => procedures.id,
		),

		// Denormalized label captured at entry time so the chart renders
		// correctly even if the procedure is later renamed or deleted.
		procedureName: varchar("procedure_name", { length: 150 }).notNull(),

		notes: text("notes"),

		charge: numeric("charge", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),

		status: dentalChartStatus("status").notNull().default("PLANNED"),

		datePerformed: date("date_performed"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("dental_chart_entries_tenant_id_idx").on(table.tenantId),
		index("dental_chart_entries_tenant_patient_idx").on(
			table.tenantId,
			table.patientId,
		),
		index("dental_chart_entries_tenant_doctor_idx").on(
			table.tenantId,
			table.doctorId,
		),
		check(
			"dental_chart_entries_tooth_number_range",
			sql`"tooth_number" BETWEEN 1 AND 32`,
		),
		check("dental_chart_entries_charge_non_negative", sql`"charge" >= 0`),
		check(
			"dental_chart_entries_status_requires_date",
			sql`("status" = 'COMPLETED') = ("date_performed" IS NOT NULL)`,
		),
	],
);

// CLINICAL RECORDS

export const medicalRecords = pgTable(
	"medical_records",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		patientId: uuid("patient_id")
			.notNull()
			.references((): AnyPgColumn => patients.id),

		doctorId: uuid("doctor_id").references((): AnyPgColumn => doctors.id),

		appointmentId: uuid("appointment_id").references(
			(): AnyPgColumn => appointments.id,
		),

		chiefComplaint: text("chief_complaint"),
		diagnosis: text("diagnosis"),
		// Structured treatment detail lives in medical_record_procedures
		// below - this free-text field remains for narrative notes only.
		treatment: text("treatment"),
		notes: text("notes"),

		createdByUserId: uuid("created_by_user_id")
			.notNull()
			.references((): AnyPgColumn => users.id),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("medical_records_tenant_id_idx").on(table.tenantId),
		index("medical_records_tenant_patient_idx").on(
			table.tenantId,
			table.patientId,
		),
		index("medical_records_tenant_doctor_idx").on(
			table.tenantId,
			table.doctorId,
		),
		index("medical_records_appointment_id_idx").on(table.appointmentId),
	],
);

// TREATMENT / PROCEDURE CATALOG

export const procedures = pgTable(
	"procedures",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		code: varchar("code", { length: 50 }),

		name: varchar("name", { length: 255 }).notNull(),

		category: varchar("category", { length: 100 }),

		defaultPrice: numeric("default_price", { precision: 12, scale: 2 }),

		defaultDurationMinutes: integer("default_duration_minutes"),

		// Publishable service discount. With FIXED the value is a flat
		// amount; with PERCENTAGE it is a point value (<= 100) applied to
		// the default_price. NONE means the item is sold at full price.
		discountType: discountType("discount_type").notNull().default("NONE"),
		discountValue: numeric("discount_value", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),

		isActive: boolean("is_active").notNull().default(true),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("procedures_tenant_id_idx").on(table.tenantId),
		unique("procedures_tenant_code_unique").on(table.tenantId, table.code),
		index("procedures_tenant_is_active_idx").on(table.tenantId, table.isActive),
	],
);

export const medicalRecordProcedures = pgTable(
	"medical_record_procedures",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		medicalRecordId: uuid("medical_record_id")
			.notNull()
			.references((): AnyPgColumn => medicalRecords.id),

		procedureId: uuid("procedure_id")
			.notNull()
			.references((): AnyPgColumn => procedures.id),

		toothNumber: varchar("tooth_number", { length: 10 }),
		quadrant: varchar("quadrant", { length: 20 }),

		notes: text("notes"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("medical_record_procedures_tenant_id_idx").on(table.tenantId),
		index("medical_record_procedures_medical_record_id_idx").on(
			table.medicalRecordId,
		),
		index("medical_record_procedures_procedure_id_idx").on(table.procedureId),
		index("medical_record_procedures_tenant_record_idx").on(
			table.tenantId,
			table.medicalRecordId,
		),
	],
);

// BILLING

export const bills = pgTable(
	"bills",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		patientId: uuid("patient_id")
			.notNull()
			.references((): AnyPgColumn => patients.id),

		appointmentId: uuid("appointment_id").references(
			(): AnyPgColumn => appointments.id,
		),

		billNumber: varchar("bill_number", { length: 100 }).notNull(),

		status: billStatus("status").notNull().default("DRAFT"),

		subtotal: numeric("subtotal", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		discountAmount: numeric("discount_amount", {
			precision: 12,
			scale: 2,
		})
			.notNull()
			.default("0"),
		taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),

		notes: text("notes"),

		issuedAt: timestamp("issued_at", { withTimezone: true }),
		dueAt: timestamp("due_at", { withTimezone: true }),

		createdByUserId: uuid("created_by_user_id").references(
			(): AnyPgColumn => users.id,
		),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		unique("bills_tenant_bill_number_unique").on(
			table.tenantId,
			table.billNumber,
		),
		index("bills_tenant_id_idx").on(table.tenantId),
		index("bills_tenant_patient_idx").on(table.tenantId, table.patientId),
		index("bills_tenant_status_idx").on(table.tenantId, table.status),
		index("bills_tenant_created_at_idx").on(table.tenantId, table.createdAt),
		// Migration-only (not expressible in Drizzle's query builder):
		// CREATE INDEX idx_bills_tenant_active ON bills (tenant_id)
		//   WHERE deleted_at IS NULL;
	],
);

export const billItems = pgTable(
	"bill_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		billId: uuid("bill_id")
			.notNull()
			.references((): AnyPgColumn => bills.id),

		procedureId: uuid("procedure_id").references(
			(): AnyPgColumn => procedures.id,
		),

		description: text("description").notNull(),

		quantity: numeric("quantity", { precision: 10, scale: 2 })
			.notNull()
			.default("1"),
		unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
		discountAmount: numeric("discount_amount", {
			precision: 12,
			scale: 2,
		})
			.notNull()
			.default("0"),
		taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		totalAmount: numeric("total_amount", {
			precision: 12,
			scale: 2,
		}).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("bill_items_tenant_id_idx").on(table.tenantId),
		index("bill_items_bill_id_idx").on(table.billId),
		index("bill_items_tenant_bill_idx").on(table.tenantId, table.billId),
		index("bill_items_procedure_id_idx").on(table.procedureId),
	],
);

export const payments = pgTable(
	"payments",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		billId: uuid("bill_id").references((): AnyPgColumn => bills.id),

		txRef: varchar("tx_ref", { length: 100 }),
		chapaReference: varchar("chapa_reference", { length: 255 }),
		userId: uuid("user_id").references((): AnyPgColumn => users.id),
		patientId: uuid("patient_id").references((): AnyPgColumn => patients.id),
		purpose: paymentPurpose("purpose").notNull(),
		referenceId: uuid("reference_id"),
		baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull(),
		serviceCharge: numeric("service_charge", {
			precision: 12,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalAmount: numeric("total_amount", {
			precision: 12,
			scale: 2,
		}).notNull(),
		currency: varchar("currency", { length: 3 }).notNull().default("ETB"),

		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

		method: paymentMethod("method").notNull(),

		status: paymentStatus("status").notNull().default("PENDING"),

		reference: varchar("reference", { length: 255 }),

		checkoutUrl: varchar("checkout_url", { length: 1000 }),

		transferReference: varchar("transfer_reference", { length: 255 }),

		recordedByUserId: uuid("recorded_by").references(
			(): AnyPgColumn => users.id,
		),

		verifyPayload: jsonb("verify_payload").$type<Record<string, unknown>>(),

		expiresAt: timestamp("expires_at", { withTimezone: true }),

		paidAt: timestamp("paid_at", { withTimezone: true }),

		receivedByUserId: uuid("received_by_user_id").references(
			(): AnyPgColumn => users.id,
		),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("payments_tenant_id_idx").on(table.tenantId),
		index("payments_bill_id_idx").on(table.billId),
		index("payments_tenant_bill_idx").on(table.tenantId, table.billId),
		index("payments_tenant_status_idx").on(table.tenantId, table.status),
		index("payments_tenant_paid_at_idx").on(table.tenantId, table.paidAt),
		unique("payments_tx_ref_unique").on(table.txRef),
		index("payments_user_id_idx").on(table.userId),
		index("payments_status_idx").on(table.status),
		index("payments_method_idx").on(table.method),
		index("payments_purpose_idx").on(table.purpose),
		index("payments_created_at_idx").on(table.createdAt),
		check(
			"payments_total_matches_breakdown",
			sql`${table.amount} = ${table.totalAmount} AND ${table.baseAmount} + ${table.serviceCharge} = ${table.totalAmount}`,
		),
		check(
			"payments_amounts_non_negative",
			sql`${table.baseAmount} >= 0 AND ${table.serviceCharge} >= 0 AND ${table.totalAmount} >= 0`,
		),
	],
);

export const paymentEvents = pgTable(
	"payment_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),
		paymentId: uuid("payment_id")
			.notNull()
			.references((): AnyPgColumn => payments.id),
		type: paymentEventType("type").notNull(),
		payload: jsonb("payload").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("payment_events_tenant_id_idx").on(table.tenantId),
		index("payment_events_payment_id_created_at_idx").on(
			table.paymentId,
			table.createdAt,
		),
	],
);

// A gateway payment can settle more than one invoice when paying the
// patient's aggregate balance; allocations keep the existing per-bill ledger
// accurate without duplicating payment rows.
export const paymentAllocations = pgTable(
	"payment_allocations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),
		paymentId: uuid("payment_id")
			.notNull()
			.references((): AnyPgColumn => payments.id),
		billId: uuid("bill_id")
			.notNull()
			.references((): AnyPgColumn => bills.id),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("payment_allocations_tenant_id_idx").on(table.tenantId),
		index("payment_allocations_payment_id_idx").on(table.paymentId),
		index("payment_allocations_bill_id_idx").on(table.billId),
		check("payment_allocations_amount_positive", sql`${table.amount} > 0`),
	],
);

export const cardProducts = pgTable(
	"card_products",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),
		name: varchar("name", { length: 150 }).notNull(),
		description: text("description"),
		price: numeric("price", { precision: 12, scale: 2 }).notNull(),
		validityDays: integer("validity_days"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("card_products_tenant_active_idx").on(table.tenantId, table.isActive),
		check("card_products_price_non_negative", sql`${table.price} >= 0`),
		check(
			"card_products_validity_positive",
			sql`${table.validityDays} IS NULL OR ${table.validityDays} > 0`,
		),
	],
);

export const userCards = pgTable(
	"user_cards",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),
		userId: uuid("user_id")
			.notNull()
			.references((): AnyPgColumn => users.id),
		patientId: uuid("patient_id")
			.notNull()
			.references((): AnyPgColumn => patients.id),
		cardProductId: uuid("card_product_id")
			.notNull()
			.references((): AnyPgColumn => cardProducts.id),
		paymentId: uuid("payment_id").references((): AnyPgColumn => payments.id),
		status: cardPurchaseStatus("status").notNull().default("pending"),
		activatedAt: timestamp("activated_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("user_cards_tenant_user_idx").on(table.tenantId, table.userId),
		index("user_cards_tenant_patient_idx").on(table.tenantId, table.patientId),
		index("user_cards_payment_id_idx").on(table.paymentId),
	],
);

// AUDIT LOGGING

export const auditLogs = pgTable(
	"audit_logs",
	{
		// Consider UUID v7 for this high-write, append-only table
		// (insert-order locality avoids index bloat at scale) instead
		// of defaultRandom().
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		actorUserId: uuid("actor_user_id").references((): AnyPgColumn => users.id),

		action: auditAction("action").notNull(),

		scope: auditScope("scope").notNull().default("TENANT"),

		entityType: varchar("entity_type", { length: 100 }).notNull(),

		entityId: uuid("entity_id"),

		oldValues: jsonb("old_values"),
		newValues: jsonb("new_values"),

		ipAddress: varchar("ip_address", { length: 100 }),
		userAgent: text("user_agent"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("audit_logs_tenant_id_idx").on(table.tenantId),
		index("audit_logs_tenant_entity_idx").on(
			table.tenantId,
			table.entityType,
			table.entityId,
		),
		index("audit_logs_tenant_actor_idx").on(table.tenantId, table.actorUserId),
		index("audit_logs_tenant_created_at_idx").on(
			table.tenantId,
			table.createdAt,
		),
		// Consider a DB-level policy allowing INSERT-only from the app
		// role (no UPDATE/DELETE grants) to enforce append-only at the
		// database layer, not just the application layer.
	],
);

// NOTIFICATIONS

export const notifications = pgTable(
	"notifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		tenantId: uuid("tenant_id")
			.notNull()
			.references((): AnyPgColumn => tenants.id),

		userId: uuid("user_id").references((): AnyPgColumn => users.id),

		type: notificationType("type").notNull(),

		title: varchar("title", { length: 255 }).notNull(),
		message: text("message").notNull(),

		status: notificationStatus("status").notNull().default("UNREAD"),

		readAt: timestamp("read_at", { withTimezone: true }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("notifications_tenant_id_idx").on(table.tenantId),
		index("notifications_user_id_idx").on(table.userId),
		index("notifications_tenant_user_status_idx").on(
			table.tenantId,
			table.userId,
			table.status,
		),
		index("notifications_tenant_created_at_idx").on(
			table.tenantId,
			table.createdAt,
		),
	],
);

// INFERRED TYPES

export type TenantStatus = (typeof tenantStatus.enumValues)[number];
export type MembershipStatus = (typeof membershipStatus.enumValues)[number];
export type UserStatus = (typeof userStatus.enumValues)[number];
export type AppointmentStatus = (typeof appointmentStatus.enumValues)[number];
export type DentalChartStatus = (typeof dentalChartStatus.enumValues)[number];
export type DiscountType = (typeof discountType.enumValues)[number];
export type BillStatus = (typeof billStatus.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type PaymentPurpose = (typeof paymentPurpose.enumValues)[number];
export type PaymentEventType = (typeof paymentEventType.enumValues)[number];
export type CardPurchaseStatus = (typeof cardPurchaseStatus.enumValues)[number];
export type AuditAction = (typeof auditAction.enumValues)[number];
export type AuditScope = (typeof auditScope.enumValues)[number];
export type NotificationType = (typeof notificationType.enumValues)[number];
export type NotificationStatus = (typeof notificationStatus.enumValues)[number];

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type TenantSettings = typeof tenantSettings.$inferSelect;
export type NewTenantSettings = typeof tenantSettings.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;

export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;

export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

export type AppointmentStatusHistory =
	typeof appointmentStatusHistory.$inferSelect;
export type NewAppointmentStatusHistory =
	typeof appointmentStatusHistory.$inferInsert;

export type DoctorSchedule = typeof doctorSchedules.$inferSelect;
export type NewDoctorSchedule = typeof doctorSchedules.$inferInsert;

export type DentalChartEntry = typeof dentalChartEntries.$inferSelect;
export type NewDentalChartEntry = typeof dentalChartEntries.$inferInsert;

export type MedicalRecord = typeof medicalRecords.$inferSelect;
export type NewMedicalRecord = typeof medicalRecords.$inferInsert;

export type Procedure = typeof procedures.$inferSelect;
export type NewProcedure = typeof procedures.$inferInsert;

export type MedicalRecordProcedure =
	typeof medicalRecordProcedures.$inferSelect;
export type NewMedicalRecordProcedure =
	typeof medicalRecordProcedures.$inferInsert;

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

export type BillItem = typeof billItems.$inferSelect;
export type NewBillItem = typeof billItems.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type NewPaymentEvent = typeof paymentEvents.$inferInsert;

export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert;

export type CardProduct = typeof cardProducts.$inferSelect;
export type NewCardProduct = typeof cardProducts.$inferInsert;

export type UserCard = typeof userCards.$inferSelect;
export type NewUserCard = typeof userCards.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
