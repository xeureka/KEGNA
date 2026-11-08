import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { withDatabase } from "@/db/request-context";
import {
	appointments,
	bills,
	cardProducts,
	doctors,
	paymentAllocations,
	paymentEvents,
	patients,
	procedures,
	tenants,
	users,
	userCards,
	payments,
} from "@/db/schema";
import { paymentsService } from "./payments.service";
import { calculateChapaAmounts } from "./payment-money";
import { env } from "@/lib/env";
import type { ChapaVerifiedPayment } from "./chapa";

const ROLLBACK = Symbol("rollback");

type Fixtures = {
	tenantId: string;
	staffUserId: string;
	patientUserId: string;
	patientId: string;
	doctorId: string;
	serviceId: string;
	servicePrice: string;
};

/**
 * Run `fn` inside a real tenant-scoped transaction (RLS context included) and
 * roll everything back afterwards so the shared dev database stays clean.
 */
async function withRollback<T>(
	fn: (fixtures: Fixtures) => Promise<T>,
): Promise<T> {
	let result: T | undefined;
	let failure: unknown;
	try {
		await db.transaction(async (tx) => {
			const [tenant] = await tx
				.insert(tenants)
				.values({
					name: `Payment Test ${randomUUID().slice(0, 8)}`,
					slug: `pay-test-${randomUUID().slice(0, 8)}`,
				})
				.returning({ id: tenants.id });
			if (!tenant) throw new Error("Unable to create test tenant");
			await tx.execute(
				sql`select set_config('app.tenant_id', ${tenant.id}, true)`,
			);

			const [staff] = await tx
				.insert(users)
				.values({
					name: "Test Receptionist",
					email: `reception-${randomUUID().slice(0, 8)}@test.local`,
					phone: `+2519${Math.floor(Math.random() * 1e8)}`,
				})
				.returning({ id: users.id });
			const [patientUser] = await tx
				.insert(users)
				.values({
					name: "Test Patient",
					email: `patient-${randomUUID().slice(0, 8)}@test.local`,
					phone: `+2519${Math.floor(Math.random() * 1e8)}`,
				})
				.returning({
					id: users.id,
					phone: users.phone,
					email: users.email,
				});
			if (!staff || !patientUser) throw new Error("Unable to create users");

			const [patient] = await tx
				.insert(patients)
				.values({
					tenantId: tenant.id,
					patientNumber: `PT-${randomUUID().slice(0, 8)}`,
					firstName: "Test",
					lastName: "Patient",
					phone: patientUser.phone,
					email: patientUser.email,
				})
				.returning({ id: patients.id });
			const [doctor] = await tx
				.insert(doctors)
				.values({
					tenantId: tenant.id,
					userId: staff.id,
					licenseNumber: `LIC-${randomUUID().slice(0, 8)}`,
				})
				.returning({ id: doctors.id });
			const [service] = await tx
				.insert(procedures)
				.values({
					tenantId: tenant.id,
					name: "Test Cleaning",
					defaultPrice: "250.00",
					defaultDurationMinutes: 30,
				})
				.returning({ id: procedures.id });
			if (!patient || !doctor || !service)
				throw new Error("Unable to create fixtures");

			const fixtures: Fixtures = {
				tenantId: tenant.id,
				staffUserId: staff.id,
				patientUserId: patientUser.id,
				patientId: patient.id,
				doctorId: doctor.id,
				serviceId: service.id,
				servicePrice: "250.00",
			};

			result = await withDatabase(
				tx as Parameters<typeof withDatabase>[0],
				() => fn(fixtures),
			);
			throw ROLLBACK; // force rollback: never leave test rows behind
		});
	} catch (error) {
		if (error !== ROLLBACK) failure = error;
	}
	if (failure) throw failure;
	return result as T;
}

