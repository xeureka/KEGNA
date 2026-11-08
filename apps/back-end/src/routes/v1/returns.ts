import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireInventoryAuth } from "@/middlewares/inventory-auth";
import { assertPermission, permissions } from "@/utils/permission";
import { confirmReturns } from "@/services/inventory.service";
import { successResponse } from "@/utils/api-response";
const returns = new OpenAPIHono<AppEnv>(); returns.use("*", requireInventoryAuth());
returns.openapi(createRoute({ method: "post", path: "/issues/{id}/confirm-returns", tags: ["Returns"], summary: "Confirm returns and damages", request: { params: z.object({ id: z.string().uuid() }), body: { content: { "application/json": { schema: z.object({ items: z.array(z.object({ product_id: z.string().uuid(), returned: z.number().int().nonnegative(), damaged: z.number().int().nonnegative() })).min(1), note: z.string().optional() }) } } } }, responses: { 200: { description: "Confirmed", content: { "application/json": { schema: z.any() } } } } }), async (c) => { assertPermission(c, permissions.confirmReturns); return successResponse(c, await confirmReturns(c.get("user")!, c.req.valid("param").id, c.req.valid("json"))); });
export default returns;
