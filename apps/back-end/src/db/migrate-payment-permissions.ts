import { db } from "@/db";
import { permissions, rolePermissions, roles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const PAYMENT_PERMISSIONS = [
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
] satisfies Array<{
	name: string;
	resource: string;
	action: string;
	description: string;
}>;

// Which roles receive each permission. Missing roles (for example ADMIN, which
// existing migrations removed) are skipped so the script is safe to re-run.
const ROLE_GRANTS: Record<string, string[]> = {
	OWNER: ["payments.record", "payments.view_queue", "cards.manage"],
	RECEPTIONIST: ["payments.record", "payments.view_queue"],
	ACCOUNTANT: ["payments.view_queue"],
};

/** Idempotent: inserts payment permissions and grants them to roles. */
async function main() {
	const inserted = new Map<string, string>();
	for (const permission of PAYMENT_PERMISSIONS) {
		const [row] = await db
			.insert(permissions)
			.values(permission)
			.onConflictDoNothing({ target: permissions.name })
			.returning({ id: permissions.id, name: permissions.name });
		inserted.set(permission.name, row?.id ?? "");
	}
	const existing = await db
		.select({ id: permissions.id, name: permissions.name })
		.from(permissions)
		.where(
			inArray(
				permissions.name,
				PAYMENT_PERMISSIONS.map((p) => p.name),
			),
		);
	for (const row of existing) {
		inserted.set(row.name, row.id);
	}

	for (const [roleName, permissionNames] of Object.entries(ROLE_GRANTS)) {
		const [role] = await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, roleName))
			.limit(1);
		if (!role) continue;
		const grants = permissionNames
			.map((name) => inserted.get(name))
			.filter((permissionId): permissionId is string => Boolean(permissionId))
			.map((permissionId) => ({ roleId: role.id, permissionId }));
		if (grants.length > 0) {
			await db.insert(rolePermissions).values(grants).onConflictDoNothing();
		}
	}

	console.log(
		"✅ Payment permissions ensured for OWNER/RECEPTIONIST/ACCOUNTANT",
	);
}

main().catch((error) => {
	console.error("❌ Payment permission migration failed", error);
	process.exitCode = 1;
});
