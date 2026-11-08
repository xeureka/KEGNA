import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { dashboardService } from "@/services/dashboard.service";
import { doctorRepository } from "@/repositories/doctor.repository";
import { successResponse } from "@/utils/api-response";

const dashboardSchema = z.object({
	date: z.string(),
	role: z.string().nullable(),
	outstandingBalance: z.number(),
	today: z.object({
		total: z.number(),
		checkedIn: z.number(),
		inProgress: z.number(),
		completed: z.number(),
		cancelled: z.number(),
		revenueCollected: z.number(),
		queue: z.array(
			z.object({
				id: z.string(),
				patientName: z.string(),
				doctorName: z.string(),
				startAt: z.string(),
				endAt: z.string(),
				status: z.string(),
			}),
		),
	}),
	upcoming: z.object({
		items: z.array(
			z.object({
				id: z.string(),
				patientName: z.string(),
				doctorName: z.string(),
				startAt: z.string(),
				endAt: z.string(),
				status: z.string(),
			}),
		),
		total: z.number(),
	}),
	month: z.object({
		appointments: z.number(),
		newPatients: z.number(),
		billsIssued: z.number(),
		revenueCollected: z.number(),
	}),
	statusDistribution: z.array(
		z.object({ status: z.string(), value: z.number() }),
	),
});

export const dashboardRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/dashboard
const getRoute = createRoute({
	middleware: [requireTenantAuth("dashboard.read")],
	method: "get",
	path: "/",
	summary: "Role-aware dashboard stats",
	responses: {
		200: {
			description: "Dashboard stats",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: dashboardSchema }),
				},
			},
		},
	},
});

dashboardRouter.openapi(getRoute, async (c) => {
	const tenantId = c.get("tenantId")!;
	const roleName = c.get("role")!.name;
	const userId = c.get("user")!.id;

	let doctorId: string | null = null;
	if (roleName === "DOCTOR") {
		const doctor = await doctorRepository.findByUserId(tenantId, userId);
		doctorId = doctor?.id ?? null;
	}

	const stats = await dashboardService.getStats(tenantId, {
		roleName,
		doctorId,
	});

	return successResponse(c, {
		date: stats.date,
		role: stats.role,
		outstandingBalance: stats.outstandingBalance,
		today: {
			total: stats.today.total,
			checkedIn: stats.today.checkedIn,
			inProgress: stats.today.inProgress,
			completed: stats.today.completed,
			cancelled: stats.today.cancelled,
			revenueCollected: stats.today.revenueCollected,
			queue: stats.today.queue.map((a) => ({
				id: a.id,
				patientName: a.patientName,
				doctorName: a.doctorName,
				startAt: a.startAt.toISOString(),
				endAt: a.endAt.toISOString(),
				status: a.status,
			})),
		},
		upcoming: {
			items: stats.upcoming.items.map((a) => ({
				id: a.id,
				patientName: a.patientName,
				doctorName: a.doctorName,
				startAt: a.startAt.toISOString(),
				endAt: a.endAt.toISOString(),
				status: a.status,
			})),
			total: stats.upcoming.total,
		},
		month: stats.month,
		statusDistribution: stats.statusDistribution,
	});
});

export default dashboardRouter;
