import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { appointmentService } from "@/services/appointment.service";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

const STATUSES = [
	"SCHEDULED",
	"PENDING_PAYMENT",
	"CONFIRMED",
	"CHECKED_IN",
	"IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
	"NO_SHOW",
] as const;

const appointmentItemSchema = z.object({
	id: z.string(),
	patientId: z.string(),
	doctorId: z.string(),
	startAt: z.string(),
	endAt: z.string(),
	status: z.enum(STATUSES),
	reason: z.string().nullable(),
	notes: z.string().nullable(),
	cancelledAt: z.string().nullable(),
	cancelledReason: z.string().nullable(),
	patientName: z.string(),
	doctorName: z.string(),
});

const mapAppointment = (a: {
	id: string;
	patientId: string;
	doctorId: string;
	startAt: Date;
	endAt: Date;
	status: (typeof STATUSES)[number];
	reason: string | null;
	notes: string | null;
	cancelledAt: Date | null;
	cancelledReason: string | null;
	patientName: string;
	doctorName: string;
}) => ({
	id: a.id,
	patientId: a.patientId,
	doctorId: a.doctorId,
	startAt: a.startAt.toISOString(),
	endAt: a.endAt.toISOString(),
	status: a.status,
	reason: a.reason,
	notes: a.notes,
	cancelledAt: a.cancelledAt ? a.cancelledAt.toISOString() : null,
	cancelledReason: a.cancelledReason,
	patientName: a.patientName,
	doctorName: a.doctorName,
});

export const appointmentsRouter = new OpenAPIHono<AppEnv>();

const listResponse = {
	"application/json": {
		schema: z.object({
			success: z.boolean(),
			data: z.object({
				items: z.array(appointmentItemSchema),
				total: z.number(),
				page: z.number(),
				pageSize: z.number(),
			}),
		}),
	},
};

// GET /api/v1/appointments
const listRoute = createRoute({
	middleware: [requireTenantAuth("appointments.read")],
	method: "get",
	path: "/",
	summary: "List appointments with filters",
	request: {
		query: z.object({
			patientId: z.string().optional(),
			doctorId: z.string().optional(),
			status: z.enum(STATUSES).optional(),
			dateFrom: z.string().optional(),
			dateTo: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: { description: "Paginated appointments", content: listResponse },
	},
});

appointmentsRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const doctorId = c.get("doctorId");
	const result = await appointmentService.list(
		c.get("tenantId")!,
		doctorId ? { ...q, doctorId } : q,
	);
	return successResponse(c, {
		items: result.items.map(mapAppointment),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize,
	});
});

// POST /api/v1/appointments
const createAppointmentRoute = createRoute({
	middleware: [requireTenantAuth("appointments.create")],
	method: "post",
	path: "/",
	summary: "Create appointment",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						patientId: z.string(),
						doctorId: z.string(),
						startAt: z.string(),
						endAt: z.string(),
						reason: z.string().optional(),
						notes: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created appointment",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: appointmentItemSchema,
					}),
				},
			},
		},
	},
});

appointmentsRouter.openapi(createAppointmentRoute, async (c) => {
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const user = c.get("user")!;
	const doctorId = c.get("doctorId");
	if (doctorId && body.doctorId !== doctorId)
		throw new AppError(
			"Doctors may only create appointments for themselves",
			403,
			ErrorCode.FORBIDDEN,
		);

	const appointment = await appointmentService.create(tenantId, user.id, body);
	const row = await appointmentService.findById(tenantId, appointment.id);

	await auditService.log(c, {
		action: "CREATE",
		entityType: "appointment",
		entityId: appointment.id,
		newValues: body,
	});
	return successResponse(c, mapAppointment(row), 201);
});

// GET /api/v1/appointments/queue?date=YYYY-MM-DD
const queueRoute = createRoute({
	middleware: [requireTenantAuth("appointments.read")],
	method: "get",
	path: "/queue",
	summary: "Reception queue for a day",
	request: {
		query: z.object({ date: z.string(), doctorId: z.string().optional() }),
	},
	responses: {
		200: {
			description: "Day queue",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(appointmentItemSchema),
					}),
				},
			},
		},
	},
});

appointmentsRouter.openapi(queueRoute, async (c) => {
	const q = c.req.valid("query");
	const queue = await appointmentService.queueForDay(
		c.get("tenantId")!,
		q.date,
		c.get("doctorId") ?? q.doctorId,
	);
	return successResponse(c, queue.map(mapAppointment));
});

// GET /api/v1/appointments/:id
const getRoute = createRoute({
	middleware: [requireTenantAuth("appointments.read")],
	method: "get",
	path: "/{id}",
	summary: "Get appointment",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Appointment",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: appointmentItemSchema,
					}),
				},
			},
		},
	},
});

appointmentsRouter.openapi(getRoute, async (c) => {
	const { id } = c.req.valid("param");
	const appointment = await appointmentService.findById(c.get("tenantId")!, id);
	if (c.get("doctorId") && appointment.doctorId !== c.get("doctorId"))
		throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
	return successResponse(c, mapAppointment(appointment));
});

// PATCH /api/v1/appointments/:id
const updateRoute = createRoute({
	middleware: [requireTenantAuth("appointments.update")],
	method: "patch",
	path: "/{id}",
	summary: "Update appointment (reschedule / notes)",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						doctorId: z.string().optional(),
						startAt: z.string().optional(),
						endAt: z.string().optional(),
						reason: z.string().optional(),
						notes: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated appointment",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: appointmentItemSchema,
					}),
				},
			},
		},
	},
});

appointmentsRouter.openapi(updateRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const doctorId = c.get("doctorId");
	const existing = await appointmentService.findById(tenantId, id);
	if (doctorId && existing.doctorId !== doctorId)
		throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
	if (doctorId && body.doctorId && body.doctorId !== doctorId)
		throw new AppError(
			"Doctors may only assign their own appointments",
			403,
			ErrorCode.FORBIDDEN,
		);

	const updated = await appointmentService.update(tenantId, id, body);

	await auditService.log(c, {
		action: "UPDATE",
		entityType: "appointment",
		entityId: id,
		newValues: body,
	});
	return successResponse(
		c,
		mapAppointment(await appointmentService.findById(tenantId, updated.id)),
	);
});

// PATCH /api/v1/appointments/:id/status
const statusRoute = createRoute({
	middleware: [requireTenantAuth("appointments.update")],
	method: "patch",
	path: "/{id}/status",
	summary: "Transition appointment status",
	description:
		"Schedule→Confirmed→Checked-in→In-progress→Completed. CANCELLED/NO_SHOW require a reason in the body; the server stamps cancelledAt.",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						status: z.enum(STATUSES),
						reason: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Transitioned appointment",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: appointmentItemSchema,
					}),
				},
			},
		},
		400: { description: "Cancellation requires a reason" },
		409: { description: "Illegal transition" },
	},
});

appointmentsRouter.openapi(statusRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const user = c.get("user")!;
	const doctorId = c.get("doctorId");
	const existing = await appointmentService.findById(tenantId, id);
	if (doctorId && existing.doctorId !== doctorId)
		throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);

	const updated = await appointmentService.transition(
		tenantId,
		id,
		user.id,
		body,
	);

	await auditService.log(c, {
		action: "UPDATE",
		entityType: "appointment",
		entityId: id,
		newValues: body,
	});
	return successResponse(
		c,
		mapAppointment(await appointmentService.findById(tenantId, updated.id)),
	);
});

export default appointmentsRouter;