async function createPendingVisitPayment(
	fixtures: Fixtures,
	options?: {
		amount?: string;
		expiredHold?: boolean;
	},
) {
	const total = calculateChapaAmounts(
		options?.amount ?? fixtures.servicePrice,
		env.SERVICE_CHARGE_ETB,
	);
	const now = new Date();
	const [appointment] = await db
		.insert(appointments)
		.values({
			tenantId: fixtures.tenantId,
			patientId: fixtures.patientId,
			doctorId: fixtures.doctorId,
			startAt: new Date(now.getTime() + 86_400_000),
			endAt: new Date(now.getTime() + 86_400_000 + 30 * 60_000),
			status: "PENDING_PAYMENT",
			reason: "Test Cleaning",
			paymentExpiresAt: options?.expiredHold
				? new Date(now.getTime() - 60_000)
				: new Date(now.getTime() + 30 * 60_000),
		})
		.returning({ id: appointments.id });
	if (!appointment) throw new Error("Unable to create appointment");
	const txRef = `NEXA-TEST-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
	const [payment] = await db
		.insert(payments)
		.values({
			tenantId: fixtures.tenantId,
			txRef,
			userId: fixtures.patientUserId,
			patientId: fixtures.patientId,
			purpose: "visit",
			referenceId: appointment.id,
			baseAmount: total.baseAmount,
			serviceCharge: total.serviceCharge,
			totalAmount: total.totalAmount,
			amount: total.totalAmount,
			currency: "ETB",
			method: "CHAPA",
			status: "PENDING",
			expiresAt: new Date(now.getTime() + 30 * 60_000),
		})
		.returning({ id: payments.id });
	if (!payment) throw new Error("Unable to create payment");
	await db
		.update(appointments)
		.set({ paymentId: payment.id })
		.where(eq(appointments.id, appointment.id));
	return { appointmentId: appointment.id, paymentId: payment.id, txRef, total };
}

function verified(
	txRef: string,
	overrides?: Partial<ChapaVerifiedPayment>,
): ChapaVerifiedPayment {
	return {
		status: "success",
		tx_ref: txRef,
		amount: "300.00",
		currency: "ETB",
		...overrides,
	};
}

test("reception cash payment confirms the pending visit and settles the bill", async () => {
	await withRollback(async (fixtures) => {
		const now = new Date();
		const [appointment] = await db
			.insert(appointments)
			.values({
				tenantId: fixtures.tenantId,
				patientId: fixtures.patientId,
				doctorId: fixtures.doctorId,
				startAt: new Date(now.getTime() + 86_400_000),
				endAt: new Date(now.getTime() + 86_400_000 + 30 * 60_000),
				status: "PENDING_PAYMENT",
				reason: "Test Cleaning",
			})
			.returning({ id: appointments.id });
		assert.ok(appointment);

		const payment = await paymentsService.recordManual(
			fixtures.tenantId,
			fixtures.staffUserId,
			{
				patientId: fixtures.patientId,
				purpose: "visit",
				referenceId: appointment.id,
				amount: fixtures.servicePrice,
				method: "CASH",
			},
		);
		assert.equal(payment.status, "SUCCESS");
		assert.equal(payment.serviceCharge, "0.00");
		assert.equal(payment.totalAmount, fixtures.servicePrice);

		const [confirmed] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointment.id));
		assert.equal(confirmed?.status, "CONFIRMED");
		assert.equal(confirmed?.paymentId, payment.id);

		const [bill] = await db
			.select()
			.from(bills)
			.where(eq(bills.appointmentId, appointment.id));
		assert.equal(bill?.status, "PAID");
		assert.equal(bill?.totalAmount, fixtures.servicePrice);

		const allocations = await db
			.select()
			.from(paymentAllocations)
			.where(eq(paymentAllocations.paymentId, payment.id));
		assert.equal(allocations.length, 1);
		assert.equal(allocations[0]?.amount, fixtures.servicePrice);
	});
});

test("manual visit payment rejects a price mismatch and a settled appointment", async () => {
	await withRollback(async (fixtures) => {
		const now = new Date();
		const [appointment] = await db
			.insert(appointments)
			.values({
				tenantId: fixtures.tenantId,
				patientId: fixtures.patientId,
				doctorId: fixtures.doctorId,
				startAt: new Date(now.getTime() + 86_400_000),
				endAt: new Date(now.getTime() + 86_400_000 + 30 * 60_000),
				status: "PENDING_PAYMENT",
				reason: "Test Cleaning",
			})
			.returning({ id: appointments.id });
		assert.ok(appointment);

		await assert.rejects(
			() =>
				paymentsService.recordManual(fixtures.tenantId, fixtures.staffUserId, {
					patientId: fixtures.patientId,
					purpose: "visit",
					referenceId: appointment.id,
					amount: "100.00",
					method: "CASH",
				}),
			/service price/i,
		);

		const payment = await paymentsService.recordManual(
			fixtures.tenantId,
			fixtures.staffUserId,
			{
				patientId: fixtures.patientId,
				purpose: "visit",
				referenceId: appointment.id,
				amount: fixtures.servicePrice,
				method: "CASH",
			},
		);
		assert.equal(payment.status, "SUCCESS");

		// The appointment is CONFIRMED now: settling it again must fail.
		await assert.rejects(
			() =>
				paymentsService.recordManual(fixtures.tenantId, fixtures.staffUserId, {
					patientId: fixtures.patientId,
					purpose: "visit",
					referenceId: appointment.id,
					amount: fixtures.servicePrice,
					method: "CASH",
				}),
			/no longer pending|not found/i,
		);
	});
});

test("webhook success confirms the visit, bills it and is idempotent", async () => {
	await withRollback(async (fixtures) => {
		const { appointmentId, txRef, total } =
			await createPendingVisitPayment(fixtures);
		const first = await paymentsService.settleVerifiedPayment(
			txRef,
			verified(txRef, { amount: total.totalAmount }),
			fixtures.tenantId,
		);
		assert.deepEqual(first, { idempotent: false, status: "SUCCESS" });

		const [confirmed] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId));
		assert.equal(confirmed?.status, "CONFIRMED");

		const [bill] = await db
			.select()
			.from(bills)
			.where(eq(bills.appointmentId, appointmentId));
		assert.equal(bill?.status, "PAID");
		assert.equal(bill?.totalAmount, total.baseAmount);

		const events = await db
			.select()
			.from(paymentEvents)
			.where(eq(paymentEvents.tenantId, fixtures.tenantId));
		assert.ok(
			events.some((event) => event.type === "status_changed"),
			"a status_changed event is recorded",
		);

		// A duplicate webhook must not double-apply anything.
		const second = await paymentsService.settleVerifiedPayment(
			txRef,
			verified(txRef, { amount: total.totalAmount }),
			fixtures.tenantId,
		);
		assert.deepEqual(second, { idempotent: true, status: "SUCCESS" });
		const billsAfter = await db
			.select()
			.from(bills)
			.where(eq(bills.tenantId, fixtures.tenantId));
		assert.equal(billsAfter.length, 1);
	});
});

test("webhook amount mismatch fails the payment and releases the appointment", async () => {
	await withRollback(async (fixtures) => {
		const { appointmentId, txRef } = await createPendingVisitPayment(fixtures);
		const result = await paymentsService.settleVerifiedPayment(
			txRef,
			verified(txRef, { amount: "1.00" }),
			fixtures.tenantId,
		);
		assert.deepEqual(result, { idempotent: false, status: "FAILED" });

		const [row] = await db
			.select()
			.from(payments)
			.where(eq(payments.txRef, txRef));
		assert.equal(row?.status, "FAILED");

		const [cancelled] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId));
		assert.equal(cancelled?.status, "CANCELLED");
		assert.match(cancelled?.cancelledReason ?? "", /verification mismatch/i);
	});
});

test("webhook failure and cancellation both release the pending visit", async () => {
	await withRollback(async (fixtures) => {
		for (const status of ["failed", "cancelled", "expired"] as const) {
			const { appointmentId, txRef } =
				await createPendingVisitPayment(fixtures);
			const result = await paymentsService.settleVerifiedPayment(
				txRef,
				verified(txRef, { status }),
				fixtures.tenantId,
			);
			const expected =
				status === "expired"
					? "EXPIRED"
					: status === "cancelled"
						? "CANCELLED"
						: "FAILED";
			assert.deepEqual(result, { idempotent: false, status: expected });
			const [appointment] = await db
				.select()
				.from(appointments)
				.where(eq(appointments.id, appointmentId));
			assert.equal(appointment?.status, "CANCELLED");
		}
	});
});

test("a success that arrives after the hold expired never confirms the visit", async () => {
	await withRollback(async (fixtures) => {
		const { appointmentId, txRef, total } = await createPendingVisitPayment(
			fixtures,
			{ expiredHold: true },
		);
		const result = await paymentsService.settleVerifiedPayment(
			txRef,
			verified(txRef, { amount: total.totalAmount }),
			fixtures.tenantId,
		);
		assert.equal(result.status, "SUCCESS");

		const [appointment] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId));
		assert.equal(appointment?.status, "CANCELLED");
		assert.match(
			appointment?.cancelledReason ?? "",
			/after the appointment hold expired/i,
		);
	});
});

test("card checkout success activates the card and syncs the membership tier", async () => {
	await withRollback(async (fixtures) => {
		// The catalog is upserted from the shared tier config on demand.
		const plans = await paymentsService.listCards(fixtures.tenantId);
		const gold = plans.find((plan) => plan.name === "Gold");
		assert.ok(gold, "Gold tier is present in the catalog");
		assert.equal(gold.price, "2550.00", "inclusive price is base + 50 ETB");
		assert.equal(gold.baseAmount, "2500.00");

		const [product] = await db
			.select()
			.from(cardProducts)
			.where(
				and(
					eq(cardProducts.tenantId, fixtures.tenantId),
					eq(cardProducts.name, "Gold"),
				),
			);
		assert.ok(product);

		const total = calculateChapaAmounts(product.price, env.SERVICE_CHARGE_ETB);
		const txRef = `NEXA-TEST-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
		const [payment] = await db
			.insert(payments)
			.values({
				tenantId: fixtures.tenantId,
				txRef,
				userId: fixtures.patientUserId,
				patientId: fixtures.patientId,
				purpose: "card",
				referenceId: product.id,
				baseAmount: total.baseAmount,
				serviceCharge: total.serviceCharge,
				totalAmount: total.totalAmount,
				amount: total.totalAmount,
				currency: "ETB",
				method: "CHAPA",
				status: "PENDING",
				expiresAt: new Date(Date.now() + 30 * 60_000),
			})
			.returning({ id: payments.id });
		assert.ok(payment);
		await db.insert(userCards).values({
			tenantId: fixtures.tenantId,
			userId: fixtures.patientUserId,
			patientId: fixtures.patientId,
			cardProductId: product.id,
			paymentId: payment.id,
			status: "pending",
		});

		const result = await paymentsService.settleVerifiedPayment(
			txRef,
			verified(txRef, { amount: total.totalAmount }),
			fixtures.tenantId,
		);
		assert.deepEqual(result, { idempotent: false, status: "SUCCESS" });

		const [card] = await db
			.select()
			.from(userCards)
			.where(eq(userCards.paymentId, payment.id));
		assert.equal(card?.status, "active");
		assert.ok(card?.activatedAt);

		const [patient] = await db
			.select()
			.from(patients)
			.where(eq(patients.id, fixtures.patientId));
		assert.equal(patient?.membershipTier, "Gold");
	});
});

