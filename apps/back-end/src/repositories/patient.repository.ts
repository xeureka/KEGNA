import {
	and,
	count,
	desc,
	eq,
	gte,
	isNull,
	like,
	or,
	inArray,
	type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
	patients,
	appointments,
	type Patient,
	type NewPatient,
} from "@/db/schema";

export interface PatientListParams {
	tenantId: string;
	search?: string;
	limit: number;
	offset: number;
	doctorId?: string;
}

export class PatientRepository {
	async createPatient(
		tenantId: string,
		data: Omit<NewPatient, "tenantId">,
	): Promise<Patient> {
		const [patient] = await db
			.insert(patients)
			.values({ ...data, tenantId })
			.returning();

		if (!patient) throw new Error("Failed to create patient");
		return patient;
	}

	async findPatientById(tenantId: string, id: string): Promise<Patient | null> {
		const [patient] = await db
			.select()
			.from(patients)
			.where(
				and(
					eq(patients.tenantId, tenantId),
					eq(patients.id, id),
					isNull(patients.deletedAt),
				),
			)
			.limit(1);

		return patient ?? null;
	}

	/** Convenience alias following the shared repository naming. */
	async findById(tenantId: string, id: string): Promise<Patient | null> {
		return this.findPatientById(tenantId, id);
	}

	async updatePatient(
		tenantId: string,
		id: string,
		data: Partial<Omit<NewPatient, "tenantId">>,
	): Promise<Patient | null> {
		const [patient] = await db
			.update(patients)
			.set(data)
			.where(and(eq(patients.tenantId, tenantId), eq(patients.id, id)))
			.returning();

		return patient ?? null;
	}

	async softDeletePatient(tenantId: string, id: string): Promise<boolean> {
		const [patient] = await db
			.update(patients)
			.set({ deletedAt: new Date() })
			.where(and(eq(patients.tenantId, tenantId), eq(patients.id, id)))
			.returning({ id: patients.id });

		return patient !== undefined;
	}

	async listPatients(params: PatientListParams): Promise<Patient[]> {
		const conditions: SQL[] = [
			eq(patients.tenantId, params.tenantId),
			isNull(patients.deletedAt),
		];
		if (params.search) {
			conditions.push(
				or(
					like(patients.firstName, `%${params.search}%`),
					like(patients.lastName, `%${params.search}%`),
					like(patients.patientNumber, `%${params.search}%`),
					like(patients.phone, `%${params.search}%`),
				)!,
			);
		}
		if (params.doctorId) {
			conditions.push(
				inArray(
					patients.id,
					db
						.select({ patientId: appointments.patientId })
						.from(appointments)
						.where(
							and(
								eq(appointments.tenantId, params.tenantId),
								eq(appointments.doctorId, params.doctorId),
							),
						),
				),
			);
		}

		return db
			.select()
			.from(patients)
			.where(and(...conditions))
			.orderBy(desc(patients.createdAt))
			.limit(params.limit)
			.offset(params.offset);
	}

	async count(
		tenantId: string,
		search?: string,
		createdSince?: Date,
		doctorId?: string,
	): Promise<number> {
		const conditions: SQL[] = [
			eq(patients.tenantId, tenantId),
			isNull(patients.deletedAt),
		];
		if (search) {
			conditions.push(
				or(
					like(patients.firstName, `%${search}%`),
					like(patients.lastName, `%${search}%`),
				)!,
			);
		}
		if (createdSince) {
			conditions.push(gte(patients.createdAt, createdSince));
		}
		if (doctorId) {
			conditions.push(
				inArray(
					patients.id,
					db
						.select({ patientId: appointments.patientId })
						.from(appointments)
						.where(
							and(
								eq(appointments.tenantId, tenantId),
								eq(appointments.doctorId, doctorId),
							),
						),
				),
			);
		}

		const [row] = await db
			.select({ value: count() })
			.from(patients)
			.where(and(...conditions));

		return row?.value ?? 0;
	}

	async hasDoctorAccess(
		tenantId: string,
		patientId: string,
		doctorId: string,
	): Promise<boolean> {
		const [row] = await db
			.select({ id: appointments.id })
			.from(appointments)
			.where(
				and(
					eq(appointments.tenantId, tenantId),
					eq(appointments.patientId, patientId),
					eq(appointments.doctorId, doctorId),
				),
			)
			.limit(1);
		return Boolean(row);
	}
}

export const patientRepository = new PatientRepository();
