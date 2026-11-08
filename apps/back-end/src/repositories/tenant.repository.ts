import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	tenants,
	tenantSettings,
	type Tenant,
	type NewTenant,
	type TenantSettings,
	type NewTenantSettings,
} from "@/db/schema";

export class TenantRepository {
	async findById(id: string): Promise<Tenant | null> {
		const [tenant] = await db
			.select()
			.from(tenants)
			.where(eq(tenants.id, id))
			.limit(1);
		return tenant ?? null;
	}

	async findBySlug(slug: string): Promise<Tenant | null> {
		const [tenant] = await db
			.select()
			.from(tenants)
			.where(eq(tenants.slug, slug))
			.limit(1);
		return tenant ?? null;
	}

	async createTenant(data: NewTenant): Promise<Tenant> {
		const [created] = await db.insert(tenants).values(data).returning();
		if (!created) throw new Error("Failed to create tenant");
		return created;
	}

	async createTenantSettings(data: NewTenantSettings): Promise<TenantSettings> {
		const [settings] = await db.insert(tenantSettings).values(data).returning();
		if (!settings) throw new Error("Failed to create tenant settings");
		return settings;
	}

	async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
		const [settings] = await db
			.select()
			.from(tenantSettings)
			.where(eq(tenantSettings.tenantId, tenantId))
			.limit(1);
		return settings ?? null;
	}

	async updateBranding(
		id: string,
		data: { logoUrl?: string | null; brandColor?: string },
	): Promise<Tenant | null> {
		const [updated] = await db
			.update(tenants)
			.set(data)
			.where(eq(tenants.id, id))
			.returning();
		return updated ?? null;
	}

	async listAll(): Promise<Tenant[]> {
		return db.select().from(tenants).orderBy(desc(tenants.createdAt));
	}

	async updateTenant(
		id: string,
		data: Partial<Pick<Tenant, "name" | "status" | "logoUrl" | "brandColor">>,
	): Promise<Tenant | null> {
		const [updated] = await db
			.update(tenants)
			.set(data)
			.where(eq(tenants.id, id))
			.returning();
		return updated ?? null;
	}
}

export const tenantRepository = new TenantRepository();
