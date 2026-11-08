import { db } from "@/db";
import {
	permissions,
	rolePermissions,
	roles,
	tenantMemberships,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/** Finalizes the Owner/Reception role split and removes legacy ADMIN access. */
async function main() {
	const [owner] = await db
		.select()
		.from(roles)
		.where(eq(roles.name, "OWNER"))
		.limit(1);
	const [legacyAdmin] = await db
		.select()
		.from(roles)
		.where(eq(roles.name, "ADMIN"))
		.limit(1);
	if (!owner)
		throw new Error("OWNER role is missing; run db:push:custom first");
	if (legacyAdmin)
		await db
			.update(tenantMemberships)
			.set({ roleId: owner.id })
			.where(eq(tenantMemberships.roleId, legacyAdmin.id));
	if (legacyAdmin) {
		await db
			.delete(rolePermissions)
			.where(eq(rolePermissions.roleId, legacyAdmin.id));
		await db.delete(roles).where(eq(roles.id, legacyAdmin.id));
	}

	const allPermissions = await db.select().from(permissions);
	const readPermissionIds = allPermissions
		.filter(
			(permission) =>
				permission.name.endsWith(".read") ||
				permission.name === "dashboard.read",
		)
		.map((permission) => permission.id);
	const ownerWriteNames = [
		"members.manage",
		"patients.create",
		"patients.update",
		"doctors.update",
		"schedules.manage",
	];
	const ownerPermissionIds = allPermissions
		.filter((permission) => ownerWriteNames.includes(permission.name))
		.map((permission) => permission.id);
	await db.delete(rolePermissions).where(eq(rolePermissions.roleId, owner.id));
	await db
		.insert(rolePermissions)
		.values(
			[...readPermissionIds, ...ownerPermissionIds].map((permissionId) => ({
				roleId: owner.id,
				permissionId,
			})),
		)
		.onConflictDoNothing();

	const [reception] = await db
		.select()
		.from(roles)
		.where(eq(roles.name, "RECEPTIONIST"))
		.limit(1);
	if (reception) {
		const names = [
			"doctors.read",
			"patients.read",
			"patients.create",
			"patients.update",
			"appointments.read",
			"appointments.create",
			"appointments.update",
			"bills.read",
			"bills.create",
			"reports.read",
			"dashboard.read",
			"schedules.read",
			"procedures.read",
		];
		await db
			.delete(rolePermissions)
			.where(eq(rolePermissions.roleId, reception.id));
		const ids = allPermissions
			.filter((permission) => names.includes(permission.name))
			.map((permission) => permission.id);
		await db
			.insert(rolePermissions)
			.values(
				ids.map((permissionId) => ({ roleId: reception.id, permissionId })),
			)
			.onConflictDoNothing();
	}

	const [doctor] = await db
		.select()
		.from(roles)
		.where(eq(roles.name, "DOCTOR"))
		.limit(1);
	if (doctor) {
		const doctorBlocked = allPermissions
			.filter((item) =>
				["doctors.update", "patients.update"].includes(item.name),
			)
			.map((item) => item.id);
		if (doctorBlocked.length)
			await db
				.delete(rolePermissions)
				.where(
					and(
						eq(rolePermissions.roleId, doctor.id),
						inArray(rolePermissions.permissionId, doctorBlocked),
					),
				);
	}
	console.log(
		"Role migration complete: OWNER manages staff, RECEPTIONIST manages operations, DOCTOR is read-only for profiles/patients.",
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
