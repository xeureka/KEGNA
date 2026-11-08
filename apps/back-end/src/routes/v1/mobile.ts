import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { AppEnv } from "@/types/hono";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { db } from "@/db";
import {
	appointments,
	bills,
	cardProducts,
	doctors,
	dentalChartEntries,
	medicalRecords,
	notifications,
	patients,
	procedures,
	users,
	userCards,
} from "@/db/schema";
import { successResponse } from "@/utils/api-response";
import { appointmentService } from "@/services/appointment.service";
import { billingService } from "@/services/billing.service";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { calculateChapaAmounts } from "@/services/payment-money";
import { env } from "@/lib/env";

const mobile = new OpenAPIHono<AppEnv>();
mobile.use("*", requireTenantAuth());

async function currentUser(c: any) {
	const authUser = c.get("user") as { id: string };
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, authUser.id))
		.limit(1);
	return user ?? null;
}

async function patientForUser(c: any) {
	const user = await currentUser(c);
	if (!user?.phone) return { user, patient: null };
	const [patient] = await db
		.select()
		.from(patients)
		.where(
			and(
				eq(patients.tenantId, c.get("tenantId")!),
				eq(patients.phone, user.phone),
				isNull(patients.deletedAt),
			),
		)
		.limit(1);
	return { user, patient: patient ?? null };
}

const profileRoute = createRoute({
	method: "get",
	path: "/me",
	summary: "Get the authenticated mobile patient's profile",
	responses: {
		200: {
			description: "Mobile profile",
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

mobile.openapi(profileRoute, async (c) => {
	const { user, patient } = await patientForUser(c);
	const cards = user
		? await db
				.select({
					id: userCards.id,
					status: userCards.status,
					activatedAt: userCards.activatedAt,
					expiresAt: userCards.expiresAt,
					name: cardProducts.name,
				})
				.from(userCards)
				.innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
				.where(
					and(
						eq(userCards.tenantId, c.get("tenantId")!),
						eq(userCards.userId, user.id),
					),
				)
				.orderBy(desc(userCards.createdAt))
		: [];
	return successResponse(c, {
		user: user
			? { id: user.id, name: user.name, email: user.email, phone: user.phone }
			: null,
		patient: patient ?? null,
		cards,
	});
});

const appointmentsRoute = createRoute({
	method: "get",
	path: "/appointments",
	summary: "List appointments belonging to the authenticated mobile patient",
	responses: {
		200: {
			description: "Patient appointments",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.record(z.string(), z.unknown())),
					}),
				},
			},
		},
	},
});

mobile.openapi(appointmentsRoute, async (c) => {
	const { user } = await patientForUser(c);
	if (!user?.phone) return successResponse(c, []);
	const rows = await db
		.select({ appointment: appointments, patient: patients, doctor: doctors })
		.from(appointments)
		.innerJoin(patients, eq(appointments.patientId, patients.id))
		.innerJoin(doctors, eq(appointments.doctorId, doctors.id))
		.where(
			and(
				eq(appointments.tenantId, c.get("tenantId")!),
				eq(patients.phone, user.phone),
				isNull(appointments.deletedAt),
			),
		)
		.orderBy(asc(appointments.startAt));
	return successResponse(
		c,
		rows.map(({ appointment, patient, doctor }) => ({
			id: appointment.id,
			patientId: patient.id,
			doctorId: doctor.id,
			startAt: appointment.startAt.toISOString(),
			endAt: appointment.endAt.toISOString(),
			status: appointment.status,
			reason: appointment.reason,
			patientName: `${patient.firstName} ${patient.lastName}`,
			doctorName: doctor.userId,
		})),
	);
});

const createAppointmentRoute = createRoute({
	method: "post",
	path: "/appointments",
	summary: "Create an appointment for the authenticated mobile patient",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						doctorId: z.string(),
						startAt: z.string(),
						endAt: z.string(),
						reason: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Appointment created",
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

mobile.openapi(createAppointmentRoute, async () => {
	throw new AppError(
		"New visits must be booked through the payment checkout flow",
		409,
		ErrorCode.CONFLICT,
	);
});

const rescheduleAppointmentRoute = createRoute({
	method: "patch",
	path: "/appointments/{id}",
	summary: "Reschedule an authenticated mobile patient's appointment",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						startAt: z.string(),
						endAt: z.string(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Appointment rescheduled",
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

mobile.openapi(rescheduleAppointmentRoute, async (c) => {
	const { user, patient } = await patientForUser(c);
	if (!user?.phone)
		throw new AppError(
			"A verified phone number is required",
			400,
			ErrorCode.BAD_REQUEST,
		);
	const appointmentId = c.req.valid("param").id;
	const existing = await appointmentService.findById(
		c.get("tenantId")!,
		appointmentId,
	);
	if (!patient || existing.patientId !== patient.id)
		throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
	const updated = await appointmentService.update(
		c.get("tenantId")!,
		appointmentId,
		c.req.valid("json"),
	);
	return successResponse(c, {
		id: updated.id,
		status: updated.status,
		startAt: updated.startAt.toISOString(),
		endAt: updated.endAt.toISOString(),
	});
});

const billsRoute = createRoute({
	method: "get",
	path: "/bills",
	summary: "List bills belonging to the authenticated mobile patient",
	responses: {
		200: {
			description: "Patient bills",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.record(z.string(), z.unknown())),
					}),
				},
			},
		},
	},
});

