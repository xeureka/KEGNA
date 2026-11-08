import { and, asc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { procedures, type Procedure, type NewProcedure } from "@/db/schema";

export interface ProcedureListParams {
	tenantId: string;
	search?: string;
	category?: string;
	includeInactive?: boolean;
	limit: number;
	offset: number;
}

export class ProcedureRepository {
	async findById(tenantId: string, id: string): Promise<Procedure | null> {
		const [procedure] = await db
			.select()
			.from(procedures)
			.where(
				and(
					eq(procedures.tenantId, tenantId),
					eq(procedures.id, id),
					isNull(procedures.deletedAt),
				),
			)
			.limit(1);

		return procedure ?? null;
	}

	async create(
		tenantId: string,
		data: Omit<NewProcedure, "tenantId">,
	): Promise<Procedure> {
		const [procedure] = await db
			.insert(procedures)
			.values({ ...data, tenantId })
			.returning();

		if (!procedure) throw new Error("Failed to create procedure");
		return procedure;
	}

	async update(
		tenantId: string,
		id: string,
		data: Partial<Omit<NewProcedure, "tenantId">>,
	): Promise<Procedure | null> {
		const [procedure] = await db
			.update(procedures)
			.set(data)
			.where(and(eq(procedures.tenantId, tenantId), eq(procedures.id, id)))
			.returning();

		return procedure ?? null;
	}

	async softDelete(tenantId: string, id: string): Promise<boolean> {
		const [procedure] = await db
			.update(procedures)
			.set({ deletedAt: new Date() })
			.where(and(eq(procedures.tenantId, tenantId), eq(procedures.id, id)))
			.returning({ id: procedures.id });

		return procedure !== undefined;
	}

	async list(params: ProcedureListParams): Promise<Procedure[]> {
		const conditions: SQL[] = [
			eq(procedures.tenantId, params.tenantId),
			isNull(procedures.deletedAt),
		];

		if (params.search) {
			conditions.push(
				or(
					like(procedures.name, `%${params.search}%`),
					like(procedures.code, `%${params.search}%`),
				)!,
			);
		}
		if (params.category) {
			conditions.push(eq(procedures.category, params.category));
		}
		if (!params.includeInactive) {
			conditions.push(isNull(procedures.deletedAt));
		}

		return db
			.select()
			.from(procedures)
			.where(and(...conditions))
			.orderBy(asc(procedures.name))
			.limit(params.limit)
			.offset(params.offset);
	}

	async count(
		tenantId: string,
		params: Omit<ProcedureListParams, "tenantId" | "limit" | "offset">,
	): Promise<number> {
		const conditions: SQL[] = [
			eq(procedures.tenantId, tenantId),
			isNull(procedures.deletedAt),
		];
		if (params.search) {
			conditions.push(like(procedures.name, `%${params.search}%`));
		}
		if (params.category) {
			conditions.push(eq(procedures.category, params.category));
		}

		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(procedures)
			.where(and(...conditions));

		return row?.count ?? 0;
	}
}

export const procedureRepository = new ProcedureRepository();
export type { Procedure };
