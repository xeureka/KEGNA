import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";

export async function listAuditRows(filters: { entityType?: string; entityId?: string; actorUserId?: string; action?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
	const conditions = [
		filters.entityType ? eq(auditLogs.entityType, filters.entityType) : undefined,
		filters.entityId ? eq(auditLogs.entityId, filters.entityId) : undefined,
		filters.actorUserId ? eq(auditLogs.actorUserId, filters.actorUserId) : undefined,
		filters.action ? eq(auditLogs.action, filters.action as typeof auditLogs.action.enumValues[number]) : undefined,
		filters.from ? gte(auditLogs.createdAt, filters.from) : undefined,
		filters.to ? lte(auditLogs.createdAt, filters.to) : undefined,
	].filter(Boolean);
	const where = conditions.length ? and(...conditions) : undefined;
	return db.select({ log: auditLogs, actor: { id: users.id, name: users.name, email: users.email } }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).where(where).orderBy(desc(auditLogs.createdAt), asc(auditLogs.id)).limit(filters.pageSize).offset((filters.page - 1) * filters.pageSize);
}
