import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	appointmentStatusHistory,
	type AppointmentStatus,
	type AppointmentStatusHistory,
	type NewAppointmentStatusHistory,
} from "@/db/schema";

export class AppointmentStatusHistoryRepository {
	async insert(
		tenantId: string,
		data: Omit<NewAppointmentStatusHistory, "tenantId">,
	): Promise<AppointmentStatusHistory> {
		const [history] = await db
			.insert(appointmentStatusHistory)
			.values({ ...data, tenantId })
			.returning();

		if (!history) throw new Error("Failed to record appointment status change");
		return history;
	}

	/** Latest status transition for a single appointment (or null). */
	async findLatestForAppointment(
		appointmentId: string,
	): Promise<AppointmentStatusHistory | null> {
		const [history] = await db
			.select()
			.from(appointmentStatusHistory)
			.where(eq(appointmentStatusHistory.appointmentId, appointmentId))
			.orderBy(
				desc(appointmentStatusHistory.changedAt),
				desc(appointmentStatusHistory.id),
			)
			.limit(1);

		return history ?? null;
	}

	/** Latest transition to a given status for an appointment (e.g. CANCELLED). */
	async findLatestStatus(
		appointmentId: string,
		status: AppointmentStatus,
	): Promise<AppointmentStatusHistory | null> {
		const [history] = await db
			.select()
			.from(appointmentStatusHistory)
			.where(
				and(
					eq(appointmentStatusHistory.appointmentId, appointmentId),
					eq(appointmentStatusHistory.newStatus, status),
				),
			)
			.orderBy(
				desc(appointmentStatusHistory.changedAt),
				desc(appointmentStatusHistory.id),
			)
			.limit(1);

		return history ?? null;
	}

	/** Every transition recorded for a list of appointment ids, ascending. */
	async listForAppointments(
		appointmentIds: string[],
	): Promise<AppointmentStatusHistory[]> {
		if (appointmentIds.length === 0) return [];
		return db
			.select()
			.from(appointmentStatusHistory)
			.where(inArray(appointmentStatusHistory.appointmentId, appointmentIds))
			.orderBy(asc(appointmentStatusHistory.changedAt));
	}
}

export const appointmentStatusHistoryRepository =
	new AppointmentStatusHistoryRepository();
export type { AppointmentStatusHistory };
