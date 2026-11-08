import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireInventoryAuth } from "@/middlewares/inventory-auth";
import { assertPermission, permissions } from "@/utils/permission";
import { listAudit } from "@/services/audit-list.service";
import { successResponse } from "@/utils/api-response";

const audit = new OpenAPIHono<AppEnv>();
audit.use("*", requireInventoryAuth());
audit.openapi(createRoute({ method: "get", path: "/", tags: ["Audit"], summary: "List audit log", request: { query: z.object({ entityType: z.string().optional(), entityId: z.string().optional(), actorUserId: z.string().optional(), action: z.enum(["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "LOGOUT", "VIEW"]).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }) }, responses: { 200: { description: "Audit entries", content: { "application/json": { schema: z.any() } } } } }), async (c) => { assertPermission(c, permissions.viewAudit); return successResponse(c, await listAudit(c.req.valid("query"))); });
export default audit;
