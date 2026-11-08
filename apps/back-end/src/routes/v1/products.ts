import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireInventoryAuth } from "@/middlewares/inventory-auth";
import { assertPermission, permissions } from "@/utils/permission";
import { createProduct, listProducts, updateProduct } from "@/services/inventory.service";
import { successResponse } from "@/utils/api-response";

const productInput = z.object({ name: z.string().min(1), sku: z.string().min(1), bottles_per_rack: z.number().int().positive(), price_per_rack: z.string().regex(/^\d+(?:\.\d{1,2})?$/) });
const productPatch = productInput.partial().extend({ is_active: z.boolean().optional() });
const products = new OpenAPIHono<AppEnv>(); products.use("*", requireInventoryAuth());
products.openapi(createRoute({ method: "get", path: "/", tags: ["Products"], summary: "List products", responses: { 200: { description: "Products", content: { "application/json": { schema: z.any() } } } } }), async (c) => { assertPermission(c, permissions.viewProducts); return successResponse(c, await listProducts()); });
products.openapi(createRoute({ method: "post", path: "/", tags: ["Products"], summary: "Create product", request: { body: { content: { "application/json": { schema: productInput } } } }, responses: { 200: { description: "Created", content: { "application/json": { schema: z.any() } } } } }), async (c) => { assertPermission(c, permissions.manageProducts); return successResponse(c, await createProduct(c.req.valid("json"))); });
products.openapi(createRoute({ method: "patch", path: "/{id}", tags: ["Products"], summary: "Update product", request: { params: z.object({ id: z.string().uuid() }), body: { content: { "application/json": { schema: productPatch } } } }, responses: { 200: { description: "Updated", content: { "application/json": { schema: z.any() } } } } }), async (c) => { assertPermission(c, permissions.manageProducts); return successResponse(c, await updateProduct(c.req.valid("param").id, c.req.valid("json"))); });
export default products;
