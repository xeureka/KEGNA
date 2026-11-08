import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { reportService } from "@/services/report.service";
import { successResponse } from "@/utils/api-response";
import { billingRepository } from "@/repositories/billing.repository";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

const dailyReportSchema = z.object({
	date: z.string(),
	appointments: z.object({
		scheduled: z.number(),
		confirmed: z.number(),
		checkedIn: z.number(),
		inProgress: z.number(),
		completed: z.number(),
		cancelled: z.number(),
		noShow: z.number(),
		total: z.number(),
	}),
	patientsSeen: z.number(),
	billsIssued: z.number(),
	invoiced: z.number(),
	revenueCollected: z.number(),
});

export const reportsRouter = new OpenAPIHono<AppEnv>();

const financialRoute = createRoute({
	middleware: [requireTenantAuth("reports.read")],
	method: "get",
	path: "/financial",
	summary: "Financial report by date range, doctor, and treatment type",
	request: {
		query: z.object({
			dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			doctorId: z.string().optional(),
			treatmentType: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Financial report",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							dateFrom: z.string(),
							dateTo: z.string(),
							bills: z.number(),
							invoiced: z.number(),
							collected: z.number(),
							outstanding: z.number(),
						}),
					}),
				},
			},
		},
	},
});

reportsRouter.openapi(financialRoute, async (c) => {
	const q = c.req.valid("query");
	const from = new Date(`${q.dateFrom}T00:00:00.000Z`);
	const to = new Date(`${q.dateTo}T23:59:59.999Z`);
	if (to < from)
		throw new AppError(
			"dateTo must be on or after dateFrom",
			400,
			ErrorCode.BAD_REQUEST,
		);
	const result = await billingRepository.financialReport({
		tenantId: c.get("tenantId")!,
		from,
		to: new Date(to.getTime() + 1),
		doctorId: c.get("doctorId") ?? q.doctorId,
		treatmentType: q.treatmentType,
	});
	return successResponse(c, {
		dateFrom: q.dateFrom,
		dateTo: q.dateTo,
		...result,
		outstanding: Math.max(0, result.invoiced - result.collected),
	});
});

// GET /api/v1/reports/daily?date=YYYY-MM-DD
const dailyRoute = createRoute({
	middleware: [requireTenantAuth("reports.read")],
	method: "get",
	path: "/daily",
	summary: "Daily clinical & financial report",
	request: { query: z.object({ date: z.string() }) },
	responses: {
		200: {
			description: "Daily report",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: dailyReportSchema }),
				},
			},
		},
	},
});

reportsRouter.openapi(dailyRoute, async (c) => {
	const { date } = c.req.valid("query");
	const report = await reportService.daily(
		c.get("tenantId")!,
		date,
		c.get("doctorId") ?? undefined,
	);
	return successResponse(c, report);
});

export default reportsRouter;
