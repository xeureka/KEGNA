import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { rateLimiter } from "hono-rate-limiter";
import type { Context } from "hono";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { paymentsService } from "@/services/payments.service";
import { paymentAnalyticsService } from "@/services/payment-analytics.service";
import { env } from "@/lib/env";
import { auditService } from "@/services/audit.service";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { successResponse } from "@/utils/api-response";
import { paymentPurpose, paymentStatus, paymentMethod } from "@/db/schema";
import cardsRouter from "./cards";

const paymentRouter = new OpenAPIHono<AppEnv>();
paymentRouter.use("*", requireTenantAuth());

const amountSchema = z
	.string()
	.regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Amount must be a valid ETB decimal");
const checkoutSchema = z.object({
	checkout_url: z.string().url(),
	tx_ref: z.string(),
});
const initLimiter = rateLimiter({
	windowMs: 60_000,
	limit: 5,
	standardHeaders: "draft-6",
	keyGenerator: (c) =>
		(c as unknown as Context<AppEnv>).get("user")?.id ??
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown-payment-client",
});
for (const path of ["/visit", "/card", "/balance", "/chapa-for-patient"]) {
	paymentRouter.use(path, initLimiter);
}

function assertRole(c: Context<AppEnv>, roles: string[]) {
	const role = c.get("role")?.name;
	if (!role || !roles.includes(role)) {
		throw new AppError(
			"You do not have permission to access payment operations",
			403,
			ErrorCode.FORBIDDEN,
		);
	}
}

function assertPermission(c: Context<AppEnv>, permission: string) {
	if (!c.get("permissions")?.includes(permission)) {
		throw new AppError(
			"You do not have permission to access payment operations",
			403,
			ErrorCode.FORBIDDEN,
		);
	}
}

const configRoute = createRoute({
	method: "get",
	path: "/config",
	summary: "Return the payment rules the app must display",
	responses: {
		200: {
			description: "Payment configuration",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							currency: z.string(),
							serviceChargeEtb: z.string(),
							holdMinutes: z.number(),
						}),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(configRoute, async (c) =>
	successResponse(c, {
		currency: "ETB",
		// Patients are shown one inclusive price: base + this charge.
		serviceChargeEtb: env.SERVICE_CHARGE_ETB,
		holdMinutes: env.PAYMENT_HOLD_MINUTES,
	}),
);

const visitRoute = createRoute({
	method: "post",
	path: "/visit",
	summary: "Reserve a visit slot and initialize Chapa checkout",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						serviceId: z.string().uuid(),
						doctorId: z.string().uuid(),
						startAt: z.string().datetime(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Visit payment initialized",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: checkoutSchema }),
				},
			},
		},
	},
});
paymentRouter.openapi(visitRoute, async (c) => {
	assertRole(c, ["PATIENT"]);
	const result = await paymentsService.startVisit(
		c.get("tenantId")!,
		c.get("user")!.id,
		c.req.valid("json"),
	);
	return successResponse(c, result, 201);
});

const cardRoute = createRoute({
	method: "post",
	path: "/card",
	summary: "Initialize Chapa checkout for a card plan",
	request: {
		body: {
			content: {
				"application/json": { schema: z.object({ cardId: z.string().uuid() }) },
			},
		},
	},
	responses: {
		201: {
			description: "Card payment initialized",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: checkoutSchema }),
				},
			},
		},
	},
});
paymentRouter.openapi(cardRoute, async (c) => {
	assertRole(c, ["PATIENT"]);
	const result = await paymentsService.startCard(
		c.get("tenantId")!,
		c.get("user")!.id,
		c.req.valid("json").cardId,
	);
	return successResponse(c, result, 201);
});

const balanceRoute = createRoute({
	method: "post",
	path: "/balance",
	summary: "Initialize Chapa checkout for all or part of a patient balance",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({ amount: amountSchema.optional() }),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Balance payment initialized",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: checkoutSchema }),
				},
			},
		},
	},
});
paymentRouter.openapi(balanceRoute, async (c) => {
	assertRole(c, ["PATIENT"]);
	const result = await paymentsService.startBalance(
		c.get("tenantId")!,
		c.get("user")!.id,
		c.req.valid("json"),
	);
	return successResponse(c, result, 201);
});

