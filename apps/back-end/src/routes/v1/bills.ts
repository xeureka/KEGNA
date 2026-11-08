import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { billingService } from "@/services/billing.service";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";

const BILL_STATUSES = [
	"DRAFT",
	"PENDING",
	"PARTIALLY_PAID",
	"PAID",
	"CANCELLED",
	"VOID",
] as const;
const METHODS = [
	"CASH",
	"CARD",
	"BANK_TRANSFER",
	"MOBILE_MONEY",
	"OTHER",
] as const;

const billItemSchema = z.object({
	id: z.string(),
	description: z.string(),
	quantity: z.string(),
	unitPrice: z.string(),
	discountAmount: z.string(),
	taxAmount: z.string(),
	totalAmount: z.string(),
});

const billSchema = z.object({
	id: z.string(),
	patientId: z.string(),
	appointmentId: z.string().nullable(),
	billNumber: z.string(),
	status: z.enum(BILL_STATUSES),
	subtotal: z.string(),
	discountAmount: z.string(),
	taxAmount: z.string(),
	totalAmount: z.string(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	patientName: z.string(),
	amountPaid: z.string(),
	items: z.array(billItemSchema).optional(),
});

const createdBillSchema = z.object({
	id: z.string(),
	patientId: z.string(),
	appointmentId: z.string().nullable(),
	billNumber: z.string(),
	status: z.enum(BILL_STATUSES),
	subtotal: z.string(),
	discountAmount: z.string(),
	taxAmount: z.string(),
	totalAmount: z.string(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	items: z.array(billItemSchema),
});

const mapBill = (b: {
	id: string;
	patientId: string;
	appointmentId: string | null;
	billNumber: string;
	status: (typeof BILL_STATUSES)[number];
	subtotal: string;
	discountAmount: string;
	taxAmount: string;
	totalAmount: string;
	notes: string | null;
	createdAt: Date;
	patientName: string;
	amountPaid: string;
}) => ({
	id: b.id,
	patientId: b.patientId,
	appointmentId: b.appointmentId,
	billNumber: b.billNumber,
	status: b.status,
	subtotal: b.subtotal,
	discountAmount: b.discountAmount,
	taxAmount: b.taxAmount,
	totalAmount: b.totalAmount,
	notes: b.notes,
	createdAt: b.createdAt.toISOString(),
	patientName: b.patientName,
	amountPaid: b.amountPaid,
});

export const billsRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/bills
const listRoute = createRoute({
	middleware: [requireTenantAuth("bills.read")],
	method: "get",
	path: "/",
	summary: "List bills",
	request: {
		query: z.object({
			patientId: z.string().optional(),
			status: z.enum(BILL_STATUSES).optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Paginated bills",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							items: z.array(billSchema),
							total: z.number(),
							page: z.number(),
							pageSize: z.number(),
						}),
					}),
				},
			},
		},
	},
});

billsRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const result = await billingService.list(c.get("tenantId")!, q);
	return successResponse(c, {
		items: result.items.map(mapBill),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize,
	});
});

// POST /api/v1/bills
const createBillRoute = createRoute({
	middleware: [requireTenantAuth("bills.create")],
	method: "post",
	path: "/",
	summary: "Create bill with items",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						patientId: z.string(),
						appointmentId: z.string().optional(),
						billNumber: z.string().min(1),
						status: z.enum(BILL_STATUSES).optional(),
						notes: z.string().optional(),
						items: z.array(
							z.object({
								procedureId: z.string().optional(),
								description: z.string().min(1),
								quantity: z.string().min(1),
								unitPrice: z.string(),
								discountAmount: z.string().optional(),
								taxAmount: z.string().optional(),
							}),
						),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created bill",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: createdBillSchema }),
				},
			},
		},
	},
});

billsRouter.openapi(createBillRoute, async (c) => {
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const user = c.get("user")!;

	const bill = await billingService.createBill(tenantId, user.id, body);

	await auditService.log(c, {
		action: "CREATE",
		entityType: "bill",
		entityId: bill.id,
		newValues: body,
	});
	return successResponse(
		c,
		{
			id: bill.id,
			patientId: bill.patientId,
			appointmentId: bill.appointmentId,
			billNumber: bill.billNumber,
			status: bill.status,
			subtotal: bill.subtotal,
			discountAmount: bill.discountAmount,
			taxAmount: bill.taxAmount,
			totalAmount: bill.totalAmount,
			notes: bill.notes,
			createdAt: bill.createdAt.toISOString(),
			items: bill.items.map((i) => ({
				id: i.id,
				description: i.description,
				quantity: i.quantity,
				unitPrice: i.unitPrice,
				discountAmount: i.discountAmount,
				taxAmount: i.taxAmount,
				totalAmount: i.totalAmount,
			})),
		},
		201,
	);
});

// GET /api/v1/bills/:id
const getRoute = createRoute({
	middleware: [requireTenantAuth("bills.read")],
	method: "get",
	path: "/{id}",
	summary: "Get bill by id",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Bill",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: billSchema }),
				},
			},
		},
	},
});

billsRouter.openapi(getRoute, async (c) => {
	const { id } = c.req.valid("param");
	const bill = await billingService.findById(c.get("tenantId")!, id);
	return successResponse(c, mapBill(bill));
});

// POST /api/v1/bills/:id/payments
const payRoute = createRoute({
	middleware: [requireTenantAuth("bills.create")],
	method: "post",
	path: "/{id}/payments",
	summary: "Record payment against bill",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						amount: z.string(),
						method: z.enum(METHODS),
						reference: z.string().optional(),
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
						data: z.object({ id: z.string(), status: z.enum(BILL_STATUSES) }),
					}),
				},
			},
		},
	},
});

billsRouter.openapi(payRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const user = c.get("user")!;

	const payment = await billingService.payBill(tenantId, id, user.id, body);
	const bill = await billingService.findById(tenantId, id);

	await auditService.log(c, {
		action: "CREATE",
		entityType: "payment",
		entityId: payment.id,
		newValues: body,
	});
	return successResponse(c, { id: payment.id, status: bill.status }, 201);
});

export default billsRouter;
