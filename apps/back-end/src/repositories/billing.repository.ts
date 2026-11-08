import {
	and,
	count,
	desc,
	eq,
	gte,
	ilike,
	isNull,
	lt,
	ne,
	sql,
	exists,
} from "drizzle-orm";
import { db } from "@/db";
import {
	bills,
	billItems,
	payments,
	appointments,
	patients,
	type Bill,
	type NewBill,
	type BillItem,
	type NewBillItem,
	type Payment,
	type NewPayment,
} from "@/db/schema";

export interface BillListParams {
	tenantId: string;
	patientId?: string;
	status?: string;
	limit: number;
	offset: number;
}

export interface BillRow extends Bill {
	patientName: string;
	amountPaid: string;
}

export class BillingRepository {
	async createBill(
		tenantId: string,
		data: Omit<NewBill, "tenantId">,
	): Promise<Bill> {
		const [bill] = await db
			.insert(bills)
			.values({ ...data, tenantId })
			.returning();

		if (!bill) throw new Error("Failed to create bill");
		return bill;
	}

	async createBillItem(
		tenantId: string,
		data: Omit<NewBillItem, "tenantId">,
	): Promise<BillItem> {
		const [item] = await db
			.insert(billItems)
			.values({ ...data, tenantId })
			.returning();

		if (!item) throw new Error("Failed to create bill item");
		return item;
	}

	async createPayment(
		tenantId: string,
		data: Omit<NewPayment, "tenantId">,
	): Promise<Payment> {
		const [payment] = await db
			.insert(payments)
			.values({ ...data, tenantId })
			.returning();

		if (!payment) throw new Error("Failed to create payment");
		return payment;
	}

