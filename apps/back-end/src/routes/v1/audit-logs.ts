import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { JSONValue } from "hono/utils/types";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { successResponse } from "@/utils/api-response";

const auditItemSchema = z.object({
	id: z.string(),
	actorUserId: z.string().nullable(),
	action: z.string(),
	entityType: z.string(),
	entityId: z.string().nullable(),
	oldValues: z.unknown().nullable(),
	newValues: z.unknown().nullable(),
	ipAddress: z.string().nullable(),
	createdAt: z.string(),
});

const mapLog = (l: {
	id: string;
	actorUserId: string | null;
	action: string;
	entityType: string;
	entityId: string | null;
	oldValues: unknown;
	newValues: unknown;
	ipAddress: string | null;
	createdAt: Date;
}) => ({
	id: l.id,
	actorUserId: l.actorUserId,
	action: l.action,
	entityType: l.entityType,
	entityId: l.entityId,
	oldValues: l.oldValues as JSONValue,
	newValues: l.newValues as JSONValue,
	ipAddress: l.ipAddress,
	createdAt: l.createdAt.toISOString(),
});

export const auditLogsRouter = new OpenAPIHono<AppEnv>();

auditLogsRouter.use("*", requireTenantAuth("audit_logs.read"));

// GET /api/v1/audit-logs
const listRoute = createRoute({
	method: "get",
	path: "/",
	summary: "List audit logs",
	request: {
		query: z.object({
			entityType: z.string().optional(),
			action: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Paginated audit logs",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							items: z.array(auditItemSchema),
							total: z.number(),
							page: z.number(),
							pageSize: z.number(),
						}),
					}),
				},
			},
		},
	},
});

auditLogsRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const tenantId = c.get("tenantId")!;
	const page = q.page ?? 1;
	const pageSize = q.pageSize ?? 50;
	const offset = (page - 1) * pageSize;

	const [items, total] = await Promise.all([
		auditLogRepository.list({
			tenantId,
			entityType: q.entityType,
			action: q.action,
			limit: pageSize,
			offset,
		}),
		auditLogRepository.count({
			tenantId,
			entityType: q.entityType,
			action: q.action,
		}),
	]);

	return successResponse(c, {
		items: items.map(mapLog),
		total,
		page,
		pageSize,
	});
});

export default auditLogsRouter;
