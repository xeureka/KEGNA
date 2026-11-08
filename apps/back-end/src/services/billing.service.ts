import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import {
	billingRepository,
	type BillRow,
} from "@/repositories/billing.repository";
import { patientRepository } from "@/repositories/patient.repository";
import type { PaymentMethod, Bill, BillItem } from "@/db/schema";
import { db } from "@/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { procedures } from "@/db/schema";

export interface BillItemInput {
	procedureId?: string;
	description: string;
	quantity: string;
	unitPrice: string;
	discountAmount?: string;
	taxAmount?: string;
}

export interface CreateBillInput {
	patientId: string;
	appointmentId?: string;
	billNumber: string;
	status?:
		| "DRAFT"
		| "PENDING"
		| "PARTIALLY_PAID"
		| "PAID"
		| "CANCELLED"
		| "VOID";
	items?: BillItemInput[];
	notes?: string;
}

export interface PayBillInput {
	amount: string;
	method: PaymentMethod;
	reference?: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const num = (value?: string) => Number(value ?? "0");

export class BillingService {
	async ensureAppointmentBalance(input: {
		tenantId: string;
		appointmentId: string;
		patientId: string;
		reason?: string | null;
		createdByUserId: string | null;
	}) {
		const existing = await billingRepository.findBillByAppointmentId(
			input.tenantId,
			input.appointmentId,
		);
		if (existing) return existing;

		const activeProcedures = await db
			.select()
			.from(procedures)
			.where(
				and(
					eq(procedures.tenantId, input.tenantId),
					eq(procedures.isActive, true),
					isNull(procedures.deletedAt),
				),
			)
			.orderBy(asc(procedures.name));
		const reason = input.reason?.trim() || "Dental appointment";
		const matching = input.reason
			? activeProcedures.find((procedure) =>
					procedure.name.toLowerCase().includes(input.reason!.toLowerCase()),
				)
			: undefined;
		const procedure = matching ?? activeProcedures[0];
		const amount = procedure?.defaultPrice ?? "0";

		return this.createBill(input.tenantId, input.createdByUserId, {
			patientId: input.patientId,
			appointmentId: input.appointmentId,
			billNumber: `APT-${input.appointmentId.slice(0, 8).toUpperCase()}`,
			status: "PENDING",
			notes: "Automatically created from appointment lifecycle",
			items: [
				{
					procedureId: procedure?.id,
					description: reason,
					quantity: "1",
					unitPrice: amount,
				},
			],
		});
	}
	async createBill(
		tenantId: string,
		createdByUserId: string | null,
		input: CreateBillInput,
	) {
		if (!(await patientRepository.findById(tenantId, input.patientId))) {
			throw new AppError("Patient not found", 404, ErrorCode.NOT_FOUND);
		}

		const items: BillItemInput[] = (input.items ?? []).map((item) => ({
			...item,
			quantity: item.quantity ?? "1",
			discountAmount: item.discountAmount ?? "0",
			taxAmount: item.taxAmount ?? "0",
		}));

		let subtotal = 0;
		let discountAmount = 0;
		let taxAmount = 0;
		for (const item of items) {
			const lineTotal = round2(num(item.quantity) * num(item.unitPrice));
			const lineDiscount = round2(num(item.discountAmount));
			const lineTax = round2(num(item.taxAmount));
			subtotal += lineTotal;
			discountAmount += lineDiscount;
			taxAmount += lineTax;
		}
		const totalAmount = Math.max(
			0,
			round2(subtotal - discountAmount + taxAmount),
		);

		const bill = await billingRepository.createBill(tenantId, {
			patientId: input.patientId,
			appointmentId: input.appointmentId ?? null,
			billNumber: input.billNumber,
			status: input.status ?? "PENDING",
			subtotal: String(subtotal),
			discountAmount: String(discountAmount),
			taxAmount: String(taxAmount),
			totalAmount: String(totalAmount),
			notes: input.notes,
			issuedAt: new Date(),
			createdByUserId,
		});

		const billItemsCreated: BillItem[] = [];
		for (const item of items) {
			const lineTotal = round2(num(item.quantity) * num(item.unitPrice));
			const created = await billingRepository.createBillItem(tenantId, {
				billId: bill.id,
				procedureId: item.procedureId ?? null,
				description: item.description,
				quantity: item.quantity,
				unitPrice: String(num(item.unitPrice)),
				discountAmount: String(item.discountAmount),
				taxAmount: String(item.taxAmount),
				totalAmount: String(
					round2(
						Math.max(
							0,
							lineTotal - num(item.discountAmount) + num(item.taxAmount),
						),
					),
				),
			});
			billItemsCreated.push(created);
		}

		return { ...bill, items: billItemsCreated };
	}

