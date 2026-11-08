import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { staffService, DEFAULT_STAFF_PASSWORD } from "@/services/staff.service";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";
import { notFoundResponse } from "@/routes/v1/schemas/common";

// Tenant owners provision operational staff; ownership and accounting access
// are not assignable from this screen.
const ROLES = ["DOCTOR", "RECEPTIONIST"] as const;
const MEMBERSHIP_STATUSES = [
	"ACTIVE",
	"INVITED",
	"SUSPENDED",
	"INACTIVE",
] as const;

const memberItemSchema = z.object({
	id: z.string(),
	userId: z.string(),
	roleId: z.string(),
	roleName: z.string(),
	status: z.enum(MEMBERSHIP_STATUSES),
	joinedAt: z.string().nullable(),
	userName: z.string(),
	userEmail: z.string(),
});

const mapMember = (m: {
	id: string;
	userId: string;
	roleId: string;
	roleName: string;
	status: (typeof MEMBERSHIP_STATUSES)[number];
	joinedAt: Date | null;
	userName: string;
	userEmail: string;
}) => ({
	id: m.id,
	userId: m.userId,
	roleId: m.roleId,
	roleName: m.roleName,
	status: m.status,
	joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
	userName: m.userName,
	userEmail: m.userEmail,
});

export const membersRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/members
const listRoute = createRoute({
	middleware: [requireTenantAuth("members.read")],
	method: "get",
	path: "/",
	summary: "List tenant staff members",
	responses: {
		200: {
			description: "Members",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(memberItemSchema),
					}),
				},
			},
		},
	},
});

membersRouter.openapi(listRoute, async (c) => {
	const members = await staffService.list(c.get("tenantId")!);
	return successResponse(c, members.map(mapMember));
});

// POST /api/v1/members
const createMemberRoute = createRoute({
	middleware: [requireTenantAuth("members.manage")],
	method: "post",
	path: "/",
	summary: "Create staff member (user + membership + optional doctor profile)",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						name: z.string().min(2),
						email: z.string().email(),
						password: z
							.string()
							.min(8)
							.optional()
							.default(DEFAULT_STAFF_PASSWORD),
						roleName: z.enum(ROLES),
						licenseNumber: z.string().optional(),
						specialization: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created member",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: memberItemSchema }),
				},
			},
		},
	},
});

membersRouter.openapi(createMemberRoute, async (c) => {
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;

	const result = await staffService.createStaff(tenantId, body);

	const { password: _password, ...auditValues } = body;
	await auditService.log(c, {
		action: "CREATE",
		entityType: "membership",
		entityId: result.membership?.id ?? null,
		newValues: auditValues,
	});
	return successResponse(
		c,
		mapMember({
			id: result.membership!.id,
			userId: result.user.id,
			roleId: result.membership!.roleId,
			roleName: result.roleName,
			status: result.membership!.status,
			joinedAt: result.membership!.joinedAt,
			userName: result.user.name,
			userEmail: result.user.email,
		}),
		201,
	);
});

// PATCH /api/v1/members/:id/role
const roleRoute = createRoute({
	middleware: [requireTenantAuth("members.manage")],
	method: "patch",
	path: "/{id}/role",
	summary: "Change member role",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": { schema: z.object({ roleName: z.enum(ROLES) }) },
			},
		},
	},
	responses: {
		200: {
			description: "Role updated",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: memberItemSchema }),
				},
			},
		},
		404: notFoundResponse,
	},
});

membersRouter.openapi(roleRoute, async (c) => {
	const { id } = c.req.valid("param");
	const { roleName } = c.req.valid("json");
	const updated = await staffService.changeRole(
		c.get("tenantId")!,
		id,
		roleName,
	);
	if (!updated)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Membership not found" },
			},
			404,
		);

	const member = (await staffService.list(c.get("tenantId")!)).find(
		(m) => m.id === id,
	)!;
	await auditService.log(c, {
		action: "UPDATE",
		entityType: "membership",
		entityId: id,
		newValues: { roleName },
	});
	return successResponse(c, mapMember(member));
});

// PATCH /api/v1/members/:id/status
const statusRoute = createRoute({
	middleware: [requireTenantAuth("members.manage")],
	method: "patch",
	path: "/{id}/status",
	summary: "Activate / suspend member",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({ status: z.enum(MEMBERSHIP_STATUSES) }),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Status updated",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: memberItemSchema }),
				},
			},
		},
		404: notFoundResponse,
	},
});

membersRouter.openapi(statusRoute, async (c) => {
	const { id } = c.req.valid("param");
	const { status } = c.req.valid("json");
	const updated = await staffService.setStatus(c.get("tenantId")!, id, status);
	if (!updated)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Membership not found" },
			},
			404,
		);

	const member = (await staffService.list(c.get("tenantId")!)).find(
		(m) => m.id === id,
	)!;
	await auditService.log(c, {
		action: "UPDATE",
		entityType: "membership",
		entityId: id,
		newValues: { status },
	});
	return successResponse(c, mapMember(member));
});

export default membersRouter;