test("manual balance payment allocates to the oldest bill and rejects overpayment", async () => {
	await withRollback(async (fixtures) => {
		const now = new Date();
		const [bill] = await db
			.insert(bills)
			.values({
				tenantId: fixtures.tenantId,
				patientId: fixtures.patientId,
				billNumber: `BLL-${randomUUID().slice(0, 8)}`,
				status: "PENDING",
				subtotal: "80.00",
				discountAmount: "0",
				taxAmount: "0",
				totalAmount: "80.00",
				issuedAt: now,
				createdByUserId: fixtures.staffUserId,
			})
			.returning({ id: bills.id });
		assert.ok(bill);

		const balance = await paymentsService.getPatientBalance(
			fixtures.tenantId,
			fixtures.patientId,
		);
		assert.equal(balance.remaining, "80.00");
		assert.equal(balance.available, "80.00");

		await assert.rejects(
			() =>
				paymentsService.recordManual(fixtures.tenantId, fixtures.staffUserId, {
					patientId: fixtures.patientId,
					purpose: "balance",
					amount: "80.01",
					method: "CASH",
				}),
			/exceeds the available outstanding balance/i,
		);

		const payment = await paymentsService.recordManual(
			fixtures.tenantId,
			fixtures.staffUserId,
			{
				patientId: fixtures.patientId,
				purpose: "balance",
				amount: "30.00",
				method: "CASH",
			},
		);
		assert.equal(payment.status, "SUCCESS");

		const allocations = await db
			.select()
			.from(paymentAllocations)
			.where(eq(paymentAllocations.paymentId, payment.id));
		assert.equal(allocations.length, 1);
		assert.equal(allocations[0]?.billId, bill.id);
		assert.equal(allocations[0]?.amount, "30.00");

		const after = await paymentsService.getPatientBalance(
			fixtures.tenantId,
			fixtures.patientId,
		);
		assert.equal(after.remaining, "50.00");
	});
});