	async payBill(
		tenantId: string,
		billId: string,
		receivedByUserId: string | null,
		input: PayBillInput,
	) {
		const bill = await billingRepository.findBillById(tenantId, billId);
		if (!bill) {
			throw new AppError("Bill not found", 404, ErrorCode.NOT_FOUND);
		}
		if (bill.status === "CANCELLED" || bill.status === "VOID") {
			throw new AppError(
				"Cannot pay a void or cancelled bill",
				409,
				ErrorCode.CONFLICT,
			);
		}

		const amount = Number(input.amount);
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new AppError(
				"amount must be a positive number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		const payment = await billingRepository.createPayment(tenantId, {
			billId,
			amount: String(round2(amount)),
			baseAmount: String(round2(amount)),
			serviceCharge: "0",
			totalAmount: String(round2(amount)),
			currency: "ETB",
			purpose: "balance",
			patientId: bill.patientId,
			method: input.method,
			status: "COMPLETED",
			reference: input.reference,
			paidAt: new Date(),
			receivedByUserId,
		});

		await this.recomputeBillStatus(tenantId, billId);
		return payment;
	}

	async processChapaWebhook(input: {
		tenantId: string;
		billId: string;
		amount: string;
		reference: string;
		status: "success" | "failed" | "pending" | "abandoned";
	}) {
		const bill = await billingRepository.findBillById(
			input.tenantId,
			input.billId,
		);
		if (!bill) throw new AppError("Bill not found", 404, ErrorCode.NOT_FOUND);
		const status =
			input.status === "success"
				? "COMPLETED"
				: input.status === "failed" || input.status === "abandoned"
					? "FAILED"
					: "PENDING";
		const existing = await billingRepository.findPaymentByReference(
			input.tenantId,
			input.reference,
		);
		const payment = existing
			? await billingRepository.updatePayment(existing.id, {
					status,
					paidAt:
						status === "COMPLETED" ? (existing.paidAt ?? new Date()) : null,
				})
			: await billingRepository.createPayment(input.tenantId, {
					billId: input.billId,
					amount: input.amount,
					baseAmount: input.amount,
					serviceCharge: "0",
					totalAmount: input.amount,
					currency: "ETB",
					purpose: "balance",
					patientId: bill.patientId,
					method: "MOBILE_MONEY",
					status,
					reference: input.reference,
					paidAt: status === "COMPLETED" ? new Date() : null,
					receivedByUserId: null,
				});
		await this.recomputeBillStatus(input.tenantId, input.billId);
		return { payment: payment!, idempotent: Boolean(existing), status };
	}

	private async recomputeBillStatus(tenantId: string, billId: string) {
		const bill = await billingRepository.findBillById(tenantId, billId);
		if (!bill) return;

		const billRow = await billingRepository.findBillRowById(tenantId, billId);
		const paid = num(billRow?.amountPaid);

		let status: Bill["status"];
		if (paid <= 0) {
			status = "PENDING";
		} else if (paid >= num(bill.totalAmount)) {
			status = "PAID";
		} else {
			status = "PARTIALLY_PAID";
		}

		if (status !== bill.status) {
			await billingRepository.updateBill(tenantId, billId, { status });
		}
	}

	async findById(tenantId: string, id: string): Promise<BillRow> {
		const bill = await billingRepository.findBillById(tenantId, id);
		if (!bill) {
			throw new AppError("Bill not found", 404, ErrorCode.NOT_FOUND);
		}
		const row = await billingRepository.findBillRowById(tenantId, id);
		return row ?? { ...bill, patientName: "", amountPaid: "0" };
	}

	async list(
		tenantId: string,
		query: {
			patientId?: string;
			status?: string;
			page?: number;
			pageSize?: number;
		},
	) {
		const page = Math.max(1, query.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
		const filters = { patientId: query.patientId, status: query.status };
		const [items, total] = await Promise.all([
			billingRepository.listBills({
				tenantId,
				...filters,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			}),
			billingRepository.countBills(tenantId, filters),
		]);
		return { items, total, page, pageSize };
	}
}

export const billingService = new BillingService();
