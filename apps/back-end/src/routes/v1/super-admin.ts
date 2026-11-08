import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireSuperAdmin } from "@/middlewares/tenant-auth.middleware";
import { tenantService } from "@/services/tenant.service";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";
import { tenantRepository } from "@/repositories/tenant.repository";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { membershipRepository } from "@/repositories/membership.repository";
import { env } from "@/lib/env";

const tenantSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	status: z.string(),
	logoUrl: z.string().nullable(),
	brandColor: z.string(),
});

const createTenantRoute = createRoute({
	method: "post",
	path: "/tenants",
	middleware: [requireSuperAdmin()],
	summary: "Onboard a clinic tenant",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						name: z.string().min(2),
						slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
						brandColor: z
							.string()
							.regex(/^#[0-9a-fA-F]{6}$/)
							.default("#0f766e"),
						logoUrl: z.string().url().nullable().optional(),
						logoDataUrl: z.string().max(7_000_000).optional(),
						adminName: z.string().min(2),
						adminEmail: z.string().email(),
						adminPassword: z.string().min(8),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Tenant onboarded",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							tenant: tenantSchema,
							tenantId: z.string().uuid(),
							tenantLink: z.string().url(),
							adminEmail: z.string(),
							membershipId: z.string(),
						}),
					}),
				},
			},
		},
	},
});

export const superAdminRouter = new OpenAPIHono<AppEnv>();

const platformUsersRoute = createRoute({
	method: "get",
	path: "/users",
	middleware: [requireSuperAdmin()],
	summary: "List users across tenants",
	request: {
		query: z.object({
			tenantId: z.string().uuid().optional(),
			name: z.string().optional(),
			role: z.string().optional(),
			status: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Platform users",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(
							z.object({
								userId: z.string(),
								userName: z.string(),
								userEmail: z.string(),
								userStatus: z.string(),
								roleName: z.string(),
								membershipStatus: z.string(),
								tenantId: z.string(),
								tenantName: z.string(),
								tenantSlug: z.string(),
							}),
						),
					}),
				},
			},
		},
	},
});

superAdminRouter.openapi(platformUsersRoute, async (c) =>
	successResponse(
		c,
		await membershipRepository.listPlatformUsers(c.req.valid("query")),
	),
);

const platformAuditRoute = createRoute({
	method: "get",
	path: "/audit-logs",
	middleware: [requireSuperAdmin()],
	summary: "List platform Super Admin audit events",
	request: {
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Platform audit events",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(
							z.object({
								id: z.string(),
								tenantId: z.string(),
								actorUserId: z.string().nullable(),
								action: z.string(),
								scope: z.string(),
								entityType: z.string(),
								entityId: z.string().nullable(),
								createdAt: z.string(),
							}),
						),
					}),
				},
			},
		},
	},
});

superAdminRouter.openapi(platformAuditRoute, async (c) => {
	const q = c.req.valid("query");
	const items = await auditLogRepository.listByScope(
		"SUPER_ADMIN",
		q.pageSize ?? 100,
		((q.page ?? 1) - 1) * (q.pageSize ?? 100),
	);
	return successResponse(
		c,
		items.map((item) => ({
			id: item.id,
			tenantId: item.tenantId,
			actorUserId: item.actorUserId,
			action: item.action,
			scope: item.scope,
			entityType: item.entityType,
			entityId: item.entityId,
			createdAt: item.createdAt.toISOString(),
		})),
	);
});

const tenantListRoute = createRoute({
	method: "get",
	path: "/tenants",
	middleware: [requireSuperAdmin()],
	summary: "List clinic tenants",
	responses: {
		200: {
			description: "Tenants",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(tenantSchema),
					}),
				},
			},
		},
	},
});

superAdminRouter.openapi(tenantListRoute, async (c) => {
	const tenants = await tenantRepository.listAll();
	return successResponse(
		c,
		tenants.map((tenant) => ({
			id: tenant.id,
			name: tenant.name,
			slug: tenant.slug,
			status: tenant.status,
			logoUrl: tenant.logoUrl,
			brandColor: tenant.brandColor,
		})),
	);
});
superAdminRouter.openapi(createTenantRoute, async (c) => {
	const body = c.req.valid("json");
	const result = await tenantService.onboardTenant({
		...body,
		logoUrl: body.logoDataUrl ?? body.logoUrl,
	});
	await auditService.log(c, {
		tenantId: result.tenant.id,
		scope: "SUPER_ADMIN",
		action: "CREATE",
		entityType: "tenant",
		entityId: result.tenant.id,
		newValues: {
			name: result.tenant.name,
			slug: result.tenant.slug,
			brandColor: result.tenant.brandColor,
			adminEmail: result.admin.email,
		},
	});
	return successResponse(
		c,
		{
			tenant: {
				id: result.tenant.id,
				name: result.tenant.name,
				slug: result.tenant.slug,
				status: result.tenant.status,
				logoUrl: result.tenant.logoUrl,
				brandColor: result.tenant.brandColor,
			},
			tenantId: result.tenant.id,
			tenantLink: `${env.WEB_APP_URL}/login?tenant=${encodeURIComponent(result.tenant.slug)}`,
			adminEmail: result.admin.email,
			membershipId: result.membership.id,
		},
		201,
	);
});

const updateTenantRoute = createRoute({
	method: "patch",
	path: "/tenants/{id}",
	middleware: [requireSuperAdmin()],
	summary: "Configure or suspend a tenant",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						name: z.string().min(2).optional(),
						status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).optional(),
						brandColor: z
							.string()
							.regex(/^#[0-9a-fA-F]{6}$/)
							.optional(),
						logoUrl: z.string().url().nullable().optional(),
						logoDataUrl: z.string().max(7_000_000).optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated tenant",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: tenantSchema }),
				},
			},
		},
	},
});

superAdminRouter.openapi(updateTenantRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const existing = await tenantRepository.findById(id);
	if (!existing)
		throw new AppError("Tenant not found", 404, ErrorCode.NOT_FOUND);
	const updated = await tenantRepository.updateTenant(id, {
		...body,
		logoUrl: body.logoDataUrl ?? body.logoUrl,
	});
	if (!updated)
		throw new AppError("Tenant not found", 404, ErrorCode.NOT_FOUND);
	await auditService.log(c, {
		tenantId: id,
		scope: "SUPER_ADMIN",
		action: "UPDATE",
		entityType: "tenant",
		entityId: id,
		oldValues: existing,
		newValues: body,
	});
	return successResponse(c, {
		id: updated.id,
		name: updated.name,
		slug: updated.slug,
		status: updated.status,
		logoUrl: updated.logoUrl,
		brandColor: updated.brandColor,
	});
});

export default superAdminRouter;
