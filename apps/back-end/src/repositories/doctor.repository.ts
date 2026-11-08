import { and, asc, count, eq, isNull, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { doctors, users, type Doctor, type NewDoctor } from "@/db/schema";

export interface DoctorListParams {
	tenantId: string;
	search?: string;
	limit: number;
	offset: number;
}

export type DoctorWithUser = Doctor & { userName: string; userEmail: string };

export class DoctorRepository {
	async createDoctor(
		tenantId: string,
		data: Omit<NewDoctor, "tenantId">,
	): Promise<Doctor> {
		const [doctor] = await db
			.insert(doctors)
			.values({ ...data, tenantId })
			.returning();

		if (!doctor) throw new Error("Failed to create doctor");
		return doctor;
	}

	async findDoctorById(tenantId: string, id: string): Promise<Doctor | null> {
		const [doctor] = await db
			.select()
			.from(doctors)
			.where(
				and(
					eq(doctors.tenantId, tenantId),
					eq(doctors.id, id),
					isNull(doctors.deletedAt),
				),
			)
			.limit(1);

		return doctor ?? null;
	}

	/** Convenience alias following the shared repository naming. */
	async findById(tenantId: string, id: string): Promise<Doctor | null> {
		return this.findDoctorById(tenantId, id);
	}

	async findByUserId(tenantId: string, userId: string): Promise<Doctor | null> {
		const [doctor] = await db
			.select()
			.from(doctors)
			.where(
				and(
					eq(doctors.tenantId, tenantId),
					eq(doctors.userId, userId),
					isNull(doctors.deletedAt),
				),
			)
			.limit(1);

		return doctor ?? null;
	}

	async findByIdWithUser(
		tenantId: string,
		id: string,
	): Promise<DoctorWithUser | null> {
		const rows = await db
			.select({
				doctor: doctors,
				userName: users.name,
				userEmail: users.email,
			})
			.from(doctors)
			.innerJoin(users, eq(doctors.userId, users.id))
			.where(
				and(
					eq(doctors.tenantId, tenantId),
					eq(doctors.id, id),
					isNull(doctors.deletedAt),
				),
			)
			.limit(1);

		const row = rows[0];
		if (!row) return null;

		return { ...row.doctor, userName: row.userName, userEmail: row.userEmail };
	}

	async findByUserIdWithUser(
		tenantId: string,
		userId: string,
	): Promise<DoctorWithUser | null> {
		const rows = await db
			.select({
				doctor: doctors,
				userName: users.name,
				userEmail: users.email,
			})
			.from(doctors)
			.innerJoin(users, eq(doctors.userId, users.id))
			.where(
				and(
					eq(doctors.tenantId, tenantId),
					eq(doctors.userId, userId),
					isNull(doctors.deletedAt),
				),
			)
			.limit(1);

		const row = rows[0];
		if (!row) return null;

		return { ...row.doctor, userName: row.userName, userEmail: row.userEmail };
	}

	async updateDoctor(
		tenantId: string,
		id: string,
		data: Partial<Omit<NewDoctor, "tenantId">>,
	): Promise<Doctor | null> {
		const [doctor] = await db
			.update(doctors)
			.set(data)
			.where(and(eq(doctors.tenantId, tenantId), eq(doctors.id, id)))
			.returning();

		return doctor ?? null;
	}

	async listDoctors(params: DoctorListParams): Promise<DoctorWithUser[]> {
		const conditions: SQL[] = [
			eq(doctors.tenantId, params.tenantId),
			isNull(doctors.deletedAt),
		];
		if (params.search) {
			conditions.push(
				or(
					like(users.name, `%${params.search}%`),
					like(doctors.specialization, `%${params.search}%`),
					like(doctors.licenseNumber, `%${params.search}%`),
				)!,
			);
		}

		const rows = await db
			.select({
				doctor: doctors,
				userName: users.name,
				userEmail: users.email,
			})
			.from(doctors)
			.innerJoin(users, eq(doctors.userId, users.id))
			.where(and(...conditions))
			.orderBy(asc(users.name))
			.limit(params.limit)
			.offset(params.offset);

		return rows.map((row) => ({
			...row.doctor,
			userName: row.userName,
			userEmail: row.userEmail,
		}));
	}

	async countByTenant(tenantId: string): Promise<number> {
		const [row] = await db
			.select({ value: count() })
			.from(doctors)
			.where(and(eq(doctors.tenantId, tenantId), isNull(doctors.deletedAt)));

		return row?.value ?? 0;
	}
}

export const doctorRepository = new DoctorRepository();
