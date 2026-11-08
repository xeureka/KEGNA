import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppEnv } from "@/types/hono";
import { paymentsService } from "@/services/payments.service";
import { logger } from "@/lib/logger";
import { successResponse } from "@/utils/api-response";

const webhookBody = z.record(z.string(), z.unknown());

const createWebhookRoute = (path: string) =>
	createRoute({
		method: "post",
		path,
		summary: "Receive and independently verify a Chapa webhook",
		request: {
			body: {
				content: { "application/json": { schema: webhookBody } },
			},
		},
		responses: {
			200: {
				description: "Webhook signature and provider transaction verified",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							data: z.object({
								accepted: z.boolean(),
								idempotent: z.boolean(),
								status: z.string(),
								tx_ref: z.string(),
							}),
						}),
					},
				},
			},
		},
	});

export const paymentWebhookRouter = new OpenAPIHono<AppEnv>();

const handle = async (c: Context<AppEnv>) => {
	const rawBody = await c.req.text();
	const signature =
		c.req.header("x-chapa-signature") ?? c.req.header("chapa-signature");

	let parsed: Record<string, unknown> = {};
	try {
		parsed = JSON.parse(rawBody);
	} catch {
		parsed = {};
	}

	const txRef = typeof parsed.tx_ref === "string" ? parsed.tx_ref : "";
	const result = await paymentsService.processWebhook(
		rawBody || parsed,
		signature,
	);
	logger.info(
		{ status: result.status, idempotent: result.idempotent, tx_ref: txRef },
		"Chapa webhook transaction processed",
	);
	return successResponse(c, {
		accepted: true,
		idempotent: result.idempotent,
		status: result.status,
		tx_ref: txRef,
	});
};

paymentWebhookRouter.openapi(createWebhookRoute("/webhook"), async (c) =>
	handle(c),
);
paymentWebhookRouter.openapi(createWebhookRoute("/chapa"), async (c) =>
	handle(c),
);

const callbackRoute = createRoute({
	method: "get",
	path: "/callback",
	summary:
		"Handle Chapa GET callback notification and redirect to app deep link",
	request: {
		query: z.object({
			trx_ref: z.string().optional(),
			tx_ref: z.string().optional(),
			ref_id: z.string().optional(),
			status: z.string().optional(),
		}),
	},
	responses: { 302: { description: "Redirect to tenant app deep link" } },
});

paymentWebhookRouter.openapi(callbackRoute, async (c) => {
	const query = c.req.valid("query");
	const txRef = query.trx_ref || query.tx_ref;
	if (!txRef) {
		return c.text("Missing transaction reference", 400);
	}
	const redirectUrl = await paymentsService.resolveCheckoutReturn(txRef);
	return c.redirect(redirectUrl, 302);
});

const returnRoute = createRoute({
	method: "get",
	path: "/return",
	summary: "Redirect a Chapa checkout return into the tenant mobile app",
	request: {
		query: z.object({
			tx_ref: z.string().optional(),
			trx_ref: z.string().optional(),
		}),
	},
	responses: { 302: { description: "Redirect to the tenant app deep link" } },
});

paymentWebhookRouter.openapi(returnRoute, async (c) => {
	const query = c.req.valid("query");
	const txRef = query.tx_ref || query.trx_ref;
	if (!txRef) {
		return c.text("Missing transaction reference", 400);
	}
	return c.redirect(await paymentsService.resolveCheckoutReturn(txRef), 302);
});

export default paymentWebhookRouter;
