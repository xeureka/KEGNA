import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { paymentsService } from "@/services/payments.service";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { successResponse } from "@/utils/api-response";

/**
 * Membership card catalog and the authenticated patient's own cards.
 *
 * Mounted twice with identical behaviour: under `/api/v1/cards` (the primary
 * path) and under `/api/v1/payments/cards` (what the shipped mobile app
 * already calls), so neither client has to be rebuilt to move.
 */
const cardsRouter = new OpenAPIHono<AppEnv>();
cardsRouter.use("*", requireTenantAuth());

const cardsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "List membership tiers with the inclusive Chapa amount",
	responses: {
		200: {
			description: "Active card products",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.record(z.string(), z.unknown())),
					}),
				},
			},
		},
	},
});
cardsRouter.openapi(cardsRoute, async (c) =>
	successResponse(c, await paymentsService.listCards(c.get("tenantId")!)),
);

const myCardsRoute = createRoute({
	method: "get",
	path: "/me",
	summary: "List cards purchased by the authenticated patient",
	responses: {
		200: {
			description: "Patient cards",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.record(z.string(), z.unknown())),
					}),
				},
			},
		},
	},
});
cardsRouter.openapi(myCardsRoute, async (c) => {
	if (c.get("role")?.name !== "PATIENT") {
		throw new AppError(
			"You do not have permission to access payment operations",
			403,
			ErrorCode.FORBIDDEN,
		);
	}
	return successResponse(
		c,
		await paymentsService.listMyCards(c.get("tenantId")!, c.get("user")!.id),
	);
});

export default cardsRouter;
