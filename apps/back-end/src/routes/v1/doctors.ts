import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { doctorRepository } from "@/repositories/doctor.repository";
import { auditService } from "@/services/audit.service";
import { successResponse } from "@/utils/api-response";
import { notFoundResponse } from "@/routes/v1/schemas/common";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

const doctorItemSchema = z.object({
	id: z.string(),
	userId: z.string(),
	licenseNumber: z.string(),
	specialization: z.string().nullable(),
	bio: z.string().nullable(),
	isAvailable: z.boolean(),
	userName: z.string(),
	userEmail: z.string(),
});

const mapDoctor = (d: {
	id: string;
	userId: string;
	licenseNumber: string;
	specialization: string | null;
	bio: string | null;
	isAvailable: boolean;
	userName: string;
	userEmail: string;
}) => ({
	id: d.id,
	userId: d.userId,
	licenseNumber: d.licenseNumber,
	specialization: d.specialization,
	bio: d.bio,
	isAvailable: d.isAvailable,
	userName: d.userName,
	userEmail: d.userEmail,
});

export const doctorsRouter = new OpenAPIHono<AppEnv>();

// GET /api/v1/doctors
const listRoute = createRoute({
	middleware: [requireTenantAuth("doctors.read")],
	method: "get",
	path: "/",
	summary: "List doctors",
	request: {
		query: z.object({
			search: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Paginated doctors",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							items: z.array(doctorItemSchema),
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

doctorsRouter.openapi(listRoute, async (c) => {
	const q = c.req.valid("query");
	const tenantId = c.get("tenantId")!;
	const ownDoctorId = c.get("doctorId");
	const page = q.page ?? 1;
	const pageSize = q.pageSize ?? 50;
	const offset = (page - 1) * pageSize;

	const own = ownDoctorId
		? await doctorRepository.findByIdWithUser(tenantId, ownDoctorId)
		: null;
	const [items, total] = ownDoctorId
		? ([
				[own].filter((value): value is NonNullable<typeof own> =>
					Boolean(value),
				),
				own ? 1 : 0,
			] as const)
		: await Promise.all([
				doctorRepository.listDoctors({
					tenantId,
					search: q.search,
					limit: pageSize,
					offset,
				}),
				doctorRepository.countByTenant(tenantId),
			]);

	return successResponse(c, {
		items: items.map(mapDoctor),
		total,
		page,
		pageSize,
	});
});

// GET /api/v1/doctors/me/profile
const meProfileRoute = createRoute({
	middleware: [requireTenantAuth("doctors.read")],
	method: "get",
	path: "/me/profile",
	summary: "Current doctor profile",
	responses: {
		200: {
			description: "Doctor profile",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: doctorItemSchema }),
				},
			},
		},
		404: notFoundResponse,
	},
});

doctorsRouter.openapi(meProfileRoute, async (c) => {
	const tenantId = c.get("tenantId")!;
	const userId = c.get("user")!.id;
	const doctor = await doctorRepository.findByUserIdWithUser(tenantId, userId);
	if (!doctor)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Doctor profile not found" },
			},
			404,
		);
	return successResponse(c, mapDoctor(doctor));
});

// GET /api/v1/doctors/:id
const getRoute = createRoute({
	middleware: [requireTenantAuth("doctors.read")],
	method: "get",
	path: "/{id}",
	summary: "Get doctor by id",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Doctor",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: doctorItemSchema }),
				},
			},
		},
		404: notFoundResponse,
	},
});

doctorsRouter.openapi(getRoute, async (c) => {
	const { id } = c.req.valid("param");
	if (c.get("doctorId") && c.get("doctorId") !== id)
		throw new AppError("Doctor not found", 404, ErrorCode.NOT_FOUND);
	const doctor = await doctorRepository.findByIdWithUser(
		c.get("tenantId")!,
		id,
	);
	if (!doctor)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Doctor not found" },
			},
			404,
		);
	return successResponse(c, mapDoctor(doctor));
});

// PATCH /api/v1/doctors/:id
const updateRoute = createRoute({
	middleware: [requireTenantAuth("doctors.update")],
	method: "patch",
	path: "/{id}",
	summary: "Update doctor profile or availability",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						licenseNumber: z.string().optional(),
						specialization: z.string().optional().nullable(),
						bio: z.string().optional().nullable(),
						isAvailable: z.boolean().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated doctor",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean(), data: doctorItemSchema }),
				},
			},
		},
		404: notFoundResponse,
	},
});

doctorsRouter.openapi(updateRoute, async (c) => {
	const { id } = c.req.valid("param");
	if (c.get("doctorId") && c.get("doctorId") !== id)
		throw new AppError(
			"Doctors may only update their own profile",
			403,
			ErrorCode.FORBIDDEN,
		);
	const body = c.req.valid("json");
	const tenantId = c.get("tenantId")!;

	const existing = await doctorRepository.findByIdWithUser(tenantId, id);
	if (!existing)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Doctor not found" },
			},
			404,
		);

	const updated = await doctorRepository.updateDoctor(tenantId, id, body);
	if (!updated)
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Doctor not found" },
			},
			404,
		);

	const withUser = await doctorRepository.findByIdWithUser(tenantId, id);

	await auditService.log(c, {
		action: "UPDATE",
		entityType: "doctor",
		entityId: id,
		oldValues: existing,
		newValues: updated,
	});
	return successResponse(c, mapDoctor(withUser!));
});

export default doctorsRouter;
