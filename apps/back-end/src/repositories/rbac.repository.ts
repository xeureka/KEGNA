import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	roles,
	permissions,
	rolePermissions,
	type Role,
	type NewRole,
	type Permission,
	type NewPermission,
} from "@/db/schema";

export class RbacRepository {
	async findRoleByName(name: string): Promise<Role | null> {
		const [role] = await db
			.select()
			.from(roles)
			.where(eq(roles.name, name))
			.limit(1);
		return role ?? null;
	}

	async findRoleById(id: string): Promise<Role | null> {
		const [role] = await db
			.select()
			.from(roles)
			.where(eq(roles.id, id))
			.limit(1);
		return role ?? null;
	}

	async createRole(data: NewRole): Promise<Role> {
		const [role] = await db.insert(roles).values(data).returning();
		if (!role) throw new Error("Failed to create role");
		return role;
	}

	async findPermissionByName(name: string): Promise<Permission | null> {
		const [perm] = await db
			.select()
			.from(permissions)
			.where(eq(permissions.name, name))
			.limit(1);
		return perm ?? null;
	}

	async createPermission(data: NewPermission): Promise<Permission> {
		const [perm] = await db.insert(permissions).values(data).returning();
		if (!perm) throw new Error("Failed to create permission");
		return perm;
	}

	async assignPermissionToRole(
		roleId: string,
		permissionId: string,
	): Promise<void> {
		await db
			.insert(rolePermissions)
			.values({ roleId, permissionId })
			.onConflictDoNothing();
	}

	async getPermissionsForRole(roleId: string): Promise<Permission[]> {
		const rows = await db
			.select({
				id: permissions.id,
				name: permissions.name,
				resource: permissions.resource,
				action: permissions.action,
				description: permissions.description,
				createdAt: permissions.createdAt,
			})
			.from(rolePermissions)
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(eq(rolePermissions.roleId, roleId));

		return rows;
	}
}

export const rbacRepository = new RbacRepository();
