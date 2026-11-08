import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { procedureService } from "@/services/procedure.service";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";

const DISCOUNT_TYPES = ["NONE", "PERCENTAGE", "FIXED"] as const;

const procedureItemSchema = z.object({
	id: z.string(),
	code: z.string().nullable(),
	name: z.string(),
	category: z.string().nullable(),
	defaultPrice: z.string(),
	defaultDurationMinutes: z.number().nullable(),
	discountType: z.enum(DISCOUNT_TYPES),
	discountValue: z.string(),
	isActive: z.boolean(),
	createdAt: z.string(),
});

const mapProcedure = (p: {
	id: string;
	code: string | null;
	name: string;
	category: string | null;
	defaultPrice: string | null;
	defaultDurationMinutes: number | null;
	discountType: (typeof DISCOUNT_TYPES)[number];
	discountValue: string;
	isActive: boolean;
	createdAt: Date;
}) => ({
	id: p.id,
	code: p.code,
	name: p.name,
	category: p.category,
	defaultPrice: p.defaultPrice ?? "0",
	defaultDurationMinutes: p.defaultDurationMinutes,
	discountType: p.discountType,
	discountValue: p.discountValue,
	isActive: p.isActive,
	createdAt: p.createdAt.toISOString(),
});

export const proceduresRouter = new OpenAPIHono<AppEnv>();

const listResponse = {
	"application/json": {
		schema: z.object({
			success: z.boolean(),
			data: z.object({
				items: z.array(procedureItemSchema),
				total: z.number(),
				page: z.number(),
				pageSize: z.number(),
			}),
		}),
	},
};

// GET /api/v1/procedures
const listRoute = createRoute({
	middleware: [requireTenantAuth("procedures.read")],
	method: "get",
	path: "/",
	summary: "List procedure catalogue",
	request: {
		query: z.object({
			search: z.string().optional(),
			category: z.string().optional(),
			includeInactive: z.coerce.boolean().optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: { description: "Paginated procedures", content: listResponse },
	},
});

proceduresRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const result = await procedureService.list(c.get("tenantId")!, q);
	return successResponse(c, {
		items: result.items.map(mapProcedure),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize,
	});
});

// POST /api/v1/procedures
const createProcedureRoute = createRoute({
	middleware: [requireTenantAuth("procedures.create")],
	method: "post",
	path: "/",
	summary: "Create procedure / service",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						code: z.string().optional(),
						name: z.string().min(1),
						category: z.string().optional(),
						defaultPrice: z.string(),
						defaultDurationMinutes: z.number().int().positive().optional(),
						discountType: z.enum(DISCOUNT_TYPES).optional(),
						discountValue: z.string().optional(),
						isActive: z.boolean().optional(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created procedure",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: procedureItemSchema }),
				},
			},
		},
	},
});

proceduresRouter.openapi(createProcedureRoute, async (c) => {
	const body = c.req.valid("json");
	const procedure = await procedureService.create(c.get("tenantId")!, body);
	await auditService.log(c, {
		action: "CREATE",
		entityType: "procedure",
		entityId: procedure.id,
		newValues: body,
	});
	return successResponse(c, mapProcedure(procedure), 201);
});

// PATCH /api/v1/procedures/:id
const updateRoute = createRoute({
	middleware: [requireTenantAuth("procedures.update")],
	method: "patch",
	path: "/{id}",
	summary: "Update procedure (incl. discounts)",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						code: z.string().optional(),
						name: z.string().min(1).optional(),
						category: z.string().optional(),
						defaultPrice: z.string().optional(),
						defaultDurationMinutes: z.number().int().positive().optional(),
						discountType: z.enum(DISCOUNT_TYPES).optional(),
						discountValue: z.string().optional(),
						isActive: z.boolean().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated procedure",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: procedureItemSchema }),
				},
			},
		},
	},
});

proceduresRouter.openapi(updateRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const updated = await procedureService.update(c.get("tenantId")!, id, body);
	await auditService.log(c, {
		action: "UPDATE",
		entityType: "procedure",
		entityId: id,
		newValues: body,
	});
	return successResponse(c, mapProcedure(updated));
});

// DELETE /api/v1/procedures/:id
const deleteRoute = createRoute({
	middleware: [requireTenantAuth("procedures.update")],
	method: "delete",
	path: "/{id}",
	summary: "Soft-delete procedure",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Deleted",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({ message: z.string() }),
					}),
				},
			},
		},
	},
});

proceduresRouter.openapi(deleteRoute, async (c) => {
	const { id } = c.req.valid("param");
	await procedureService.remove(c.get("tenantId")!, id);
	await auditService.log(c, {
		action: "DELETE",
		entityType: "procedure",
		entityId: id,
	});
	return successResponse(c, { message: "Procedure deleted" });
});

export default proceduresRouter;