test("tenant isolation: a patient of one tenant is invisible to another", async () => {
	await withRollback(async (fixtures) => {
		const [otherTenant] = await db
			.insert(tenants)
			.values({
				name: `Other ${randomUUID().slice(0, 8)}`,
				slug: `other-${randomUUID().slice(0, 8)}`,
			})
			.returning({ id: tenants.id });
		assert.ok(otherTenant);

		await assert.rejects(
			() =>
				paymentsService.identityForPatient(otherTenant.id, fixtures.patientId),
			/Patient not found/i,
		);

		// The queue and ledger of the other tenant stay empty.
		const queue = await paymentsService.listQueue(otherTenant.id, {
			page: 1,
			pageSize: 10,
		});
		assert.equal(queue.total, 0);
		const ledger = await paymentsService.listAll(otherTenant.id, {
			page: 1,
			pageSize: 10,
			sort: "desc",
		});
		assert.equal(ledger.total, 0);
	});
});

test("summary reports the payment shape used by the dashboards", async () => {
	await withRollback(async (fixtures) => {
		const now = new Date();
		const [appointment] = await db
			.insert(appointments)
			.values({
				tenantId: fixtures.tenantId,
				patientId: fixtures.patientId,
				doctorId: fixtures.doctorId,
				startAt: new Date(now.getTime() + 86_400_000),
				endAt: new Date(now.getTime() + 86_400_000 + 30 * 60_000),
				status: "PENDING_PAYMENT",
				reason: "Test Cleaning",
			})
			.returning({ id: appointments.id });
		assert.ok(appointment);
		await paymentsService.recordManual(
			fixtures.tenantId,
			fixtures.staffUserId,
			{
				patientId: fixtures.patientId,
				purpose: "visit",
				referenceId: appointment.id,
				amount: fixtures.servicePrice,
				method: "CASH",
			},
		);

		const summary = await paymentsService.summary(fixtures.tenantId);
		assert.equal(summary.totalRevenue, "250.00");
		assert.equal(summary.grossCollected, "250.00");
		assert.equal(summary.serviceChargesCollected, "0.00");
		assert.equal(summary.cash, "250.00");
		assert.equal(summary.visitCount, 1);
		assert.equal(summary.cardCount, 0);
		assert.equal(summary.pendingCount, 0);
		assert.equal(summary.expiredCount, 0);
		assert.equal(summary.cancelledCount, 0);
	});
});

test.after(async () => {
	await pool.end();
});
