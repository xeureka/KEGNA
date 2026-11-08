import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	doctorSchedules,
	type DoctorSchedule,
	type NewDoctorSchedule,
} from "@/db/schema";

export class DoctorScheduleRepository {
	async listForDoctor(
		tenantId: string,
		doctorId: string,
	): Promise<DoctorSchedule[]> {
		return db
			.select()
			.from(doctorSchedules)
			.where(
				and(
					eq(doctorSchedules.tenantId, tenantId),
					eq(doctorSchedules.doctorId, doctorId),
				),
			)
			.orderBy(desc(doctorSchedules.dayOfWeek));
	}

	async listForDoctors(
		tenantId: string,
		doctorIds: string[],
	): Promise<DoctorSchedule[]> {
		if (doctorIds.length === 0) return [];
		return db
			.select()
			.from(doctorSchedules)
			.where(
				and(
					eq(doctorSchedules.tenantId, tenantId),
					inArray(doctorSchedules.doctorId, doctorIds),
				),
			)
			.orderBy(desc(doctorSchedules.dayOfWeek));
	}

	/** Replaces a doctor's whole weekly template inside a transaction. */
	async replaceWeek(
		tenantId: string,
		doctorId: string,
		rows: Array<Omit<NewDoctorSchedule, "tenantId" | "doctorId">>,
	): Promise<DoctorSchedule[]> {
		return db.transaction(async (tx) => {
			await tx
				.delete(doctorSchedules)
				.where(
					and(
						eq(doctorSchedules.tenantId, tenantId),
						eq(doctorSchedules.doctorId, doctorId),
					),
				);

			if (rows.length === 0) return [];

			const created = await tx
				.insert(doctorSchedules)
				.values(
					rows.map((row) => ({
						...row,
						tenantId,
						doctorId,
					})),
				)
				.returning();

			return created;
		});
	}
}

export const doctorScheduleRepository = new DoctorScheduleRepository();
export type { DoctorSchedule };
