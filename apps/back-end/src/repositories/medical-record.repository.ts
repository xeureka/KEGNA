import { and, count, desc, eq, gte, isNull, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
	medicalRecords,
	procedures,
	medicalRecordProcedures,
	patients,
	doctors,
	users,
	type MedicalRecord,
	type NewMedicalRecord,
	type Procedure,
	type NewProcedure,
	type MedicalRecordProcedure,
	type NewMedicalRecordProcedure,
} from "@/db/schema";

export interface MedicalRecordListParams {
	tenantId: string;
	patientId?: string;
	doctorId?: string;
	dateFrom?: string;
	dateTo?: string;
	limit: number;
	offset: number;
}

export class MedicalRecordRepository {
	async createProcedure(
		tenantId: string,
		data: Omit<NewProcedure, "tenantId">,
	): Promise<Procedure> {
		const [proc] = await db
			.insert(procedures)
			.values({ ...data, tenantId })
			.returning();

		if (!proc) throw new Error("Failed to create procedure");
		return proc;
	}

	async listProcedures(tenantId: string): Promise<Procedure[]> {
		return db
			.select()
			.from(procedures)
			.where(
				and(eq(procedures.tenantId, tenantId), isNull(procedures.deletedAt)),
			);
	}

	async createMedicalRecord(
		tenantId: string,
		data: Omit<NewMedicalRecord, "tenantId">,
	): Promise<MedicalRecord> {
		const [record] = await db
			.insert(medicalRecords)
			.values({ ...data, tenantId })
			.returning();

		if (!record) throw new Error("Failed to create medical record");
		return record;
	}

	async findMedicalRecordById(
		tenantId: string,
		id: string,
	): Promise<MedicalRecord | null> {
		const [record] = await db
			.select()
			.from(medicalRecords)
			.where(
				and(
					eq(medicalRecords.tenantId, tenantId),
					eq(medicalRecords.id, id),
					isNull(medicalRecords.deletedAt),
				),
			)
			.limit(1);

		return record ?? null;
	}

	async updateMedicalRecord(
		tenantId: string,
		id: string,
		data: Partial<Omit<NewMedicalRecord, "tenantId">>,
	): Promise<MedicalRecord | null> {
		const [record] = await db
			.update(medicalRecords)
			.set(data)
			.where(
				and(eq(medicalRecords.tenantId, tenantId), eq(medicalRecords.id, id)),
			)
			.returning();

		return record ?? null;
	}

	async listMedicalRecords(
		params: MedicalRecordListParams,
	): Promise<
		Array<MedicalRecord & { patientName: string; doctorName: string }>
	> {
		const conditions: SQL[] = [
			eq(medicalRecords.tenantId, params.tenantId),
			isNull(medicalRecords.deletedAt),
		];
		if (params.patientId) {
			conditions.push(eq(medicalRecords.patientId, params.patientId));
		}
		if (params.doctorId) {
			conditions.push(eq(medicalRecords.doctorId, params.doctorId));
		}
		if (params.dateFrom) {
			conditions.push(
				gte(
					medicalRecords.createdAt,
					new Date(`${params.dateFrom}T00:00:00.000Z`),
				),
			);
		}
		if (params.dateTo) {
			conditions.push(
				lt(
					medicalRecords.createdAt,
					new Date(`${params.dateTo}T23:59:59.999Z`),
				),
			);
		}

		const rows = await db
			.select({
				record: medicalRecords,
				patientName: patients.firstName,
				patientLastName: patients.lastName,
				doctorName: users.name,
			})
			.from(medicalRecords)
			.innerJoin(patients, eq(medicalRecords.patientId, patients.id))
			.leftJoin(doctors, eq(medicalRecords.doctorId, doctors.id))
			.leftJoin(users, eq(doctors.userId, users.id))
			.where(and(...conditions))
			.orderBy(desc(medicalRecords.createdAt))
			.limit(params.limit)
			.offset(params.offset);

		return rows.map((row) => ({
			...row.record,
			patientName: `${row.patientName} ${row.patientLastName}`.trim(),
			doctorName: row.doctorName ?? "",
		}));
	}

	async countMedicalRecords(
		tenantId: string,
		filters: Omit<MedicalRecordListParams, "tenantId" | "limit" | "offset">,
	): Promise<number> {
		const conditions: SQL[] = [
			eq(medicalRecords.tenantId, tenantId),
			isNull(medicalRecords.deletedAt),
		];
		if (filters.patientId) {
			conditions.push(eq(medicalRecords.patientId, filters.patientId));
		}
		if (filters.doctorId) {
			conditions.push(eq(medicalRecords.doctorId, filters.doctorId));
		}

		const [row] = await db
			.select({ value: count() })
			.from(medicalRecords)
			.where(and(...conditions));

		return row?.value ?? 0;
	}

	async addRecordProcedure(
		tenantId: string,
		data: Omit<NewMedicalRecordProcedure, "tenantId">,
	): Promise<MedicalRecordProcedure> {
		const [item] = await db
			.insert(medicalRecordProcedures)
			.values({ ...data, tenantId })
			.returning();

		if (!item) throw new Error("Failed to create medical record procedure");
		return item;
	}
}

export const medicalRecordRepository = new MedicalRecordRepository();
