import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireInventoryAuth } from "@/middlewares/inventory-auth";
import { assertPermission, permissions } from "@/utils/permission";
import { verifyReport } from "@/services/inventory.service";
import { successResponse } from "@/utils/api-response";
const verification = new OpenAPIHono<AppEnv>(); verification.use("*", requireInventoryAuth());
verification.openapi(createRoute({ method: "post", path: "/reports/{id}/verify", tags: ["Verification"], summary: "Approve or flag report", request: { params: z.object({ id: z.string().uuid() }), body: { content: { "application/json": { schema: z.object({ decision: z.enum(["approved", "flagged"]), note: z.string().optional() }) } } } }, responses: { 200: { description: "Decided", content: { "application/json": { schema: z.any() } } } } }), async (c) => { assertPermission(c, permissions.verifyReport); return successResponse(c, await verifyReport(c.get("user")!, c.req.valid("param").id, c.req.valid("json"))); });
export default verification;
