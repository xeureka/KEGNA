import type { Context } from "hono";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import type { AuditAction, AuditScope } from "@/db/schema";

export interface AuditContext {
	tenantId: string;
	actorUserId: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
}

/** Best-effort audit trail writer. Never throws into request handling. */
export class AuditService {
	private contextOf(c: Context): AuditContext {
		return {
			tenantId: c.get("tenantId") ?? "",
			actorUserId: c.get("user")?.id ?? null,
			ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
			userAgent: c.req.header("user-agent"),
		};
	}

	async log(
		c: Context,
		entry: {
			action: AuditAction;
			entityType: string;
			entityId?: string | null;
			oldValues?: unknown;
			newValues?: unknown;
			tenantId?: string;
			scope?: AuditScope;
		},
	): Promise<void> {
		try {
			const base = this.contextOf(c);
			await auditLogRepository.insert({
				tenantId: entry.tenantId ?? base.tenantId,
				actorUserId: base.actorUserId,
				action: entry.action,
				entityType: entry.entityType,
				entityId: entry.entityId,
				oldValues: entry.oldValues
					? JSON.parse(JSON.stringify(entry.oldValues))
					: null,
				newValues: entry.newValues
					? JSON.parse(JSON.stringify(entry.newValues))
					: null,
				scope: entry.scope ?? "TENANT",
				ipAddress: base.ipAddress ?? undefined,
				userAgent: base.userAgent ?? undefined,
			});
		} catch {
			// Audit logging is best-effort; never fail the originating request.
		}
	}
}

export const auditService = new AuditService();
