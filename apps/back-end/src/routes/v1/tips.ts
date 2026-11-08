import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { db } from "@/db";
import { notifications, tenantMemberships } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { successResponse } from "@/utils/api-response";

const tipsRouter = new OpenAPIHono<AppEnv>();

const createTipRoute = createRoute({
	middleware: [requireTenantAuth()],
	method: "post",
	path: "/",
	summary: "Create a tenant-wide patient tip",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						message: z.string().trim().min(1).max(500),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Tip created",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({ id: z.string(), recipients: z.number() }),
					}),
				},
			},
		},
	},
});

tipsRouter.openapi(createTipRoute, async (c) => {
	const role = c.get("role")?.name;
	if (role !== "OWNER" && role !== "ADMIN") {
		throw new AppError(
			"Only tenant owners and admins can publish tips",
			403,
			ErrorCode.FORBIDDEN,
		);
	}

	const tenantId = c.get("tenantId")!;
	const { message } = c.req.valid("json");
	const recipients = await db
		.select({ userId: tenantMemberships.userId })
		.from(tenantMemberships)
		.where(
			and(
				eq(tenantMemberships.tenantId, tenantId),
				eq(tenantMemberships.status, "ACTIVE"),
			),
		);
	const rows = recipients.length
		? await db
				.insert(notifications)
				.values(
					recipients.map(({ userId }) => ({
						tenantId,
						userId,
						type: "INFO" as const,
						title: "Dental care tip",
						message,
					})),
				)
				.returning({ id: notifications.id })
		: [];
	return successResponse(
		c,
		{ id: rows[0]?.id ?? "", recipients: rows.length },
		201,
	);
});

export default tipsRouter;