const statusRoute = createRoute({
	method: "get",
	path: "/{txRef}/status",
	summary: "Verify and return the authenticated patient's payment status",
	request: { params: z.object({ txRef: z.string().min(1).max(100) }) },
	responses: {
		200: {
			description: "Payment status",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							idempotent: z.boolean(),
							status: z.string(),
							txRef: z.string(),
							purpose: z.string(),
							method: z.string(),
							currency: z.string(),
							amount: z.string(),
							totalAmount: z.string(),
							baseAmount: z.string(),
							paidAt: z.string().nullable(),
							createdAt: z.string(),
						}),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(statusRoute, async (c) => {
	assertRole(c, ["PATIENT"]);
	const txRef = c.req.valid("param").txRef;
	const result = await paymentsService.verifyStatus(
		c.get("tenantId")!,
		c.get("user")!.id,
		txRef,
	);
	const detail = await paymentAnalyticsService.getPaymentStatusDetail(
		c.get("tenantId")!,
		c.get("user")!.id,
		txRef,
	);
	return successResponse(c, {
		...detail,
		idempotent: result.idempotent,
		status: result.status,
	});
});

const mineRoute = createRoute({
	method: "get",
	path: "/me",
	summary: "List payment history for the authenticated patient",
	request: {
		query: z.object({
			page: z.coerce.number().int().min(1).default(1),
			pageSize: z.coerce.number().int().min(1).max(100).default(20),
		}),
	},
	responses: {
		200: {
			description: "Patient payment history",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.record(z.string(), z.unknown()),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(mineRoute, async (c) => {
	assertRole(c, ["PATIENT"]);
	return successResponse(
		c,
		await paymentsService.listMine(
			c.get("tenantId")!,
			c.get("user")!.id,
			c.req.valid("query"),
		),
	);
});

const balanceSummaryRoute = createRoute({
	method: "get",
	path: "/me/balance",
	summary: "Return the patient's server-calculated balance",
	responses: {
		200: {
			description: "Patient balance",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.record(z.string(), z.unknown()),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(balanceSummaryRoute, async (c) => {
	assertRole(c, ["PATIENT"]);
	const identity = await paymentsService.identityForUser(
		c.get("tenantId")!,
		c.get("user")!.id,
	);
	return successResponse(
		c,
		await paymentsService.getPatientBalance(
			c.get("tenantId")!,
			identity.patientId,
		),
	);
});

const manualRoute = createRoute({
	method: "post",
	path: "/manual",
	summary: "Record a reception cash or mobile-transfer payment",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z
						.object({
							patientId: z.string().uuid(),
							purpose: z.enum(paymentPurpose.enumValues),
							referenceId: z.string().uuid().optional(),
							amount: amountSchema,
							method: z.enum(["CASH", "MOBILE_TRANSFER"]),
							transferReference: z.string().max(255).optional(),
							note: z.string().max(500).optional(),
						})
						.superRefine((value, ctx) => {
							if (
								value.method === "MOBILE_TRANSFER" &&
								!value.transferReference?.trim()
							)
								ctx.addIssue({
									code: "custom",
									message: "Transfer reference is required",
									path: ["transferReference"],
								});
						}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Payment recorded",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({ id: z.string(), status: z.string() }),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(manualRoute, async (c) => {
	assertRole(c, ["RECEPTIONIST", "ADMIN", "OWNER"]);
	assertPermission(c, "payments.record");
	const payment = await paymentsService.recordManual(
		c.get("tenantId")!,
		c.get("user")!.id,
		c.req.valid("json"),
	);
	await auditService.log(c, {
		action: "CREATE",
		entityType: "payment",
		entityId: payment.id,
		newValues: {
			patientId: payment.patientId,
			purpose: payment.purpose,
			referenceId: payment.referenceId,
			baseAmount: payment.baseAmount,
			serviceCharge: payment.serviceCharge,
			totalAmount: payment.totalAmount,
			method: payment.method,
			transferReference: payment.transferReference,
		},
	});
	return successResponse(c, { id: payment.id, status: payment.status }, 201);
});

const startForPatientRoute = createRoute({
	method: "post",
	path: "/chapa-for-patient",
	summary: "Start a Chapa checkout for a reception walk-in patient",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						patientId: z.string().uuid(),
						purpose: z.enum(paymentPurpose.enumValues),
						referenceId: z.string().uuid().optional(),
						amount: amountSchema.optional(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Walk-in checkout initialized",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: checkoutSchema }),
				},
			},
		},
	},
});
paymentRouter.openapi(startForPatientRoute, async (c) => {
	assertRole(c, ["RECEPTIONIST", "ADMIN", "OWNER"]);
	assertPermission(c, "payments.record");
	return successResponse(
		c,
		await paymentsService.startChapaForPatient(
			c.get("tenantId")!,
			c.req.valid("json").patientId,
			c.req.valid("json"),
		),
		201,
	);
});

const allRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Search and filter the tenant payment ledger",
	request: {
		query: z.object({
			search: z.string().max(150).optional(),
			status: z.enum(paymentStatus.enumValues).optional(),
			method: z.enum(paymentMethod.enumValues).optional(),
			purpose: z.enum(paymentPurpose.enumValues).optional(),
			recordedBy: z.string().uuid().optional(),
			from: z.string().date().optional(),
			to: z.string().date().optional(),
			sort: z.enum(["asc", "desc"]).default("desc"),
			page: z.coerce.number().int().min(1).default(1),
			pageSize: z.coerce.number().int().min(1).max(100).default(20),
		}),
	},
	responses: {
		200: {
			description: "Paginated payment log",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.record(z.string(), z.unknown()),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(allRoute, async (c) => {
	assertRole(c, ["RECEPTIONIST", "ADMIN", "OWNER", "ACCOUNTANT"]);
	const query = c.req.valid("query");
	return successResponse(
		c,
		await paymentsService.listAll(c.get("tenantId")!, {
			...query,
			from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
			to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
		}),
	);
});

const queueRoute = createRoute({
	method: "get",
	path: "/queue",
	summary: "List payments that still need staff attention",
	request: {
		query: z.object({
			status: z.enum(paymentStatus.enumValues).optional(),
			page: z.coerce.number().int().min(1).default(1),
			pageSize: z.coerce.number().int().min(1).max(100).default(20),
		}),
	},
	responses: {
		200: {
			description: "Payment queue",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.record(z.string(), z.unknown()),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(queueRoute, async (c) => {
	assertRole(c, ["RECEPTIONIST", "ADMIN", "OWNER", "ACCOUNTANT"]);
	assertPermission(c, "payments.view_queue");
	return successResponse(
		c,
		await paymentsService.listQueue(c.get("tenantId")!, c.req.valid("query")),
	);
});

const summaryRoute = createRoute({
	method: "get",
	path: "/summary",
	summary: "Summarize payment activity for the tenant",
	responses: {
		200: {
			description: "Payment summary",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.record(z.string(), z.unknown()),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(summaryRoute, async (c) => {
	assertRole(c, ["RECEPTIONIST", "ADMIN", "OWNER", "ACCOUNTANT"]);
	assertPermission(c, "payments.view_queue");
	return successResponse(c, await paymentsService.summary(c.get("tenantId")!));
});

const analyticsRoute = createRoute({
	method: "get",
	path: "/analytics",
	summary: "Payment analytics: success rate and revenue by purpose/day",
	responses: {
		200: {
			description: "Payment analytics",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							totalAttempts: z.number(),
							successCount: z.number(),
							failedCount: z.number(),
							successRate: z.number(),
							revenueByPurpose: z.array(
								z.object({ purpose: z.string(), revenue: z.string() }),
							),
							revenueByDay: z.array(
								z.object({ date: z.string(), revenue: z.string() }),
							),
						}),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(analyticsRoute, async (c) => {
	assertRole(c, ["RECEPTIONIST", "ADMIN", "OWNER", "ACCOUNTANT"]);
	assertPermission(c, "payments.view_queue");
	return successResponse(
		c,
		await paymentAnalyticsService.getPaymentAnalytics(c.get("tenantId")!),
	);
});

const recordersRoute = createRoute({
	method: "get",
	path: "/recorders",
	summary: "List staff who have recorded tenant payments",
	responses: {
		200: {
			description: "Payment recording staff",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.object({ id: z.string(), name: z.string() })),
					}),
				},
			},
		},
	},
});
paymentRouter.openapi(recordersRoute, async (c) => {
	assertRole(c, ["RECEPTIONIST", "ADMIN", "OWNER", "ACCOUNTANT"]);
	assertPermission(c, "payments.view_queue");
	return successResponse(
		c,
		await paymentsService.listRecorders(c.get("tenantId")!),
	);
});

// Card catalog lives in its own router so the same handlers serve both
// `/api/v1/cards` and the legacy `/api/v1/payments/cards` path.
paymentRouter.route("/cards", cardsRouter);

export default paymentRouter;
