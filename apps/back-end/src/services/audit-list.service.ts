import { listAuditRows } from "@/repositories/audit-list.repository";

const safeKeys = new Set(["status", "role", "active", "reportId", "decision", "reconciliation", "passwordReset"]);
function safeSummary(value: unknown): string {
	if (!value || typeof value !== "object") return "";
	const input = value as Record<string, unknown>;
	const output: Record<string, unknown> = {};
	for (const key of safeKeys) if (key in input) output[key] = input[key];
	return JSON.stringify(output).slice(0, 300);
}
export async function listAudit(filters: Parameters<typeof listAuditRows>[0]) {
	const rows = await listAuditRows(filters);
	return rows.map(({ log, actor }) => ({ id: log.id, actor: actor ?? null, action: log.action, entityType: log.entityType, entityId: log.entityId, createdAt: log.createdAt, metadataSummary: safeSummary(log.newValues) || safeSummary(log.oldValues) || "—" }));
}
