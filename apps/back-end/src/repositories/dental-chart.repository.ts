import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
	dentalChartEntries,
	type DentalChartEntry,
	type NewDentalChartEntry,
} from "@/db/schema";

export interface DentalChartListParams {
	tenantId: string;
	patientId?: string;
	doctorId?: string;
	status?: string;
	limit: number;
	offset: number;
}

export class DentalChartRepository {
	async findById(
		tenantId: string,
		id: string,
	): Promise<DentalChartEntry | null> {
		const [entry] = await db
			.select()
			.from(dentalChartEntries)
			.where(
				and(
					eq(dentalChartEntries.tenantId, tenantId),
					eq(dentalChartEntries.id, id),
					isNull(dentalChartEntries.deletedAt),
				),
			)
			.limit(1);

		return entry ?? null;
	}

	async create(
		tenantId: string,
		data: Omit<NewDentalChartEntry, "tenantId">,
	): Promise<DentalChartEntry> {
		const [entry] = await db
			.insert(dentalChartEntries)
			.values({ ...data, tenantId })
			.returning();

		if (!entry) throw new Error("Failed to create dental chart entry");
		return entry;
	}

	async update(
		tenantId: string,
		id: string,
		data: Partial<Omit<NewDentalChartEntry, "tenantId">>,
	): Promise<DentalChartEntry | null> {
		const [entry] = await db
			.update(dentalChartEntries)
			.set(data)
			.where(
				and(
					eq(dentalChartEntries.tenantId, tenantId),
					eq(dentalChartEntries.id, id),
				),
			)
			.returning();

		return entry ?? null;
	}

	async softDelete(tenantId: string, id: string): Promise<boolean> {
		const [entry] = await db
			.update(dentalChartEntries)
			.set({ deletedAt: new Date() })
			.where(
				and(
					eq(dentalChartEntries.tenantId, tenantId),
					eq(dentalChartEntries.id, id),
				),
			)
			.returning({ id: dentalChartEntries.id });

		return entry !== undefined;
	}

	async idsByPatient(tenantId: string, patientId: string): Promise<string[]> {
		const rows = await db
			.select({ id: dentalChartEntries.id })
			.from(dentalChartEntries)
			.where(
				and(
					eq(dentalChartEntries.tenantId, tenantId),
					eq(dentalChartEntries.patientId, patientId),
					isNull(dentalChartEntries.deletedAt),
				),
			);
		return rows.map((r) => r.id);
	}

	async list(params: DentalChartListParams): Promise<DentalChartEntry[]> {
		const conditions: SQL[] = [
			eq(dentalChartEntries.tenantId, params.tenantId),
			isNull(dentalChartEntries.deletedAt),
		];
		if (params.patientId) {
			conditions.push(eq(dentalChartEntries.patientId, params.patientId));
		}
		if (params.doctorId) {
			conditions.push(eq(dentalChartEntries.doctorId, params.doctorId));
		}
		if (params.status) {
			conditions.push(eq(dentalChartEntries.status, params.status as never));
		}

		return db
			.select()
			.from(dentalChartEntries)
			.where(and(...conditions))
			.orderBy(desc(dentalChartEntries.createdAt))
			.limit(params.limit)
			.offset(params.offset);
	}

	async count(
		tenantId: string,
		filters: Omit<DentalChartListParams, "tenantId" | "limit" | "offset">,
	): Promise<number> {
		const conditions: SQL[] = [
			eq(dentalChartEntries.tenantId, tenantId),
			isNull(dentalChartEntries.deletedAt),
		];
		if (filters.patientId) {
			conditions.push(eq(dentalChartEntries.patientId, filters.patientId));
		}
		if (filters.doctorId) {
			conditions.push(eq(dentalChartEntries.doctorId, filters.doctorId));
		}

		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(dentalChartEntries)
			.where(and(...conditions));

		return row?.count ?? 0;
	}

	/** Chart rows for a patient grouped by integer tooth number. */
	async byToothForPatient(
		tenantId: string,
		patientId: string,
		doctorId?: string,
	): Promise<DentalChartEntry[]> {
		const conditions = [
			eq(dentalChartEntries.tenantId, tenantId),
			eq(dentalChartEntries.patientId, patientId),
			isNull(dentalChartEntries.deletedAt),
		];
		if (doctorId) conditions.push(eq(dentalChartEntries.doctorId, doctorId));
		return db
			.select()
			.from(dentalChartEntries)
			.where(and(...conditions))
			.orderBy(
				asc(dentalChartEntries.toothNumber),
				desc(dentalChartEntries.createdAt),
			);
	}
}

export const dentalChartRepository = new DentalChartRepository();
export type { DentalChartEntry };
