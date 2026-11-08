import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
	tenantMemberships,
	users,
	roles,
	tenants,
	type TenantMembership,
	type NewTenantMembership,
	type MembershipStatus,
} from "@/db/schema";

export interface MembershipWithUser extends TenantMembership {
	userName: string;
	userEmail: string;
	roleName: string;
}

export interface PlatformUserRow {
	userId: string;
	userName: string;
	userEmail: string;
	userStatus: string;
	roleName: string;
	membershipStatus: string;
	tenantId: string;
	tenantName: string;
	tenantSlug: string;
}

export class MembershipRepository {
	async findActiveMembership(
		tenantId: string,
		userId: string,
	): Promise<TenantMembership | null> {
		const [membership] = await db
			.select()
			.from(tenantMemberships)
			.where(
				and(
					eq(tenantMemberships.tenantId, tenantId),
					eq(tenantMemberships.userId, userId),
					eq(tenantMemberships.status, "ACTIVE"),
				),
			)
			.limit(1);

		return membership ?? null;
	}

	async findMembership(
		tenantId: string,
		userId: string,
	): Promise<TenantMembership | null> {
		const [membership] = await db
			.select()
			.from(tenantMemberships)
			.where(
				and(
					eq(tenantMemberships.tenantId, tenantId),
					eq(tenantMemberships.userId, userId),
				),
			)
			.limit(1);

		return membership ?? null;
	}

	async findById(id: string): Promise<TenantMembership | null> {
		const [membership] = await db
			.select()
			.from(tenantMemberships)
			.where(eq(tenantMemberships.id, id))
			.limit(1);

		return membership ?? null;
	}

	async createMembership(
		tenantId: string,
		data: Omit<NewTenantMembership, "tenantId">,
	): Promise<TenantMembership> {
		const [created] = await db
			.insert(tenantMemberships)
			.values({ ...data, tenantId })
			.returning();

		if (!created) throw new Error("Failed to create membership");
		return created;
	}

	async updateMembership(
		id: string,
		data: Partial<Omit<NewTenantMembership, "tenantId">>,
	): Promise<TenantMembership | null> {
		const [updated] = await db
			.update(tenantMemberships)
			.set(data)
			.where(eq(tenantMemberships.id, id))
			.returning();

		return updated ?? null;
	}

	async setStatus(
		id: string,
		status: MembershipStatus,
	): Promise<TenantMembership | null> {
		return this.updateMembership(id, { status });
	}

	async listMembershipsByUser(userId: string): Promise<TenantMembership[]> {
		return db
			.select()
			.from(tenantMemberships)
			.where(eq(tenantMemberships.userId, userId));
	}

	async listMembershipsByTenant(tenantId: string): Promise<TenantMembership[]> {
		return db
			.select()
			.from(tenantMemberships)
			.where(eq(tenantMemberships.tenantId, tenantId));
	}

	/** All tenant members with user + role detail, for staff management. */
	async listWithDetails(tenantId: string): Promise<MembershipWithUser[]> {
		const rows = await db
			.select({
				membership: tenantMemberships,
				userName: users.name,
				userEmail: users.email,
				roleName: roles.name,
			})
			.from(tenantMemberships)
			.innerJoin(users, eq(tenantMemberships.userId, users.id))
			.innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
			.where(eq(tenantMemberships.tenantId, tenantId))
			.orderBy(users.name);

		return rows.map((row) => ({
			...row.membership,
			userName: row.userName,
			userEmail: row.userEmail,
			roleName: row.roleName,
		}));
	}

	async listPlatformUsers(filters: {
		tenantId?: string;
		name?: string;
		role?: string;
		status?: string;
	}): Promise<PlatformUserRow[]> {
		const conditions = [];
		if (filters.tenantId)
			conditions.push(eq(tenantMemberships.tenantId, filters.tenantId));
		if (filters.name) conditions.push(ilike(users.name, `%${filters.name}%`));
		if (filters.role) conditions.push(eq(roles.name, filters.role));
		if (filters.status)
			conditions.push(
				eq(tenantMemberships.status, filters.status as MembershipStatus),
			);
		const rows = await db
			.select({
				userId: users.id,
				userName: users.name,
				userEmail: users.email,
				userStatus: users.status,
				roleName: roles.name,
				membershipStatus: tenantMemberships.status,
				tenantId: tenants.id,
				tenantName: tenants.name,
				tenantSlug: tenants.slug,
			})
			.from(tenantMemberships)
			.innerJoin(users, eq(tenantMemberships.userId, users.id))
			.innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
			.innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
			.where(conditions.length ? and(...conditions) : undefined)
			.orderBy(users.name, tenants.name);
		return rows;
	}
}

export const membershipRepository = new MembershipRepository();
export type { MembershipStatus };
