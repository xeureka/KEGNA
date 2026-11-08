import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { patientRepository } from "@/repositories/patient.repository";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";
import { notFoundResponse } from "@/routes/v1/schemas/common";

const patientItemSchema = z.object({
	id: z.string(),
	patientNumber: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	dateOfBirth: z.string().nullable(),
	gender: z.string().nullable(),
	phone: z.string().nullable(),
	email: z.string().nullable(),
	address: z.string().nullable(),
	emergencyContactName: z.string().nullable(),
	emergencyContactPhone: z.string().nullable(),
	createdAt: z.string(),
});

const paginatedSchema = z.object({
	items: z.array(patientItemSchema),
	total: z.number(),
	page: z.number(),
	pageSize: z.number(),
});

const mapPatient = (p: {
	id: string;
	patientNumber: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string | null;
	gender: string | null;
	phone: string | null;
	email: string | null;
	address: string | null;
	emergencyContactName: string | null;
	emergencyContactPhone: string | null;
	membershipTier: string | null;
	createdAt: Date;
}) => ({
	id: p.id,
	patientNumber: p.patientNumber,
	firstName: p.firstName,
	lastName: p.lastName,
	dateOfBirth: p.dateOfBirth,
	gender: p.gender,
	phone: p.phone,
	email: p.email,
	address: p.address,
	emergencyContactName: p.emergencyContactName,
	emergencyContactPhone: p.emergencyContactPhone,
	membershipTier: p.membershipTier,
	createdAt: p.createdAt.toISOString(),
});

export const patientsRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/patients
const listRoute = createRoute({
	middleware: [requireTenantAuth("patients.read")],
	method: "get",
	path: "/",
	summary: "List patients",
	request: {
		query: z.object({
			search: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Paginated patients",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: paginatedSchema }),
				},
			},
		},
	},
});

patientsRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const tenantId = c.get("tenantId")!;
	const page = q.page ?? 1;
	const pageSize = q.pageSize ?? 20;
	const doctorId = c.get("doctorId") ?? undefined;
	const offset = (page - 1) * pageSize;

	const [items, total] = await Promise.all([
		patientRepository.listPatients({
			tenantId,
			search: q.search,
			doctorId,
			limit: pageSize,
			offset,
		}),
		patientRepository.count(tenantId, q.search, undefined, doctorId),
	]);

	return successResponse(c, {
		items: items.map(mapPatient),
		total,
		page,
		pageSize,
	});
});

// POST /api/v1/patients
const createPatientRoute = createRoute({
	middleware: [requireTenantAuth("patients.create")],
	method: "post",
	path: "/",
	summary: "Create patient",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						patientNumber: z.string().min(1),
						firstName: z.string().min(1),
						lastName: z.string().min(1),
						dateOfBirth: z.string().optional().nullable(),
						gender: z.string().optional().nullable(),
						phone: z.string().optional().nullable(),
						email: z.string().email().optional().nullable(),
						address: z.string().optional().nullable(),
						emergencyContactName: z.string().optional().nullable(),
						emergencyContactPhone: z.string().optional().nullable(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created patient",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: patientItemSchema }),
				},
			},
		},
	},
});

patientsRouter.openapi(createPatientRoute, async (c) => {
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;

	const patient = await patientRepository.createPatient(tenantId, {
		patientNumber: body.patientNumber,
		firstName: body.firstName,
		lastName: body.lastName,
		dateOfBirth: body.dateOfBirth ?? null,
		gender: body.gender ?? null,
		phone: body.phone ?? null,
		email: body.email ?? null,
		address: body.address ?? null,
		emergencyContactName: body.emergencyContactName ?? null,
		emergencyContactPhone: body.emergencyContactPhone ?? null,
	});

	await auditService.log(c, {
		action: "CREATE",
		entityType: "patient",
		entityId: patient.id,
		newValues: body,
	});

	return successResponse(c, mapPatient(patient), 201);
});

// GET /api/v1/patients/:id
const getRoute = createRoute({
	middleware: [requireTenantAuth("patients.read")],
	method: "get",
	path: "/{id}",
	summary: "Get patient by id",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Patient",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: patientItemSchema }),
				},
			},
		},
		404: notFoundResponse,
	},
});

patientsRouter.openapi(getRoute, async (c) => {
	const { id } = c.req.valid("param");
	const tenantId = c.get("tenantId")!;
	const doctorId = c.get("doctorId");
	const patient = await patientRepository.findPatientById(tenantId, id);
	if (
		patient &&
		doctorId &&
		!(await patientRepository.hasDoctorAccess(tenantId, id, doctorId))
	)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Patient not found" },
			},
			404,
		);
	if (!patient)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Patient not found" },
			},
			404,
		);
	return successResponse(c, mapPatient(patient));
});

// PATCH /api/v1/patients/:id
const updateRoute = createRoute({
	middleware: [requireTenantAuth("patients.update")],
	method: "patch",
	path: "/{id}",
	summary: "Update patient",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						firstName: z.string().min(1).optional(),
						lastName: z.string().min(1).optional(),
						dateOfBirth: z.string().optional().nullable(),
						gender: z.string().optional().nullable(),
						phone: z.string().optional().nullable(),
						email: z.string().email().optional().nullable(),
						address: z.string().optional().nullable(),
						emergencyContactName: z.string().optional().nullable(),
						emergencyContactPhone: z.string().optional().nullable(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated patient",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: patientItemSchema }),
				},
			},
		},
		404: notFoundResponse,
	},
});

patientsRouter.openapi(updateRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;
	const doctorId = c.get("doctorId");

	const existing = await patientRepository.findPatientById(tenantId, id);
	if (!existing)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Patient not found" },
			},
			404,
		);
	if (
		doctorId &&
		!(await patientRepository.hasDoctorAccess(tenantId, id, doctorId))
	)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Patient not found" },
			},
			404,
		);

	const updated = await patientRepository.updatePatient(tenantId, id, body);
	if (!updated)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Patient not found" },
			},
			404,
		);

	await auditService.log(c, {
		action: "UPDATE",
		entityType: "patient",
		entityId: id,
		oldValues: existing,
		newValues: updated,
	});
	return successResponse(c, mapPatient(updated));
});

export default patientsRouter;
