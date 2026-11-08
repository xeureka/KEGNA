import { db } from "@/db";
import { pool } from "@/db";
import { withDatabase } from "@/db/request-context";
import { applyPaymentMigration } from "@/db/payment-migration";
import {
	tenants,
	tenantSettings,
	roles,
	permissions,
	rolePermissions,
	tenantMemberships,
	doctors,
	patients,
	procedures,
	appointments,
	appointmentStatusHistory,
	medicalRecords,
	medicalRecordProcedures,
	doctorSchedules,
	dentalChartEntries,
	bills,
	billItems,
	payments,
	users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";

async function main() {
	console.log("🌱 Starting Nexa CRM Database Seeding...");
	// Seeding is a privileged local bootstrap operation. The application
	// schema force-enables RLS, so establish the same explicit context that a
	// Super Admin request uses before inserting cross-tenant fixture data.
	await db.execute(sql`select set_config('app.is_super_admin', 'true', false)`);
	await db.execute(sql`select set_config('app.tenant_id', '', false)`);
	await db.execute(sql`select set_config('app.user_id', '', false)`);

	// Ensure the payment ledger exists before clearing it; the payment tables
	// are created by the idempotent Chapa migration rather than a journal.
	await applyPaymentMigration();

	console.log("🧹 Clearing existing seeded tables...");
	// The application role intentionally has CRUD privileges, not TRUNCATE
	// ownership. Delete in dependency order so `pnpm seed` works against both
	// the local database and a database provisioned by a separate owner role.
	await db.execute(sql`DELETE FROM payment_events`);
	await db.execute(sql`DELETE FROM payment_allocations`);
	await db.execute(sql`DELETE FROM user_cards`);
	await db.execute(sql`DELETE FROM card_products`);
	// appointments.payment_id references payments, so break the link first.
	await db.execute(
		sql`UPDATE appointments SET payment_id = NULL WHERE payment_id IS NOT NULL`,
	);
	await db.execute(sql`DELETE FROM payments`);
	await db.execute(sql`DELETE FROM bill_items`);
	await db.execute(sql`DELETE FROM bills`);
	await db.execute(sql`DELETE FROM medical_record_procedures`);
	await db.execute(sql`DELETE FROM medical_records`);
	await db.execute(sql`DELETE FROM dental_chart_entries`);
	await db.execute(sql`DELETE FROM appointment_status_history`);
	await db.execute(sql`DELETE FROM appointments`);
	await db.execute(sql`DELETE FROM doctor_schedules`);
	await db.execute(sql`DELETE FROM procedures`);
	await db.execute(sql`DELETE FROM patients`);
	await db.execute(sql`DELETE FROM doctors`);
	await db.execute(sql`DELETE FROM tenant_memberships`);
	await db.execute(sql`DELETE FROM role_permissions`);
	await db.execute(sql`DELETE FROM permissions`);
	await db.execute(sql`DELETE FROM roles`);
	await db.execute(sql`DELETE FROM accounts`);
	await db.execute(sql`DELETE FROM sessions`);
	await db.execute(sql`DELETE FROM verifications`);
	await db.execute(sql`DELETE FROM notifications`);
	await db.execute(sql`DELETE FROM audit_logs`);
	await db.execute(sql`DELETE FROM tenant_settings`);
	await db.execute(sql`DELETE FROM tenants`);
	await db.execute(sql`DELETE FROM users`);

	console.log("🔐 Creating Permissions...");
	const basePermissions = [
		{
			name: "patients.read",
			resource: "patients",
			action: "read",
			description: "View patient records",
		},
		{
			name: "patients.create",
			resource: "patients",
			action: "create",
			description: "Create patient records",
		},
		{
			name: "patients.update",
			resource: "patients",
			action: "update",
			description: "Update patient records",
		},
		{
			name: "patients.delete",
			resource: "patients",
			action: "delete",
			description: "Delete patient records",
		},
		{
			name: "appointments.read",
			resource: "appointments",
			action: "read",
			description: "View appointments",
		},
		{
			name: "appointments.create",
			resource: "appointments",
			action: "create",
			description: "Schedule appointments",
		},
		{
			name: "appointments.update",
			resource: "appointments",
			action: "update",
			description: "Update appointments",
		},
		{
			name: "appointments.delete",
			resource: "appointments",
			action: "delete",
			description: "Cancel appointments",
		},
		{
			name: "medical_records.read",
			resource: "medical_records",
			action: "read",
			description: "View medical records",
		},
		{
			name: "medical_records.create",
			resource: "medical_records",
			action: "create",
			description: "Create medical records",
		},
		{
			name: "bills.read",
			resource: "bills",
			action: "read",
			description: "View billing records",
		},
		{
			name: "bills.create",
			resource: "bills",
			action: "create",
			description: "Create bills and payments",
		},
		{
			name: "payments.record",
			resource: "payments",
			action: "record",
			description: "Record reception cash or mobile-transfer payments",
		},
		{
			name: "payments.view_queue",
			resource: "payments",
			action: "view_queue",
			description: "View the tenant payment queue and summaries",
		},
		{
			name: "cards.manage",
			resource: "cards",
			action: "manage",
			description: "Manage the membership card catalog",
		},
		{
			name: "settings.manage",
			resource: "settings",
			action: "manage",
			description: "Manage tenant settings",
		},
		{
			name: "doctors.read",
			resource: "doctors",
			action: "read",
			description: "View doctor profiles",
		},
		{
			name: "doctors.update",
			resource: "doctors",
			action: "update",
			description: "Update doctor profiles",
		},
		{
			name: "procedures.read",
			resource: "procedures",
			action: "read",
			description: "View the procedure catalog",
		},
		{
			name: "procedures.create",
			resource: "procedures",
			action: "create",
			description: "Create procedure catalog entries",
		},
		{
			name: "procedures.update",
			resource: "procedures",
			action: "update",
			description: "Update procedure catalog entries",
		},
		{
			name: "dental_chart.read",
			resource: "dental_chart",
			action: "read",
			description: "View dental chart entries",
		},
		{
			name: "dental_chart.create",
			resource: "dental_chart",
			action: "create",
			description: "Add dental chart entries",
		},
		{
			name: "dental_chart.update",
			resource: "dental_chart",
			action: "update",
			description: "Update dental chart entries",
		},
		{
			name: "schedules.read",
			resource: "schedules",
			action: "read",
			description: "View doctor schedules",
		},
		{
			name: "schedules.manage",
			resource: "schedules",
			action: "manage",
			description: "Manage doctor schedules",
		},
		{
			name: "reports.read",
			resource: "reports",
			action: "read",
			description: "View tenant reports",
		},
		{
			name: "members.read",
			resource: "members",
			action: "read",
			description: "View tenant members",
		},
		{
			name: "members.manage",
			resource: "members",
			action: "manage",
			description: "Manage tenant member roles",
		},
		{
			name: "audit_logs.read",
			resource: "audit_logs",
			action: "read",
			description: "View audit logs",
		},
		{
			name: "dashboard.read",
			resource: "dashboard",
			action: "read",
			description: "View the tenant dashboard",
		},
	];

	const createdPermsMap = new Map<string, string>();
	for (const perm of basePermissions) {
		const [inserted] = await db.insert(permissions).values(perm).returning();
		if (!inserted) throw new Error(`Failed to insert permission ${perm.name}`);
		createdPermsMap.set(perm.name, inserted.id);
	}

	console.log("🎭 Creating Roles...");
	const [ownerRole] = await db
		.insert(roles)
		.values({
			name: "OWNER",
			description: "Full tenant administration access",
		})
		.returning();
	if (!ownerRole) throw new Error("Failed to create OWNER role");

	const [doctorRole] = await db
		.insert(roles)
		.values({
			name: "DOCTOR",
			description: "Clinical access for dental staff",
		})
		.returning();
	if (!doctorRole) throw new Error("Failed to create DOCTOR role");

	const [receptionistRole] = await db
		.insert(roles)
		.values({
			name: "RECEPTIONIST",
			description: "Front desk scheduling and patient intake",
		})
		.returning();
	if (!receptionistRole) throw new Error("Failed to create RECEPTIONIST role");

	const [adminRole] = await db
		.insert(roles)
		.values({
			name: "ADMIN",
			description: "Full clinic administration (no destructive actions)",
		})
		.returning();
	if (!adminRole) throw new Error("Failed to create ADMIN role");

	const [accountantRole] = await db
		.insert(roles)
		.values({
			name: "ACCOUNTANT",
			description: "Billing and reporting access",
		})
		.returning();
	if (!accountantRole) throw new Error("Failed to create ACCOUNTANT role");

	const [patientRole] = await db
		.insert(roles)
		.values({
			name: "PATIENT",
			description: "Patient mobile access",
		})
		.returning();
	if (!patientRole) throw new Error("Failed to create PATIENT role");

	const superAdminAuth = await auth.api.signUpEmail({
		body: {
			email: "superadmin@nexa.local",
			password: "SuperAdminPassw0rd!2026",
			name: "Nexa Platform Super Admin",
		},
	});
	await db
		.update(users)
		.set({ isSuperAdmin: true })
		.where(sql`id = ${superAdminAuth.user.id}`);

	const rolePermsToInsert = [
		...Array.from(createdPermsMap.values()).map((pId) => ({
			roleId: ownerRole.id,
			permissionId: pId,
		})),
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("patients.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("patients.update")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("appointments.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("appointments.create")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("appointments.update")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("medical_records.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("medical_records.create")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("doctors.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("doctors.update")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("procedures.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("dental_chart.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("dental_chart.create")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("dental_chart.update")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("schedules.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("reports.read")!,
		},
		{
			roleId: doctorRole.id,
			permissionId: createdPermsMap.get("dashboard.read")!,
		},
		{
			roleId: patientRole.id,
			permissionId: createdPermsMap.get("doctors.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("patients.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("patients.create")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("patients.update")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("appointments.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("appointments.create")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("appointments.update")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("bills.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("bills.create")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("doctors.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("procedures.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("schedules.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("reports.read")!,
		},
		{
			roleId: receptionistRole.id,
			permissionId: createdPermsMap.get("dashboard.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("patients.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("patients.create")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("patients.update")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("appointments.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("appointments.create")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("appointments.update")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("medical_records.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("medical_records.create")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("bills.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("bills.create")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("doctors.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("doctors.update")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("procedures.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("procedures.create")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("procedures.update")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("dental_chart.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("dental_chart.create")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("dental_chart.update")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("schedules.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("schedules.manage")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("reports.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("members.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("members.manage")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("audit_logs.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("dashboard.read")!,
		},
		{
			roleId: adminRole.id,
			permissionId: createdPermsMap.get("settings.manage")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("bills.read")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("bills.create")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("patients.read")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("appointments.read")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("medical_records.read")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("procedures.read")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("reports.read")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("audit_logs.read")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("payments.view_queue")!,
		},
		{
			roleId: accountantRole.id,
			permissionId: createdPermsMap.get("dashboard.read")!,
		},
	];

	await db.insert(rolePermissions).values(rolePermsToInsert);

	// OWNER is intentionally read-mostly. Keep this normalization after the
	// legacy permission list above so re-seeding cannot accidentally restore
	// Reception's write permissions to the Owner role.
	await db
		.delete(rolePermissions)
		.where(eq(rolePermissions.roleId, ownerRole.id));
	const ownerReadPermissions = [...createdPermsMap.entries()]
		.filter(([name]) => name.endsWith(".read") || name === "dashboard.read")
		.map(([, permissionId]) => ({ roleId: ownerRole.id, permissionId }));
	const ownerWritePermissions = [
		"members.manage",
		"patients.create",
		"patients.update",
		"doctors.update",
		"schedules.manage",
		"payments.record",
		"payments.view_queue",
		"cards.manage",
	]
		.map((name) => createdPermsMap.get(name))
		.filter((permissionId): permissionId is string => Boolean(permissionId))
		.map((permissionId) => ({ roleId: ownerRole.id, permissionId }));
	await db
		.insert(rolePermissions)
		.values([...ownerReadPermissions, ...ownerWritePermissions])
		.onConflictDoNothing();
	const receptionPermissions = [
		"doctors.read",
		"patients.read",
		"patients.create",
		"patients.update",
		"appointments.read",
		"appointments.create",
		"appointments.update",
		"bills.read",
		"bills.create",
		"payments.record",
		"payments.view_queue",
		"reports.read",
		"dashboard.read",
		"schedules.read",
		"procedures.read",
	]
		.map((name) => createdPermsMap.get(name))
		.filter((permissionId): permissionId is string => Boolean(permissionId))
		.map((permissionId) => ({ roleId: receptionistRole.id, permissionId }));
	await db
		.delete(rolePermissions)
		.where(eq(rolePermissions.roleId, receptionistRole.id));
	await db
		.insert(rolePermissions)
		.values(receptionPermissions)
		.onConflictDoNothing();
	for (const permissionName of ["doctors.update", "patients.update"]) {
		const permissionId = createdPermsMap.get(permissionName);
		if (permissionId) {
			await db
				.delete(rolePermissions)
				.where(
					and(
						eq(rolePermissions.roleId, doctorRole.id),
						eq(rolePermissions.permissionId, permissionId),
					),
				);
		}
	}
	await db
		.delete(rolePermissions)
		.where(eq(rolePermissions.roleId, adminRole.id));
	await db.delete(roles).where(eq(roles.id, adminRole.id));

	const tenantConfigs = [
		{
			id: "0ef815bd-15c3-4aff-b434-095ba4e5ad1a",
			name: "Ahadu Dental",
			slug: "ahadu-dental",
			timezone: "Africa/Addis_Ababa",
			currency: "ETB",
			ownerName: "Ahadu Dental Owner",
			ownerEmail: "owner@ahadudental.com",
		},
		{
			name: "Apex Dental Specialists",
			slug: "apex-dental",
			timezone: "Europe/London",
			currency: "GBP",
			ownerName: "Dr. Arthur Pendelton",
			ownerEmail: "owner@apexdental.co.uk",
		},
		{
			name: "Harbor Light Dental",
			slug: "harbor-light",
			timezone: "Australia/Sydney",
			currency: "AUD",
			ownerName: "Dr. Liam O'Connor",
			ownerEmail: "owner@harborlightdental.com.au",
		},
		{
			name: "Addis Dental Center",
			slug: "addis-dental",
			timezone: "Africa/Addis_Ababa",
			currency: "ETB",
			ownerName: "Dr. Aster Bekele",
			ownerEmail: "owner@addisdental.et",
		},
		{
			name: "Tokyo Dental Care Center",
			slug: "tokyo-dental",
			timezone: "Asia/Tokyo",
			currency: "JPY",
			ownerName: "Dr. Kenji Sato",
			ownerEmail: "owner@tokyodental.jp",
		},
		{
			name: "Berlin Zahnklinik Center",
			slug: "berlin-zahn",
			timezone: "Europe/Berlin",
			currency: "EUR",
			ownerName: "Dr. Hans Mueller",
			ownerEmail: "owner@berlinzahn.de",
		},
		{
			name: "Toronto Family Dental",
			slug: "toronto-dental",
			timezone: "America/Toronto",
			currency: "CAD",
			ownerName: "Dr. Emily Wong",
			ownerEmail: "owner@torontofamilydental.ca",
		},
	];

	const defaultPassword = "Password123!";
	const summary: Array<{
		tenantName: string;
		slug: string;
		timezone: string;
		currency: string;
		usersCount: number;
		doctorsCount: number;
		patientsCount: number;
		appointmentsCount: number;
		billsCount: number;
	}> = [];

	for (const config of tenantConfigs) {
		const [tenant] = await db
			.insert(tenants)
			.values({
				...(config.id ? { id: config.id } : {}),
				name: config.name,
				slug: config.slug,
				status: "ACTIVE",
			})
			.returning();
		if (!tenant) throw new Error(`Failed to insert tenant ${config.slug}`);

		await db.insert(tenantSettings).values({
			tenantId: tenant.id,
			timezone: config.timezone,
			currency: config.currency,
			defaultAppointmentDuration: 45,
			allowOnlineBooking: true,
		});

		const ownerAuthRes = await auth.api.signUpEmail({
			body: {
				email: config.ownerEmail,
				password: defaultPassword,
				name: config.ownerName,
			},
		});
		const ownerUserId = ownerAuthRes.user.id;

		await db.insert(tenantMemberships).values({
			tenantId: tenant.id,
			userId: ownerUserId,
			roleId: ownerRole.id,
			status: "ACTIVE",
			joinedAt: new Date(),
		});

		const doctorUsers = [];
		const docCount =
			config.slug === "ahadu-dental" || config.slug === "apex-dental" ? 2 : 1;
		for (let i = 1; i <= docCount; i++) {
			const docEmail = `doctor${i}@${config.slug}.com`;
			const docName = `Dr. Doctor ${i} (${config.name})`;
			const docRes = await auth.api.signUpEmail({
				body: {
					email: docEmail,
					password: defaultPassword,
					name: docName,
				},
			});

			await db.insert(tenantMemberships).values({
				tenantId: tenant.id,
				userId: docRes.user.id,
				roleId: doctorRole.id,
				status: "ACTIVE",
				joinedAt: new Date(),
			});

			const [doctor] = await db
				.insert(doctors)
				.values({
					tenantId: tenant.id,
					userId: docRes.user.id,
					licenseNumber: `LIC-${config.slug.toUpperCase()}-${100 + i}`,
					specialization: i === 1 ? "General Dentistry" : "Orthodontics",
					isAvailable: true,
				})
				.returning();
			if (!doctor)
				throw new Error(`Failed to insert doctor for ${config.slug}`);

			doctorUsers.push(doctor);
		}

		const receptionistCount = 1;
		for (let i = 1; i <= receptionistCount; i++) {
			const recepEmail = `receptionist${i}@${config.slug}.com`;
			const recepName = `Receptionist ${i} (${config.name})`;
			const recepRes = await auth.api.signUpEmail({
				body: {
					email: recepEmail,
					password: defaultPassword,
					name: recepName,
				},
			});

			await db.insert(tenantMemberships).values({
				tenantId: tenant.id,
				userId: recepRes.user.id,
				roleId: receptionistRole.id,
				status: "ACTIVE",
				joinedAt: new Date(),
			});
		}

		if (config.slug === "ahadu-dental") {
			const demoStaff = [
				{
					email: "admin@ahadudental.local",
					password: "AdminPassw0rd!2026",
					name: "Clinic Administrator",
					roleId: ownerRole.id,
				},
				{
					email: "frontdesk@ahadudental.local",
					password: "FrontDeskPassw0rd!2026",
					name: "Front Desk Coordinator",
					roleId: receptionistRole.id,
				},
			] as const;

			for (const staff of demoStaff) {
				const demoRes = await auth.api.signUpEmail({
					body: {
						email: staff.email,
						password: staff.password,
						name: staff.name,
					},
				});
				await db.insert(tenantMemberships).values({
					tenantId: tenant.id,
					userId: demoRes.user.id,
					roleId: staff.roleId,
					status: "ACTIVE",
					joinedAt: new Date(),
				});
			}

			const owenRes = await auth.api.signUpEmail({
				body: {
					email: "doctor.demo@ahadudental.local",
					password: "DoctorPassw0rd!2026",
					name: "Dr. Owen Reyes",
				},
			});
			await db.insert(tenantMemberships).values({
				tenantId: tenant.id,
				userId: owenRes.user.id,
				roleId: doctorRole.id,
				status: "ACTIVE",
				joinedAt: new Date(),
			});
			const [owenDoctor] = await db
				.insert(doctors)
				.values({
					tenantId: tenant.id,
					userId: owenRes.user.id,
					licenseNumber: "LIC-AHADU-DEMO-001",
					specialization: "Orthodontics",
					isAvailable: true,
				})
				.returning();
			if (owenDoctor) doctorUsers.push(owenDoctor);
		}

		for (const doctor of doctorUsers) {
			for (const dayOfWeek of [1, 2, 3, 4, 5]) {
				await db.insert(doctorSchedules).values({
					tenantId: tenant.id,
					doctorId: doctor.id,
					dayOfWeek,
					startTime: "09:00",
					endTime: "17:00",
					isAvailable: true,
				});
			}
		}

		const patientList = [];
		const patientCount = 6;
		for (let p = 1; p <= patientCount; p++) {
			const [patient] = await db
				.insert(patients)
				.values({
					tenantId: tenant.id,
					patientNumber: `PAT-${config.slug.toUpperCase()}-${1000 + p}`,
					firstName: `PatientFirstName${p}`,
					lastName: `PatientLastName${p}`,
					email: `patient${p}@${config.slug}.com`,
					phone: `+1555000${config.slug.length}${p}`,
					dateOfBirth: `198${p}-0${(p % 9) + 1}-15`,
					gender: p % 2 === 0 ? "Female" : "Male",
				})
				.returning();
			if (!patient)
				throw new Error(`Failed to insert patient for ${config.slug}`);
			patientList.push(patient);
		}

		const [proc1] = await db
			.insert(procedures)
			.values({
				tenantId: tenant.id,
				code: "PROC-01",
				name: "Routine Dental Exam & Cleaning",
				category: "Preventive",
				defaultPrice: "120.00",
				defaultDurationMinutes: 45,
				isActive: true,
			})
			.returning();
		if (!proc1) throw new Error(`Failed to insert proc1 for ${config.slug}`);

		const [proc2] = await db
			.insert(procedures)
			.values({
				tenantId: tenant.id,
				code: "PROC-02",
				name: "Composite Tooth Filling",
				category: "Restorative",
				defaultPrice: "250.00",
				defaultDurationMinutes: 60,
				isActive: true,
			})
			.returning();
		if (!proc2) throw new Error(`Failed to insert proc2 for ${config.slug}`);

		const apptStatuses = [
			"SCHEDULED",
			"CONFIRMED",
			"CHECKED_IN",
			"IN_PROGRESS",
			"COMPLETED",
			"CANCELLED",
		] as const;

		const createdAppts = [];
		for (let a = 0; a < patientList.length; a++) {
			const assignedDoc = doctorUsers[a % doctorUsers.length];
			const status = apptStatuses[a % apptStatuses.length]!;
			const startTime = new Date(Date.now() + (a - 3) * 24 * 60 * 60 * 1000);
			const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);

			const apptValues = {
				tenantId: tenant.id,
				patientId: patientList[a]!.id,
				doctorId: assignedDoc!.id,
				startAt: startTime,
				endAt: endTime,
				status: status,
				reason:
					a % 2 === 0
						? "Regular checkup and cleaning"
						: "Tooth sensitivity and pain",
				notes: `Appointment note for ${status} status`,
				...(status === "CANCELLED"
					? {
							cancelledAt: new Date(startTime.getTime() - 60 * 60 * 1000),
							cancelledReason: "Patient cancelled due to scheduling conflict",
						}
					: {}),
			};

			const [appt] = await db
				.insert(appointments)
				.values(apptValues)
				.returning();
			if (!appt) throw new Error(`Failed to insert appt for ${config.slug}`);
			createdAppts.push(appt);

			await db.insert(appointmentStatusHistory).values({
				tenantId: tenant.id,
				appointmentId: appt.id,
				newStatus: status,
				changedByUserId: ownerUserId,
				reason: `Seeded initial appointment at ${status}`,
				changedAt: startTime,
			});

			if (status === "COMPLETED" || status === "IN_PROGRESS") {
				const [medRecord] = await db
					.insert(medicalRecords)
					.values({
						tenantId: tenant.id,
						patientId: patientList[a]!.id,
						doctorId: assignedDoc!.id,
						appointmentId: appt.id,
						chiefComplaint: "Tooth pain on upper left quadrant",
						diagnosis: "Localized dental caries on tooth #14",
						treatment:
							"Administered local anesthesia and placed composite resin filling.",
						createdByUserId: ownerUserId,
					})
					.returning();
				if (medRecord) {
					await db.insert(medicalRecordProcedures).values({
						tenantId: tenant.id,
						medicalRecordId: medRecord.id,
						procedureId: proc2.id,
						toothNumber: "14",
						quadrant: "Upper Left",
					});
				}
			}

			if (status === "COMPLETED") {
				await db.insert(dentalChartEntries).values({
					tenantId: tenant.id,
					patientId: patientList[a]!.id,
					doctorId: assignedDoc!.id,
					appointmentId: appt.id,
					toothNumber: 14,
					surface: "O",
					procedureId: proc2.id,
					procedureName: proc2.name,
					notes: "Composite filling placed (seeded chart entry).",
					charge: proc2.defaultPrice!,
					status: "COMPLETED",
					datePerformed: startTime.toISOString().slice(0, 10),
				});
			}
		}

		const billStatuses = [
			"DRAFT",
			"PENDING",
			"PARTIALLY_PAID",
			"PAID",
			"CANCELLED",
		] as const;
		for (let b = 0; b < 5; b++) {
			const patient = patientList[b]!;
			const bStatus = billStatuses[b % billStatuses.length];
			const subtotal = "370.00";
			const totalAmount = "370.00";

			const [bill] = await db
				.insert(bills)
				.values({
					tenantId: tenant.id,
					patientId: patient.id,
					appointmentId: createdAppts[b]?.id,
					billNumber: `INV-${config.slug.toUpperCase()}-000${b + 1}`,
					status: bStatus,
					subtotal,
					totalAmount,
					issuedAt: new Date(),
					createdByUserId: ownerUserId,
				})
				.returning();
			if (!bill) throw new Error(`Failed to insert bill for ${config.slug}`);

			await db.insert(billItems).values({
				tenantId: tenant.id,
				billId: bill.id,
				procedureId: proc1.id,
				description: proc1.name,
				quantity: "1",
				unitPrice: proc1.defaultPrice!,
				totalAmount: proc1.defaultPrice!,
			});

			await db.insert(billItems).values({
				tenantId: tenant.id,
				billId: bill.id,
				procedureId: proc2.id,
				description: proc2.name,
				quantity: "1",
				unitPrice: proc2.defaultPrice!,
				totalAmount: proc2.defaultPrice!,
			});

			if (bStatus === "PAID" || bStatus === "PARTIALLY_PAID") {
				const payAmount = bStatus === "PAID" ? "370.00" : "150.00";
				await db.insert(payments).values({
					tenantId: tenant.id,
					billId: bill.id,
					amount: payAmount,
					baseAmount: payAmount,
					serviceCharge: "0",
					totalAmount: payAmount,
					currency: "ETB",
					purpose: "balance",
					method: "CARD",
					status: "COMPLETED",
					reference: `PAY-REF-${b + 100}`,
					paidAt: new Date(),
					receivedByUserId: ownerUserId,
				});
			}
		}

		summary.push({
			tenantName: config.name,
			slug: config.slug,
			timezone: config.timezone,
			currency: config.currency,
			usersCount:
				1 +
				docCount +
				receptionistCount +
				(config.slug === "ahadu-dental" ? 3 : 0),
			doctorsCount: docCount,
			patientsCount: patientCount,
			appointmentsCount: createdAppts.length,
			billsCount: 5,
		});
	}

	// Tenants now exist, so re-applying the migration fills each tenant's
	// `card_products` catalog from the server-side tier definitions.
	await applyPaymentMigration();

	console.log("\n=======================================================");
	console.log("✅ SEED SUMMARY BY TENANT");
	console.log("=======================================================");
	console.table(summary);
	console.log("🎉 Seeding completed successfully!");
	console.log("\nDemo credentials:");
	console.log("Super Admin: superadmin@nexa.local / SuperAdminPassw0rd!2026");
	console.log("Ahadu Admin: admin@ahadudental.local / AdminPassw0rd!2026");
	console.log(
		"Ahadu Reception: frontdesk@ahadudental.local / FrontDeskPassw0rd!2026",
	);
	console.log(
		"Ahadu Doctor: doctor.demo@ahadudental.local / DoctorPassw0rd!2026",
	);
	console.log("Clinic login: http://localhost:5173/login?tenant=ahadu-dental");
	console.log("Super Admin login: http://localhost:5173/login");
}

db.transaction(async (tx) => {
	await tx.execute(sql`select set_config('app.is_super_admin', 'true', true)`);
	await tx.execute(sql`select set_config('app.tenant_id', '', true)`);
	await tx.execute(sql`select set_config('app.user_id', '', true)`);
	return withDatabase(tx, main);
})
	.then(() => pool.end())
	.catch(async (err) => {
		console.error("❌ Seeding failed:", err);
		await pool.end();
		process.exit(1);
	});
