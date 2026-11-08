import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { medicalRecordService } from "@/services/medical-record.service";
import { medicalRecordRepository } from "@/repositories/medical-record.repository";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";
import type { MedicalRecord } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

const recordItemSchema = z.object({
	id: z.string(),
	patientId: z.string(),
	doctorId: z.string().nullable(),
	appointmentId: z.string().nullable(),
	chiefComplaint: z.string().nullable(),
	diagnosis: z.string().nullable(),
	treatment: z.string().nullable(),
	notes: z.string().nullable(),
	patientName: z.string(),
	doctorName: z.string().nullable(),
	createdAt: z.string(),
});

const mapRecord = (r: {
	id: string;
	patientId: string;
	doctorId: string | null;
	appointmentId: string | null;
	chiefComplaint: string | null;
	diagnosis: string | null;
	treatment: string | null;
	notes: string | null;
	patientName: string;
	doctorName: string | null;
	createdAt: Date;
}) => ({
	id: r.id,
	patientId: r.patientId,
	doctorId: r.doctorId,
	appointmentId: r.appointmentId,
	chiefComplaint: r.chiefComplaint,
	diagnosis: r.diagnosis,
	treatment: r.treatment,
	notes: r.notes,
	patientName: r.patientName,
	doctorName: r.doctorName,
	createdAt: r.createdAt.toISOString(),
});

export const medicalRecordsRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/medical-records
const listRoute = createRoute({
	middleware: [requireTenantAuth("medical_records.read")],
	method: "get",
	path: "/",
	summary: "List medical records",
	request: {
		query: z.object({
			patientId: z.string().optional(),
			doctorId: z.string().optional(),
			dateFrom: z.string().optional(),
			dateTo: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Paginated records",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							items: z.array(recordItemSchema),
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

medicalRecordsRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const doctorId = c.get("doctorId");
	const result = await medicalRecordService.list(
		c.get("tenantId")!,
		doctorId ? { ...q, doctorId } : q,
	);
	return successResponse(c, {
		items: result.items.map(mapRecord),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize,
	});
});

// POST /api/v1/medical-records
const createRecordRoute = createRoute({
	middleware: [requireTenantAuth("medical_records.create")],
	method: "post",
	path: "/",
	summary: "Create medical record",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						patientId: z.string(),
						doctorId: z.string().optional(),
						appointmentId: z.string().optional(),
						chiefComplaint: z.string().optional(),
						diagnosis: z.string().optional(),
						treatment: z.string().optional(),
						notes: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created record",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: recordItemSchema }),
				},
			},
		},
	},
});

medicalRecordsRouter.openapi(createRecordRoute, async (c) => {
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const user = c.get("user")!;
	const doctorId = c.get("doctorId");
	if (doctorId && body.doctorId && body.doctorId !== doctorId)
		throw new Error("Doctors may only create their own records");

	const record = await medicalRecordService.create(tenantId, user.id, body);
	const created = { ...record, patientName: body.patientId, doctorName: null };

	await auditService.log(c, {
		action: "CREATE",
		entityType: "medical_record",
		entityId: record.id,
		newValues: body,
	});
	return successResponse(
		c,
		mapRecord({ ...created, createdAt: record.createdAt }),
		201,
	);
});

// PATCH /api/v1/medical-records/:id
const updateRoute = createRoute({
	middleware: [requireTenantAuth("medical_records.create")],
	method: "patch",
	path: "/{id}",
	summary: "Update medical record",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						doctorId: z.string().optional(),
						chiefComplaint: z.string().optional(),
						diagnosis: z.string().optional(),
						treatment: z.string().optional(),
						notes: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated record",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: recordItemSchema }),
				},
			},
		},
	},
});

medicalRecordsRouter.openapi(updateRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const doctorId = c.get("doctorId");
	const current = await medicalRecordRepository.findMedicalRecordById(
		tenantId,
		id,
	);
	if (!current || (doctorId && current.doctorId !== doctorId))
		throw new AppError("Medical record not found", 404, ErrorCode.NOT_FOUND);

	await medicalRecordService.update(tenantId, id, body);
	const raw = await medicalRecordRepository.findMedicalRecordById(tenantId, id);

	await auditService.log(c, {
		action: "UPDATE",
		entityType: "medical_record",
		entityId: id,
		newValues: body,
	});
	return successResponse(
		c,
		mapRecord({ ...(raw as MedicalRecord), patientName: "", doctorName: null }),
	);
});

// POST /api/v1/medical-records/:id/procedures
const attachProcedureRoute = createRoute({
	middleware: [requireTenantAuth("medical_records.create")],
	method: "post",
	path: "/{id}/procedures",
	summary: "Attach procedure to medical record",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						procedureId: z.string(),
						toothNumber: z.string().optional(),
						quadrant: z.string().optional(),
						notes: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Attached",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({ id: z.string() }),
					}),
				},
			},
		},
	},
});

medicalRecordsRouter.openapi(attachProcedureRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const attached = await medicalRecordService.attachProcedure(
		c.get("tenantId")!,
		id,
		body,
	);
	await auditService.log(c, {
		action: "UPDATE",
		entityType: "medical_record",
		entityId: id,
		newValues: body,
	});
	return successResponse(c, { id: attached.id }, 201);
});

export default medicalRecordsRouter;
