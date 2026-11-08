import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { dentalChartService } from "@/services/dental-chart.service";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";

const STATUSES = ["PLANNED", "COMPLETED", "CANCELLED"] as const;

const entrySchema = z.object({
	id: z.string(),
	patientId: z.string(),
	doctorId: z.string(),
	appointmentId: z.string().nullable(),
	toothNumber: z.number(),
	surface: z.string().nullable(),
	procedureId: z.string().nullable(),
	procedureName: z.string(),
	notes: z.string().nullable(),
	charge: z.string(),
	status: z.enum(STATUSES),
	datePerformed: z.string().nullable(),
	createdAt: z.string(),
});

const mapEntry = (e: {
	id: string;
	patientId: string;
	doctorId: string;
	appointmentId: string | null;
	toothNumber: number;
	surface: string | null;
	procedureId: string | null;
	procedureName: string;
	notes: string | null;
	charge: string;
	status: (typeof STATUSES)[number];
	datePerformed: string | null;
	createdAt: Date;
}) => ({
	id: e.id,
	patientId: e.patientId,
	doctorId: e.doctorId,
	appointmentId: e.appointmentId,
	toothNumber: e.toothNumber,
	surface: e.surface,
	procedureId: e.procedureId,
	procedureName: e.procedureName,
	notes: e.notes,
	charge: e.charge,
	status: e.status,
	datePerformed: e.datePerformed,
	createdAt: e.createdAt.toISOString(),
});

export const dentalChartRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/dental-chart  (filters: patientId, doctorId, status)
const listRoute = createRoute({
	middleware: [requireTenantAuth("dental_chart.read")],
	method: "get",
	path: "/",
	summary: "List dental chart entries",
	request: {
		query: z.object({
			patientId: z.string().optional(),
			doctorId: z.string().optional(),
			status: z.enum(STATUSES).optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Paginated entries",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							items: z.array(entrySchema),
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

dentalChartRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const doctorId = c.get("doctorId");
	const result = await dentalChartService.list(
		c.get("tenantId")!,
		doctorId ? { ...q, doctorId } : q,
	);
	return successResponse(c, {
		items: result.items.map(mapEntry),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize,
	});
});

// GET /api/v1/dental-chart/by-tooth?patientId=
const byToothRoute = createRoute({
	middleware: [requireTenantAuth("dental_chart.read")],
	method: "get",
	path: "/by-tooth",
	summary: "Dental chart entries grouped by tooth for a patient",
	request: { query: z.object({ patientId: z.string() }) },
	responses: {
		200: {
			description: "Entries for the patient",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(entrySchema),
					}),
				},
			},
		},
	},
});

dentalChartRouter.openapi(byToothRoute, async (c) => {
	const { patientId } = c.req.valid("query");
	const entries = await dentalChartService.byToothForPatient(
		c.get("tenantId")!,
		patientId,
		c.get("doctorId") ?? undefined,
	);
	return successResponse(c, entries.map(mapEntry));
});

// POST /api/v1/dental-chart
const createDentalentryRoute = createRoute({
	middleware: [requireTenantAuth("dental_chart.create")],
	method: "post",
	path: "/",
	summary: "Add dental chart entry",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						patientId: z.string(),
						doctorId: z.string(),
						appointmentId: z.string().optional(),
						toothNumber: z.number().int().min(1).max(32),
						surface: z.string().min(1).max(10).optional(),
						procedureId: z.string().optional(),
						procedureName: z.string().min(1),
						notes: z.string().optional(),
						charge: z.string(),
						status: z.enum(STATUSES).optional(),
						datePerformed: z.string().optional().nullable(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created entry",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: entrySchema }),
				},
			},
		},
	},
});

dentalChartRouter.openapi(createDentalentryRoute, async (c) => {
	const body = c.req.valid("json");
	const doctorId = c.get("doctorId");
	if (doctorId && body.doctorId !== doctorId)
		throw new Error("Doctors may only add their own chart entries");
	const entry = await dentalChartService.addEntry(c.get("tenantId")!, body);
	await auditService.log(c, {
		action: "CREATE",
		entityType: "dental_chart_entry",
		entityId: entry.id,
		newValues: body,
	});
	return successResponse(c, mapEntry(entry), 201);
});

// PATCH /api/v1/dental-chart/:id
const updateRoute = createRoute({
	middleware: [requireTenantAuth("dental_chart.update")],
	method: "patch",
	path: "/{id}",
	summary: "Update dental chart entry",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						surface: z.string().min(1).max(10).optional(),
						notes: z.string().optional(),
						charge: z.string().optional(),
						status: z.enum(STATUSES).optional(),
						datePerformed: z.string().optional().nullable(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated entry",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: entrySchema }),
				},
			},
		},
	},
});

dentalChartRouter.openapi(updateRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const updated = await dentalChartService.updateEntry(
		c.get("tenantId")!,
		id,
		body,
	);
	await auditService.log(c, {
		action: "UPDATE",
		entityType: "dental_chart_entry",
		entityId: id,
		newValues: body,
	});
	return successResponse(c, mapEntry(updated));
});

// DELETE /api/v1/dental-chart/:id
const deleteRoute = createRoute({
	middleware: [requireTenantAuth("dental_chart.update")],
	method: "delete",
	path: "/{id}",
	summary: "Soft-delete dental chart entry",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Deleted",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({ message: z.string() }),
					}),
				},
			},
		},
	},
});

dentalChartRouter.openapi(deleteRoute, async (c) => {
	const { id } = c.req.valid("param");
	await dentalChartService.removeEntry(c.get("tenantId")!, id);
	await auditService.log(c, {
		action: "DELETE",
		entityType: "dental_chart_entry",
		entityId: id,
	});
	return successResponse(c, { message: "Dental chart entry deleted" });
});

export default dentalChartRouter;