	async findBillById(tenantId: string, id: string): Promise<Bill | null> {
		const [bill] = await db
			.select()
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					eq(bills.id, id),
					isNull(bills.deletedAt),
				),
			)
			.limit(1);

		return bill ?? null;
	}

	async findBillByAppointmentId(
		tenantId: string,
		appointmentId: string,
	): Promise<Bill | null> {
		const [bill] = await db
			.select()
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					eq(bills.appointmentId, appointmentId),
					isNull(bills.deletedAt),
				),
			)
			.limit(1);
		return bill ?? null;
	}

	async outstandingBalance(tenantId: string): Promise<number> {
		const [row] = await db
			.select({
				value: sql<number>`COALESCE(SUM(GREATEST(bills.total_amount - (COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED')), 0) + COALESCE((SELECT SUM(p.base_amount) FROM payments p WHERE p.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED') AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)), 0))::numeric, 0)`,
			})
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					isNull(bills.deletedAt),
					ne(bills.status, "CANCELLED"),
					ne(bills.status, "VOID"),
				),
			);
		return Number(row?.value ?? 0);
	}

	async updateBill(
		tenantId: string,
		id: string,
		data: Partial<Omit<NewBill, "tenantId">>,
	): Promise<Bill | null> {
		const [bill] = await db
			.update(bills)
			.set(data)
			.where(and(eq(bills.tenantId, tenantId), eq(bills.id, id)))
			.returning();

		return bill ?? null;
	}

	async listBills(params: BillListParams): Promise<BillRow[]> {
		const conditions = [
			eq(bills.tenantId, params.tenantId),
			isNull(bills.deletedAt),
		];
		if (params.patientId) {
			conditions.push(eq(bills.patientId, params.patientId));
		}
		if (params.status) {
			conditions.push(eq(bills.status, params.status as never));
		}

		const rows = await db
			.select({
				bill: bills,
				patientName: patients.firstName,
				patientLastName: patients.lastName,
				amountPaid: sql<string>`COALESCE((SELECT SUM(pa.amount)::numeric FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED')), 0) + COALESCE((SELECT SUM(p.base_amount)::numeric FROM payments p WHERE p.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED') AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)`,
			})
			.from(bills)
			.innerJoin(patients, eq(bills.patientId, patients.id))
			.where(and(...conditions))
			.orderBy(desc(bills.createdAt))
			.limit(params.limit)
			.offset(params.offset);

		return rows.map((row) => ({
			...row.bill,
			patientName: `${row.patientName} ${row.patientLastName}`.trim(),
			amountPaid: row.amountPaid ?? "0",
		}));
	}

	async findBillRowById(tenantId: string, id: string): Promise<BillRow | null> {
		const [row] = await db
			.select({
				bill: bills,
				patientName: patients.firstName,
				patientLastName: patients.lastName,
				amountPaid: sql<string>`COALESCE((SELECT SUM(pa.amount)::numeric FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED')), 0) + COALESCE((SELECT SUM(p.base_amount)::numeric FROM payments p WHERE p.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED') AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)`,
			})
			.from(bills)
			.innerJoin(patients, eq(bills.patientId, patients.id))
			.where(
				and(
					eq(bills.tenantId, tenantId),
					eq(bills.id, id),
					isNull(bills.deletedAt),
				),
			)
			.limit(1);
		return row
			? {
					...row.bill,
					patientName: `${row.patientName} ${row.patientLastName}`.trim(),
					amountPaid: row.amountPaid ?? "0",
				}
			: null;
	}

	async countBills(
		tenantId: string,
		filters: Omit<BillListParams, "tenantId" | "limit" | "offset">,
	): Promise<number> {
		const conditions = [eq(bills.tenantId, tenantId), isNull(bills.deletedAt)];
		if (filters.patientId) {
			conditions.push(eq(bills.patientId, filters.patientId));
		}
		if (filters.status) {
			conditions.push(eq(bills.status, filters.status as never));
		}

		const [row] = await db
			.select({ value: count() })
			.from(bills)
			.where(and(...conditions));

		return row?.value ?? 0;
	}

	/** Sum of completed payments within [from, to) for a tenant. */
	async collectedIn(tenantId: string, from: Date, to: Date): Promise<number> {
		const [row] = await db
			.select({ value: sql<number>`COALESCE(SUM(amount)::numeric, 0)` })
			.from(payments)
			.where(
				and(
					eq(payments.tenantId, tenantId),
					eq(payments.status, "COMPLETED"),
					gte(payments.paidAt, from),
					lt(payments.paidAt, to),
				),
			);

		return Number(row?.value ?? 0);
	}

	/** Number of bills issued within [from, to). */
	async countBillsInPeriod(
		tenantId: string,
		from: Date,
		to: Date,
	): Promise<number> {
		const [row] = await db
			.select({ value: count() })
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					isNull(bills.deletedAt),
					gte(bills.createdAt, from),
					lt(bills.createdAt, to),
				),
			);

		return row?.value ?? 0;
	}

	/**
	 * Invoiced (bill totals) + outstanding (total - paid) per status, for the
	 * reporting window. `amountPaid` mirrors the list projection.
	 */
	async summaryForPeriod(
		tenantId: string,
		from: Date,
		to: Date,
	): Promise<
		Array<{
			status: Bill["status"];
			invoiced: number;
			paid: number;
		}>
	> {
		const rows = await db
			.select({
				status: bills.status,
				invoiced: sql<number>`COALESCE(SUM(total_amount)::numeric, 0)`,
			})
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					isNull(bills.deletedAt),
					gte(bills.createdAt, from),
					lt(bills.createdAt, to),
				),
			)
			.groupBy(bills.status);

		const paidRows = await db
			.select({
				status: bills.status,
				paid: sql<number>`COALESCE(SUM(COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED')), 0) + COALESCE((SELECT SUM(p.base_amount) FROM payments p WHERE p.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED') AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0))::numeric, 0)`,
			})
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					isNull(bills.deletedAt),
					gte(bills.createdAt, from),
					lt(bills.createdAt, to),
				),
			)
			.groupBy(bills.status);
		const paidByStatus = new Map(
			paidRows.map((row) => [row.status, Number(row.paid)]),
		);

		return rows.map((row) => ({
			status: row.status,
			invoiced: Number(row.invoiced),
			paid: paidByStatus.get(row.status) ?? 0,
		}));
	}

	async listPayments(tenantId: string): Promise<Payment[]> {
		return db.select().from(payments).where(eq(payments.tenantId, tenantId));
	}

	async findPaymentByReference(
		tenantId: string,
		reference: string,
	): Promise<Payment | null> {
		const [payment] = await db
			.select()
			.from(payments)
			.where(
				and(eq(payments.tenantId, tenantId), eq(payments.reference, reference)),
			)
			.limit(1);
		return payment ?? null;
	}

	async updatePayment(
		id: string,
		data: Partial<Pick<NewPayment, "status" | "paidAt" | "amount">>,
	): Promise<Payment | null> {
		const [payment] = await db
			.update(payments)
			.set(data)
			.where(eq(payments.id, id))
			.returning();
		return payment ?? null;
	}

	async financialReport(params: {
		tenantId: string;
		from: Date;
		to: Date;
		doctorId?: string;
		treatmentType?: string;
	}) {
		const conditions = [
			eq(bills.tenantId, params.tenantId),
			isNull(bills.deletedAt),
			gte(bills.createdAt, params.from),
			lt(bills.createdAt, params.to),
		];
		if (params.doctorId) {
			conditions.push(
				exists(
					db
						.select({ id: appointments.id })
						.from(appointments)
						.where(
							and(
								eq(appointments.id, bills.appointmentId),
								eq(appointments.doctorId, params.doctorId),
								eq(appointments.tenantId, params.tenantId),
							),
						),
				),
			);
		}
		if (params.treatmentType) {
			conditions.push(
				exists(
					db
						.select({ id: billItems.id })
						.from(billItems)
						.where(
							and(
								eq(billItems.billId, bills.id),
								eq(billItems.tenantId, params.tenantId),
								ilike(billItems.description, `%${params.treatmentType}%`),
							),
						),
				),
			);
		}
		const [summary] = await db
			.select({
				bills: count(),
				invoiced: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)`,
			})
			.from(bills)
			.where(and(...conditions));
		const paidRows = await db
			.select({ amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
			.from(payments)
			.innerJoin(bills, eq(payments.billId, bills.id))
			.where(
				and(
					eq(payments.tenantId, params.tenantId),
					eq(payments.status, "COMPLETED"),
					gte(payments.paidAt, params.from),
					lt(payments.paidAt, params.to),
					...conditions,
				),
			);
		return {
			bills: Number(summary?.bills ?? 0),
			invoiced: Number(summary?.invoiced ?? 0),
			collected: Number(paidRows[0]?.amount ?? 0),
		};
	}
}

export const billingRepository = new BillingRepository();