mobile.openapi(billsRoute, async (c) => {
	const { user } = await patientForUser(c);
	if (!user?.phone) return successResponse(c, []);
	const rows = await db
		.select({ bill: bills, patient: patients })
		.from(bills)
		.innerJoin(patients, eq(bills.patientId, patients.id))
		.where(
			and(
				eq(bills.tenantId, c.get("tenantId")!),
				eq(patients.phone, user.phone),
				isNull(bills.deletedAt),
			),
		)
		.orderBy(asc(bills.createdAt));
	const items = await Promise.all(
		rows.map(async ({ bill, patient }) => {
			const detail = await billingService.findById(c.get("tenantId")!, bill.id);
			const balanceDue = Math.max(
				0,
				Number(bill.totalAmount) - Number(detail.amountPaid),
			);
			return {
				id: bill.id,
				billNumber: bill.billNumber,
				patientName: `${patient.firstName} ${patient.lastName}`,
				status: bill.status,
				totalAmount: bill.totalAmount,
				amountPaid: detail.amountPaid,
				balanceDue: String(balanceDue),
				issuedAt: bill.issuedAt?.toISOString() ?? null,
			};
		}),
	);
	return successResponse(c, items);
});

const payBillRoute = createRoute({
	method: "post",
	path: "/bills/{id}/payments",
	summary: "Record a payment for the authenticated mobile patient's bill",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						amount: z.string(),
						method: z.enum([
							"CASH",
							"CARD",
							"BANK_TRANSFER",
							"MOBILE_MONEY",
							"OTHER",
						]),
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
						data: z.object({ id: z.string(), status: z.string() }),
					}),
				},
			},
		},
	},
});

mobile.openapi(payBillRoute, async (_c) => {
	throw new AppError(
		"Payments are recorded by reception; the mobile app only displays the current balance",
		403,
		ErrorCode.FORBIDDEN,
	);
});

const cancelAppointmentRoute = createRoute({
	method: "post",
	path: "/appointments/{id}/cancel",
	summary: "Cancel an authenticated mobile patient's appointment",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({ reason: z.string().min(1).max(500) }),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Appointment cancelled",
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

mobile.openapi(cancelAppointmentRoute, async (c) => {
	const { user } = await patientForUser(c);
	if (!user?.phone)
		throw new AppError(
			"A verified phone number is required",
			400,
			ErrorCode.BAD_REQUEST,
		);
	const [appointment] = await db
		.select({ id: appointments.id })
		.from(appointments)
		.innerJoin(patients, eq(appointments.patientId, patients.id))
		.where(
			and(
				eq(appointments.id, c.req.valid("param").id),
				eq(appointments.tenantId, c.get("tenantId")!),
				eq(patients.phone, user.phone),
				isNull(appointments.deletedAt),
			),
		)
		.limit(1);
	if (!appointment)
		throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
	const [updated] = await db
		.update(appointments)
		.set({
			status: "CANCELLED",
			cancelledAt: new Date(),
			cancelledReason: c.req.valid("json").reason,
		})
		.where(eq(appointments.id, appointment.id))
		.returning({ id: appointments.id, status: appointments.status });
	if (!updated)
		throw new AppError(
			"Appointment could not be cancelled",
			500,
			ErrorCode.INTERNAL_SERVER_ERROR,
		);
	return successResponse(c, updated, 200);
});

const servicesRoute = createRoute({
	method: "get",
	path: "/services",
	summary: "List active dental services for the mobile tenant",
	responses: {
		200: {
			description: "Services",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.record(z.string(), z.unknown())),
					}),
				},
			},
		},
	},
});

mobile.openapi(servicesRoute, async (c) => {
	const rows = await db
		.select({
			id: procedures.id,
			code: procedures.code,
			name: procedures.name,
			category: procedures.category,
			price: procedures.defaultPrice,
			durationMinutes: procedures.defaultDurationMinutes,
		})
		.from(procedures)
		.where(
			and(
				eq(procedures.tenantId, c.get("tenantId")!),
				eq(procedures.isActive, true),
				isNull(procedures.deletedAt),
			),
		)
		.orderBy(asc(procedures.name));
	return successResponse(
		c,
		rows.map((service) => ({
			...service,
			inclusivePrice:
				service.price === null
					? null
					: calculateChapaAmounts(service.price, env.SERVICE_CHARGE_ETB)
							.totalAmount,
		})),
	);
});

const historyRoute = createRoute({
	method: "get",
	path: "/dental-history",
	summary: "List the authenticated mobile patient's clinical history",
	responses: {
		200: {
			description: "Dental history",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.record(z.string(), z.unknown())),
					}),
				},
			},
		},
	},
});

