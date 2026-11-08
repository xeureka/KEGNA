import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { doctorScheduleService } from "@/services/doctor-schedule.service";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";

const daySchema = z.object({
	id: z.string(),
	doctorId: z.string(),
	dayOfWeek: z.number().int().min(0).max(6),
	startTime: z.string(),
	endTime: z.string(),
	isAvailable: z.boolean(),
});

const dayInputSchema = z.object({
	dayOfWeek: z.number().int().min(0).max(6),
	startTime: z.string(),
	endTime: z.string(),
	isAvailable: z.boolean().default(true),
});

const mapDay = (d: {
	id: string;
	doctorId: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	isAvailable: boolean;
}) => ({
	id: d.id,
	doctorId: d.doctorId,
	dayOfWeek: d.dayOfWeek,
	startTime: d.startTime,
	endTime: d.endTime,
	isAvailable: d.isAvailable,
});

export const schedulesRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/schedules/:doctorId
const getWeekRoute = createRoute({
	middleware: [requireTenantAuth("schedules.read")],
	method: "get",
	path: "/{doctorId}",
	summary: "Doctor weekly schedule",
	request: { params: z.object({ doctorId: z.string() }) },
	responses: {
		200: {
			description: "Week template",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: z.array(daySchema) }),
				},
			},
		},
	},
});

schedulesRouter.openapi(getWeekRoute, async (c) => {
	const { doctorId } = c.req.valid("param");
	const week = await doctorScheduleService.getWeek(
		c.get("tenantId")!,
		doctorId,
	);
	return successResponse(c, week.map(mapDay));
});

// PUT /api/v1/schedules/:doctorId
const replaceWeekRoute = createRoute({
	middleware: [requireTenantAuth("schedules.manage")],
	method: "put",
	path: "/{doctorId}",
	summary: "Replace doctor weekly schedule (atomic)",
	request: {
		params: z.object({ doctorId: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({ days: z.array(dayInputSchema).max(7) }),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Replaced week",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: z.array(daySchema) }),
				},
			},
		},
	},
});

schedulesRouter.openapi(replaceWeekRoute, async (c) => {
	const { doctorId } = c.req.valid("param");
	const { days } = c.req.valid("json");
	const week = await doctorScheduleService.replaceWeek(
		c.get("tenantId")!,
		doctorId,
		days,
	);
	await auditService.log(c, {
		action: "UPDATE",
		entityType: "doctor_schedule",
		entityId: doctorId,
		newValues: days,
	});
	return successResponse(c, week.map(mapDay));
});

export default schedulesRouter;
