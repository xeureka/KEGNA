import { auditLogs } from "@/db/schema";
export function writeAudit(tx: any, input: { actorUserId?: string | null; action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "LOGIN" | "LOGOUT" | "VIEW"; entityType: string; entityId?: string | null; oldValues?: unknown; newValues?: unknown }) {
	return tx.insert(auditLogs).values({ actorUserId: input.actorUserId ?? null, action: input.action, entityType: input.entityType, entityId: input.entityId ?? null, oldValues: input.oldValues, newValues: input.newValues }).returning();
}
