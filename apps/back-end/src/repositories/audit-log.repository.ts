import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, type AuditLog, type NewAuditLog } from "@/db/schema";

export interface AuditLogListParams {
	tenantId: string;
	limit: number;
	offset: number;
	entityType?: string;
	action?: string;
}

export class AuditLogRepository {
	async insert(data: NewAuditLog): Promise<AuditLog> {
		const [log] = await db.insert(auditLogs).values(data).returning();
		if (!log) throw new Error("Failed to write audit log");
		return log;
	}

	async list(params: AuditLogListParams): Promise<AuditLog[]> {
		const conditions: SQL[] = [eq(auditLogs.tenantId, params.tenantId)];
		if (params.entityType) {
			conditions.push(eq(auditLogs.entityType, params.entityType));
		}
		if (params.action) {
			conditions.push(eq(auditLogs.action, params.action as never));
		}

		return db
			.select()
			.from(auditLogs)
			.where(and(...conditions))
			.orderBy(desc(auditLogs.createdAt))
			.limit(params.limit)
			.offset(params.offset);
	}

	async count(
		params: Omit<AuditLogListParams, "limit" | "offset">,
	): Promise<number> {
		const conditions: SQL[] = [eq(auditLogs.tenantId, params.tenantId)];
		if (params.entityType) {
			conditions.push(eq(auditLogs.entityType, params.entityType));
		}
		if (params.action) {
			conditions.push(eq(auditLogs.action, params.action as never));
		}

		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(auditLogs)
			.where(and(...conditions));

		return row?.count ?? 0;
	}

	async listByScope(
		scope: "SUPER_ADMIN" | "BREAK_GLASS",
		limit = 100,
		offset = 0,
	): Promise<AuditLog[]> {
		return db
			.select()
			.from(auditLogs)
			.where(eq(auditLogs.scope, scope))
			.orderBy(desc(auditLogs.createdAt))
			.limit(limit)
			.offset(offset);
	}
}

export const auditLogRepository = new AuditLogRepository();
export type { AuditLog };