mobile.openapi(historyRoute, async (c) => {
	const { patient } = await patientForUser(c);
	if (!patient) return successResponse(c, []);
	const records = await db
		.select()
		.from(medicalRecords)
		.where(
			and(
				eq(medicalRecords.tenantId, c.get("tenantId")!),
				eq(medicalRecords.patientId, patient.id),
				isNull(medicalRecords.deletedAt),
			),
		)
		.orderBy(desc(medicalRecords.createdAt));
	const chart = await db
		.select()
		.from(dentalChartEntries)
		.where(
			and(
				eq(dentalChartEntries.tenantId, c.get("tenantId")!),
				eq(dentalChartEntries.patientId, patient.id),
				isNull(dentalChartEntries.deletedAt),
			),
		)
		.orderBy(desc(dentalChartEntries.createdAt));
	return successResponse(
		c,
		[
			...records.map((record) => ({
				id: record.id,
				type: "medical_record",
				date: record.createdAt.toISOString(),
				title: record.chiefComplaint ?? "Clinical visit",
				notes: record.notes ?? record.treatment ?? "",
				diagnosis: record.diagnosis ?? null,
			})),
			...chart.map((entry) => ({
				id: entry.id,
				type: "dental_chart",
				date: (entry.datePerformed
					? new Date(entry.datePerformed)
					: entry.createdAt
				).toISOString(),
				title: entry.procedureName,
				notes: entry.notes ?? "",
				toothNumber: entry.toothNumber,
				status: entry.status,
			})),
		].toSorted((a, b) => b.date.localeCompare(a.date)),
	);
});

const notificationsRoute = createRoute({
	method: "get",
	path: "/notifications",
	summary: "List notifications for the authenticated mobile user",
	responses: {
		200: {
			description: "Notifications",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(z.record(z.string(), z.unknown())),
					}),
				},
			},
		},
	},
});

mobile.openapi(notificationsRoute, async (c) => {
	const user = await currentUser(c);
	if (!user) return successResponse(c, []);
	const rows = await db
		.select({
			id: notifications.id,
			type: notifications.type,
			title: notifications.title,
			message: notifications.message,
			status: notifications.status,
			readAt: notifications.readAt,
			createdAt: notifications.createdAt,
		})
		.from(notifications)
		.where(
			and(
				eq(notifications.tenantId, c.get("tenantId")!),
				eq(notifications.userId, user.id),
				eq(notifications.status, "UNREAD"),
			),
		)
		.orderBy(desc(notifications.createdAt));
	return successResponse(
		c,
		rows.map((row) => ({
			...row,
			readAt: row.readAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
		})),
	);
});

const markNotificationReadRoute = createRoute({
	method: "post",
	path: "/notifications/{id}/read",
	summary: "Mark one mobile notification as seen",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Notification marked as seen",
			content: {
				"application/json": { schema: z.object({ success: z.boolean() }) },
			},
		},
	},
});

mobile.openapi(markNotificationReadRoute, async (c) => {
	const user = await currentUser(c);
	if (!user) return successResponse(c, { marked: false });
	await db
		.update(notifications)
		.set({ status: "READ", readAt: new Date() })
		.where(
			and(
				eq(notifications.id, c.req.valid("param").id),
				eq(notifications.tenantId, c.get("tenantId")!),
				eq(notifications.userId, user.id),
			),
		);
	return successResponse(c, { marked: true });
});

const updateProfileRoute = createRoute({
	method: "patch",
	path: "/me",
	summary: "Update the authenticated mobile user's profile",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						name: z.string().min(1).optional(),
						email: z.string().email().optional(),
						dateOfBirth: z.string().optional(),
						emergencyContactPhone: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Profile updated",
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

mobile.openapi(updateProfileRoute, async (c) => {
	const user = await currentUser(c);
	if (!user) throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
	const input = c.req.valid("json");
	const [updatedUser] = await db
		.update(users)
		.set({
			...(input.name ? { name: input.name } : {}),
			...(input.email ? { email: input.email } : {}),
		})
		.where(eq(users.id, user.id))
		.returning();
	if (input.email || input.dateOfBirth || input.emergencyContactPhone) {
		const patient = await patientForUser(c);
		if (patient.patient)
			await db
				.update(patients)
				.set({
					...(input.email ? { email: input.email } : {}),
					...(input.dateOfBirth ? { dateOfBirth: input.dateOfBirth } : {}),
					...(input.emergencyContactPhone
						? { emergencyContactPhone: input.emergencyContactPhone }
						: {}),
				})
				.where(eq(patients.id, patient.patient.id));
	}
	if (!updatedUser)
		throw new AppError(
			"Profile could not be updated",
			500,
			ErrorCode.INTERNAL_SERVER_ERROR,
		);
	return successResponse(c, {
		user: {
			id: updatedUser.id,
			name: updatedUser.name,
			email: updatedUser.email,
			phone: updatedUser.phone,
		},
	});
});

export default mobile;
