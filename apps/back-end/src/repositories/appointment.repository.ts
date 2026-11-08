import {
	and,
	asc,
	count,
	eq,
	gte,
	isNull,
	lt,
	lte,
	type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
	appointments,
	patients,
	doctors,
	users,
	type Appointment,
	type AppointmentStatus,
	type NewAppointment,
} from "@/db/schema";

export interface AppointmentListParams {
	tenantId: string;
	patientId?: string;
	doctorId?: string;
	status?: AppointmentStatus | string;
	dateFrom?: string;
	dateTo?: string;
	limit: number;
	offset: number;
}

export interface AppointmentRow extends Appointment {
	patientName: string;
	doctorName: string;
}

function parseDateParam(value?: string): { gte?: Date; lte?: Date } {
	if (!value) return {};
	const [y = 1970, m = 1, d = 1] = value.split("-").map(Number);
	return {
		gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
		lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
	};
}

export class AppointmentRepository {
	async createAppointment(
		tenantId: string,
		data: Omit<NewAppointment, "tenantId">,
	): Promise<Appointment> {
		const [appointment] = await db
			.insert(appointments)
			.values({ ...data, tenantId })
			.returning();

		if (!appointment) throw new Error("Failed to create appointment");
		return appointment;
	}

	async findAppointmentById(
		tenantId: string,
		id: string,
	): Promise<Appointment | null> {
		const [appointment] = await db
			.select()
			.from(appointments)
			.where(
				and(
					eq(appointments.tenantId, tenantId),
					eq(appointments.id, id),
					isNull(appointments.deletedAt),
				),
			)
			.limit(1);

		return appointment ?? null;
	}

	async findAppointmentRow(
		tenantId: string,
		id: string,
	): Promise<AppointmentRow | null> {
		const rows = await db
			.select({
				appointment: appointments,
				patientName: patients.firstName,
				patientLastName: patients.lastName,
				doctorName: users.name,
			})
			.from(appointments)
			.innerJoin(patients, eq(appointments.patientId, patients.id))
			.innerJoin(doctors, eq(appointments.doctorId, doctors.id))
			.innerJoin(users, eq(doctors.userId, users.id))
			.where(
				and(
					eq(appointments.tenantId, tenantId),
					eq(appointments.id, id),
					isNull(appointments.deletedAt),
				),
			)
			.limit(1);

		const row = rows[0];
		if (!row) return null;

		return {
			...row.appointment,
			patientName: `${row.patientName} ${row.patientLastName}`.trim(),
			doctorName: row.doctorName,
		};
	}

	async listAppointments(
		params: AppointmentListParams,
	): Promise<AppointmentRow[]> {
		const conditions: SQL[] = [
			eq(appointments.tenantId, params.tenantId),
			isNull(appointments.deletedAt),
		];
		if (params.patientId) {
			conditions.push(eq(appointments.patientId, params.patientId));
		}
		if (params.doctorId) {
			conditions.push(eq(appointments.doctorId, params.doctorId));
		}
		if (params.status) {
			conditions.push(eq(appointments.status, params.status as never));
		}
		if (params.dateFrom) {
			conditions.push(
				gte(appointments.startAt, parseDateParam(params.dateFrom).gte!),
			);
		}
		if (params.dateTo) {
			conditions.push(
				lte(appointments.startAt, parseDateParam(params.dateTo).lte!),
			);
		}

		const rows = await db
			.select({
				appointment: appointments,
				patientName: patients.firstName,
				patientLastName: patients.lastName,
				doctorName: users.name,
			})
			.from(appointments)
			.innerJoin(patients, eq(appointments.patientId, patients.id))
			.innerJoin(doctors, eq(appointments.doctorId, doctors.id))
			.innerJoin(users, eq(doctors.userId, users.id))
			.where(and(...conditions))
			.orderBy(asc(appointments.startAt))
			.limit(params.limit)
			.offset(params.offset);

		return rows.map((row) => ({
			...row.appointment,
			patientName: `${row.patientName} ${row.patientLastName}`.trim(),
			doctorName: row.doctorName,
		}));
	}

	async countAppointments(
		tenantId: string,
		filters: Omit<AppointmentListParams, "tenantId" | "limit" | "offset">,
	): Promise<number> {
		const conditions: SQL[] = [
			eq(appointments.tenantId, tenantId),
			isNull(appointments.deletedAt),
		];
		if (filters.patientId) {
			conditions.push(eq(appointments.patientId, filters.patientId));
		}
		if (filters.doctorId) {
			conditions.push(eq(appointments.doctorId, filters.doctorId));
		}
		if (filters.status) {
			conditions.push(eq(appointments.status, filters.status as never));
		}
		if (filters.dateFrom) {
			conditions.push(
				gte(appointments.startAt, parseDateParam(filters.dateFrom).gte!),
			);
		}
		if (filters.dateTo) {
			conditions.push(
				lte(appointments.startAt, parseDateParam(filters.dateTo).lte!),
			);
		}

		const [row] = await db
			.select({ value: count() })
			.from(appointments)
			.innerJoin(patients, eq(appointments.patientId, patients.id))
			.innerJoin(doctors, eq(appointments.doctorId, doctors.id))
			.innerJoin(users, eq(doctors.userId, users.id))
			.where(and(...conditions));

		return row?.value ?? 0;
	}

	async updateAppointment(
		tenantId: string,
		id: string,
		data: Partial<Omit<NewAppointment, "tenantId">>,
	): Promise<Appointment | null> {
		const [appointment] = await db
			.update(appointments)
			.set(data)
			.where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
			.returning();

		return appointment ?? null;
	}

	/** Appointments of the day for the reception queue, with status history. */
	async listForDay(
		tenantId: string,
		date: string,
		doctorId?: string,
	): Promise<AppointmentRow[]> {
		const { gte: from, lte: to } = parseDateParam(date);
		const conditions: SQL[] = [
			eq(appointments.tenantId, tenantId),
			isNull(appointments.deletedAt),
			gte(appointments.startAt, from!),
			lte(appointments.startAt, to!),
		];
		if (doctorId) {
			conditions.push(eq(appointments.doctorId, doctorId));
		}

		const rows = await db
			.select({
				appointment: appointments,
				patientName: patients.firstName,
				patientLastName: patients.lastName,
				doctorName: users.name,
			})
			.from(appointments)
			.innerJoin(patients, eq(appointments.patientId, patients.id))
			.innerJoin(doctors, eq(appointments.doctorId, doctors.id))
			.innerJoin(users, eq(doctors.userId, users.id))
			.where(and(...conditions))
			.orderBy(asc(appointments.startAt));

		return rows.map((row) => ({
			...row.appointment,
			patientName: `${row.patientName} ${row.patientLastName}`.trim(),
			doctorName: row.doctorName,
		}));
	}

	/** Status-histogram for a keeper time window. */
	async countByStatus(
		tenantId: string,
		from: Date,
		to: Date,
		doctorId?: string,
	): Promise<Array<{ status: AppointmentStatus; value: number }>> {
		const conditions: SQL[] = [
			eq(appointments.tenantId, tenantId),
			isNull(appointments.deletedAt),
			gte(appointments.startAt, from),
			lt(appointments.startAt, to),
		];
		if (doctorId) conditions.push(eq(appointments.doctorId, doctorId));
		const rows = await db
			.select({
				status: appointments.status,
				value: count(),
			})
			.from(appointments)
			.where(and(...conditions))
			.groupBy(appointments.status);

		return rows as Array<{ status: AppointmentStatus; value: number }>;
	}
}

export const appointmentRepository = new AppointmentRepository();
export type { Appointment };
