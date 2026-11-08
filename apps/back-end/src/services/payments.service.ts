import { randomUUID } from "node:crypto";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	ilike,
	inArray,
	isNull,
	lt,
	ne,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { db, pool } from "@/db";
import { withDatabase } from "@/db/request-context";
import {
	appointmentStatusHistory,
	appointments,
	billItems,
	bills,
	cardProducts,
	doctors,
	paymentAllocations,
	paymentEvents,
	payments,
	patients,
	procedures,
	userCards,
	tenants,
	tenantMemberships,
	users,
	type PaymentPurpose,
} from "@/db/schema";
import { env } from "@/lib/env";
import { CARD_TIERS, findCardTier, tierRank } from "@/config/card-tiers";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import {
	allocateEtbPayment,
	calculateChapaAmounts,
	formatEtbCents,
	parseEtbCents,
	summarizeEtbBalance,
} from "@/services/payment-money";
import {
	handleWebhook,
	initializePayment,
	verifyPayment,
	type ChapaVerifiedPayment,
} from "@/services/chapa";

type PatientIdentity = {
	userId: string | null;
	patientId: string;
	firstName: string;
	lastName: string;
	email: string;
	phoneNumber?: string;
};

type PaymentStart = {
	tenantId: string;
	identity: PatientIdentity;
	purpose: PaymentPurpose;
	referenceId: string | null;
	baseAmount: string;
	appointment?: {
		doctorId: string;
		startAt: Date;
		endAt: Date;
		serviceName: string;
		actorUserId: string | null;
	};
	cardProductId?: string;
};

function safeVerifiedPayload(value: ChapaVerifiedPayment) {
	return {
		tx_ref: value.tx_ref,
		reference: value.reference ?? null,
		status: value.status,
		amount: value.amount,
		currency: value.currency,
		mode: typeof value.mode === "string" ? value.mode : null,
	};
}

/** Base price + the platform service charge, as shown to a patient. */
function inclusiveAmounts(price: string) {
	return calculateChapaAmounts(price, env.SERVICE_CHARGE_ETB);
}

function txRef() {
	return `NEXA-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function paymentError(
	message: string,
	status: ContentfulStatusCode = 400,
	code: string = ErrorCode.BAD_REQUEST,
) {
	return new AppError(message, status, code);
}

/**
 * Phone-OTP mobile accounts are created with a synthetic, non-deliverable
 * address (`user_<phone>@mobile.nexa.internal`). Chapa rejects such addresses
 * with `validation.email`, so checkout must require a real email instead of
 * forwarding the placeholder.
 */
function isDeliverableEmail(email: string | null | undefined): email is string {
	const value = email?.trim();
	if (!value) return false;
	return !/@(?:mobile\.)?nexa\.internal$/i.test(value);
}

/**
 * Amount already settled against a bill: allocations from SUCCESS payments,
 * plus base amounts of SUCCESS payments that predate allocation tracking.
 *
 * `bills.id` must stay table-qualified inside the correlated subqueries — an
 * unqualified `${bills.id}` renders as bare `"id"`, which Postgres rejects as
 * ambiguous once the subquery joins payments/payment_allocations (both of
 * which also expose `id`).
 */
const billPaidAmountSql = sql<string>`COALESCE((SELECT SUM(pa.amount)::numeric FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED')), 0) + COALESCE((SELECT SUM(p.base_amount)::numeric FROM payments p WHERE p.bill_id = bills.id AND p.status IN ('SUCCESS', 'COMPLETED') AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)`;

export class PaymentsService {
	private async transaction<T>(callback: () => Promise<T>) {
		return db.transaction((transaction) => withDatabase(transaction, callback));
	}

	async identityForUser(
		tenantId: string,
		userId: string,
	): Promise<PatientIdentity> {
		const [user] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				phone: users.phone,
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!user?.phone)
			throw paymentError("A verified phone number is required", 400);
		const [patient] = await db
			.select({
				id: patients.id,
				firstName: patients.firstName,
				lastName: patients.lastName,
				phone: patients.phone,
				email: patients.email,
			})
			.from(patients)
			.where(
				and(
					eq(patients.tenantId, tenantId),
					eq(patients.phone, user.phone),
					isNull(patients.deletedAt),
				),
			)
			.limit(1);
		if (!patient)
			throw paymentError(
				"Patient profile not found for this tenant",
				404,
				ErrorCode.NOT_FOUND,
			);
		const email = patient.email || user.email;
		if (!isDeliverableEmail(email))
			throw paymentError(
				"Add a valid email address in your profile to pay online",
				400,
				"EMAIL_REQUIRED",
			);
		const [firstName = "Patient", ...rest] = (
			patient.firstName || user.name
		).split(" ");
		return {
			userId: user.id,
			patientId: patient.id,
			firstName,
			lastName: patient.lastName || rest.join(" ") || "",
			email,
			phoneNumber: patient.phone ?? user.phone,
		};
	}

	async identityForPatient(
		tenantId: string,
		patientId: string,
	): Promise<PatientIdentity> {
		const [patient] = await db
			.select()
			.from(patients)
			.where(
				and(
					eq(patients.tenantId, tenantId),
					eq(patients.id, patientId),
					isNull(patients.deletedAt),
				),
			)
			.limit(1);
		if (!patient)
			throw paymentError("Patient not found", 404, ErrorCode.NOT_FOUND);
		const [accountUser] = patient.phone
			? await db
					.select({
						id: users.id,
						email: users.email,
						name: users.name,
						phone: users.phone,
					})
					.from(users)
					.innerJoin(
						tenantMemberships,
						and(
							eq(tenantMemberships.userId, users.id),
							eq(tenantMemberships.tenantId, tenantId),
							eq(tenantMemberships.status, "ACTIVE"),
						),
					)
					.where(eq(users.phone, patient.phone))
					.limit(1)
			: [];
		const email = patient.email || accountUser?.email || "";
		return {
			userId: accountUser?.id ?? null,
			patientId: patient.id,
			firstName: patient.firstName,
			lastName: patient.lastName,
			email,
			phoneNumber: patient.phone ?? accountUser?.phone ?? undefined,
		};
	}

	async startVisit(
		tenantId: string,
		userId: string,
		input: { serviceId: string; doctorId: string; startAt: string },
	) {
		const identity = await this.identityForUser(tenantId, userId);
		const service = await this.getService(tenantId, input.serviceId);
		if (service.defaultPrice === null)
			throw paymentError(
				"Service price is not configured",
				409,
				ErrorCode.CONFLICT,
			);
		const startAt = new Date(input.startAt);
		if (!Number.isFinite(startAt.getTime()) || startAt <= new Date()) {
			throw paymentError("Choose a future appointment date and time");
		}
		const duration = service.defaultDurationMinutes ?? 45;
		const payment = await this.createPending({
			tenantId,
			identity,
			purpose: "visit",
			referenceId: null,
			baseAmount: service.defaultPrice,
			appointment: {
				doctorId: input.doctorId,
				startAt,
				endAt: new Date(startAt.getTime() + duration * 60_000),
				serviceName: service.name,
				actorUserId: userId,
			},
		});
		return this.initializePending(payment.id, identity);
	}

	async startCard(tenantId: string, userId: string, cardId: string) {
		const identity = await this.identityForUser(tenantId, userId);
		if (!identity.userId)
			throw paymentError("A patient account is required to purchase a card");
		// A tenant provisioned after boot may not have the catalog yet.
		await this.ensureCardProducts(tenantId);
		const [product] = await db
			.select()
			.from(cardProducts)
			.where(
				and(
					eq(cardProducts.tenantId, tenantId),
					eq(cardProducts.id, cardId),
					eq(cardProducts.isActive, true),
				),
			)
			.limit(1);
		if (!product)
			throw paymentError("Card plan not found", 404, ErrorCode.NOT_FOUND);

		const existing = await this.findExistingPendingCheckout(
			tenantId,
			identity.patientId,
			"card",
			product.id,
		);
		if (existing) return existing;

		const payment = await this.createPending({
			tenantId,
			identity,
			purpose: "card",
			referenceId: product.id,
			baseAmount: product.price,
			cardProductId: product.id,
		});
		return this.initializePending(payment.id, identity);
	}

	private async findExistingPendingCheckout(
		tenantId: string,
		patientId: string,
		purpose: PaymentPurpose,
		referenceId?: string | null,
	) {
		const conditions = [
			eq(payments.tenantId, tenantId),
			eq(payments.patientId, patientId),
			eq(payments.purpose, purpose),
			eq(payments.status, "PENDING"),
			gt(payments.expiresAt, new Date()),
		];
		if (referenceId) {
			conditions.push(eq(payments.referenceId, referenceId));
		}
		const [existing] = await db
			.select({ checkoutUrl: payments.checkoutUrl, txRef: payments.txRef })
			.from(payments)
			.where(and(...conditions))
			.orderBy(desc(payments.createdAt))
			.limit(1);

		if (existing?.checkoutUrl && existing?.txRef) {
			return { checkout_url: existing.checkoutUrl, tx_ref: existing.txRef };
		}
		return null;
	}

	async startBalance(
		tenantId: string,
		userId: string,
		input: { amount?: string },
	) {
		const identity = await this.identityForUser(tenantId, userId);
		const balance = await this.getPatientBalance(tenantId, identity.patientId);
		const baseAmount = input.amount ?? balance.available;
		let cents: number;
		try {
			cents = parseEtbCents(baseAmount);
		} catch {
			throw paymentError("Enter a valid payment amount");
		}
		if (cents < 100)
			throw paymentError("Payment amount must be at least 1 ETB");
		const reserved = await this.pendingBalanceReservations(
			tenantId,
			identity.patientId,
		);
		const available = Math.max(
			0,
			parseEtbCents(balance.remaining) - parseEtbCents(reserved),
		);
		if (cents > available)
			throw paymentError("Payment exceeds the available balance");
		const payment = await this.createPending({
			tenantId,
			identity,
			purpose: "balance",
			referenceId: null,
			baseAmount: formatEtbCents(cents),
		});
		return this.initializePending(payment.id, identity);
	}

	async startChapaForPatient(
		tenantId: string,
		patientId: string,
		input: { purpose: PaymentPurpose; referenceId?: string; amount?: string },
	) {
		const identity = await this.identityForPatient(tenantId, patientId);
		if (input.purpose === "visit") {
			const appointment = await this.getPendingAppointment(
				tenantId,
				input.referenceId,
			);
			return this.initializeExistingAppointment(
				tenantId,
				identity,
				appointment,
			);
		}
		if (input.purpose === "card") {
			if (!input.referenceId) throw paymentError("Card plan is required");
			if (!identity.userId)
				throw paymentError("A patient account is required to purchase a card");
			const [product] = await db
				.select()
				.from(cardProducts)
				.where(
					and(
						eq(cardProducts.tenantId, tenantId),
						eq(cardProducts.id, input.referenceId),
						eq(cardProducts.isActive, true),
					),
				)
				.limit(1);
			if (!product)
				throw paymentError("Card plan not found", 404, ErrorCode.NOT_FOUND);
			const pending = await this.createPending({
				tenantId,
				identity,
				purpose: "card",
				referenceId: product.id,
				baseAmount: product.price,
				cardProductId: product.id,
			});
			return this.initializePending(pending.id, identity);
		}
		const balance = await this.getPatientBalance(tenantId, patientId);
		const baseAmount = input.amount ?? balance.available;
		if (
			parseEtbCents(baseAmount) <= 0 ||
			parseEtbCents(baseAmount) > parseEtbCents(balance.remaining)
		) {
			throw paymentError(
				"Payment amount exceeds the patient's outstanding balance",
			);
		}
		const pending = await this.createPending({
			tenantId,
			identity,
			purpose: "balance",
			referenceId: null,
			baseAmount,
		});
		return this.initializePending(pending.id, identity);
	}

	private async initializeExistingAppointment(
		tenantId: string,
		identity: PatientIdentity,
		appointmentId: string,
	) {
		const [appointment] = await db
			.select({
				id: appointments.id,
				reason: appointments.reason,
				startAt: appointments.startAt,
				endAt: appointments.endAt,
				doctorId: appointments.doctorId,
				paymentId: appointments.paymentId,
			})
			.from(appointments)
			.where(
				and(
					eq(appointments.tenantId, tenantId),
					eq(appointments.id, appointmentId),
					eq(appointments.patientId, identity.patientId),
					eq(appointments.status, "PENDING_PAYMENT"),
				),
			)
			.limit(1);
		if (!appointment?.paymentId)
			throw paymentError(
				"Pending appointment not found",
				404,
				ErrorCode.NOT_FOUND,
			);
		const [payment] = await db
			.select()
			.from(payments)
			.where(eq(payments.id, appointment.paymentId))
			.limit(1);
		if (!payment || payment.status !== "PENDING")
			throw paymentError(
				"Appointment payment is no longer pending",
				409,
				ErrorCode.CONFLICT,
			);
		return this.initializePending(payment.id, identity);
	}

	private async getPendingAppointment(tenantId: string, referenceId?: string) {
		if (!referenceId) throw paymentError("Appointment is required");
		const [appointment] = await db
			.select({ id: appointments.id })
			.from(appointments)
			.where(
				and(
					eq(appointments.tenantId, tenantId),
					eq(appointments.id, referenceId),
					eq(appointments.status, "PENDING_PAYMENT"),
				),
			)
			.limit(1);
		if (!appointment)
			throw paymentError(
				"Pending appointment not found",
				404,
				ErrorCode.NOT_FOUND,
			);
		return appointment.id;
	}

	private async getService(tenantId: string, serviceId: string) {
		const [service] = await db
			.select({
				id: procedures.id,
				name: procedures.name,
				defaultPrice: procedures.defaultPrice,
				defaultDurationMinutes: procedures.defaultDurationMinutes,
			})
			.from(procedures)
			.where(
				and(
					eq(procedures.tenantId, tenantId),
					eq(procedures.id, serviceId),
					eq(procedures.isActive, true),
					isNull(procedures.deletedAt),
				),
			)
			.limit(1);
		if (!service)
			throw paymentError("Dental service not found", 404, ErrorCode.NOT_FOUND);
		return service;
	}

	private async createPending(input: PaymentStart) {
		const money = calculateChapaAmounts(
			input.baseAmount,
			env.SERVICE_CHARGE_ETB,
		);
		const expiresAt = new Date(Date.now() + env.PAYMENT_HOLD_MINUTES * 60_000);
		try {
			// Outside the transaction below: it owns its own connection so a
			// failure here can never abort the booking that follows.
			await this.releaseExpiredHolds(input.tenantId);
			return await this.transaction(async () => {
				if (input.purpose === "balance") {
					await db.execute(
						sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.identity.patientId}, 0))`,
					);
					const currentBalance = await this.getPatientBalance(
						input.tenantId,
						input.identity.patientId,
					);
					if (
						parseEtbCents(input.baseAmount) >
						parseEtbCents(currentBalance.available)
					) {
						throw paymentError(
							"Payment exceeds the available balance",
							409,
							ErrorCode.CONFLICT,
						);
					}
				}
				let appointmentId = input.referenceId;
				if (input.appointment) {
					const [doctor] = await db
						.select({ id: doctors.id })
						.from(doctors)
						.where(
							and(
								eq(doctors.tenantId, input.tenantId),
								eq(doctors.id, input.appointment.doctorId),
								eq(doctors.isAvailable, true),
								isNull(doctors.deletedAt),
							),
						)
						.limit(1);
					if (!doctor)
						throw paymentError(
							"Selected doctor is unavailable",
							404,
							ErrorCode.NOT_FOUND,
						);
					const [conflict] = await db
						.select({ id: appointments.id })
						.from(appointments)
						.where(
							and(
								eq(appointments.tenantId, input.tenantId),
								eq(appointments.doctorId, doctor.id),
								isNull(appointments.deletedAt),
								notInArray(appointments.status, ["CANCELLED", "NO_SHOW"]),
								lt(appointments.startAt, input.appointment.endAt),
								gt(appointments.endAt, input.appointment.startAt),
							),
						)
						.limit(1);
					if (conflict)
						throw paymentError(
							"This appointment time is no longer available",
							409,
							ErrorCode.CONFLICT,
						);
					const [created] = await db
						.insert(appointments)
						.values({
							tenantId: input.tenantId,
							patientId: input.identity.patientId,
							doctorId: doctor.id,
							startAt: input.appointment.startAt,
							endAt: input.appointment.endAt,
							status: "PENDING_PAYMENT",
							paymentExpiresAt: expiresAt,
							reason: input.appointment.serviceName,
							createdByUserId: input.appointment.actorUserId,
						})
						.returning({ id: appointments.id });
					if (!created) throw new Error("Unable to reserve appointment slot");
					appointmentId = created.id;
					await db.insert(appointmentStatusHistory).values({
						tenantId: input.tenantId,
						appointmentId: created.id,
						oldStatus: null,
						newStatus: "PENDING_PAYMENT",
						changedByUserId: input.appointment.actorUserId,
						changedAt: new Date(),
					});
				}
				const [payment] = await db
					.insert(payments)
					.values({
						tenantId: input.tenantId,
						billId: null,
						txRef: txRef(),
						userId: input.identity.userId,
						patientId: input.identity.patientId,
						purpose: input.purpose,
						referenceId: appointmentId,
						baseAmount: money.baseAmount,
						serviceCharge: money.serviceCharge,
						totalAmount: money.totalAmount,
						amount: money.totalAmount,
						currency: "ETB",
						method: "CHAPA",
						status: "PENDING",
						expiresAt,
					})
					.returning();
				if (!payment) throw new Error("Unable to create payment record");
				if (appointmentId) {
					await db
						.update(appointments)
						.set({ paymentId: payment.id })
						.where(eq(appointments.id, appointmentId));
				}
				if (input.cardProductId) {
					await db.insert(userCards).values({
						tenantId: input.tenantId,
						userId: input.identity.userId!,
						patientId: input.identity.patientId,
						cardProductId: input.cardProductId,
						paymentId: payment.id,
						status: "pending",
					});
				}
				await db.insert(paymentEvents).values({
					tenantId: input.tenantId,
					paymentId: payment.id,
					type: "initialized",
					payload: {
						purpose: input.purpose,
						baseAmount: money.baseAmount,
						serviceCharge: money.serviceCharge,
						totalAmount: money.totalAmount,
					},
				});
				return payment;
			});
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "23P01"
			) {
				throw paymentError(
					"This appointment time was just booked. Choose another available time.",
					409,
					ErrorCode.CONFLICT,
				);
			}
			throw error;
		}
	}

	private async initializePending(
		paymentId: string,
		identity: PatientIdentity,
	) {
		const [payment] = await db
			.select()
			.from(payments)
			.where(eq(payments.id, paymentId))
			.limit(1);
		if (!payment?.txRef)
			throw paymentError(
				"Payment reference is missing",
				500,
				ErrorCode.INTERNAL_SERVER_ERROR,
			);
		if (!isDeliverableEmail(identity.email))
			throw paymentError(
				"Add a valid email address in your profile to pay online",
				400,
				"EMAIL_REQUIRED",
			);
		try {
			const initialized = await initializePayment({
				txRef: payment.txRef,
				amount: payment.totalAmount,
				currency: "ETB",
				firstName: identity.firstName,
				lastName: identity.lastName,
				email: identity.email,
				phoneNumber: identity.phoneNumber,
				returnUrl: env.CHAPA_RETURN_URL
					? `${env.CHAPA_RETURN_URL}${env.CHAPA_RETURN_URL.includes("?") ? "&" : "?"}tx_ref=${encodeURIComponent(payment.txRef)}`
					: undefined,
			});
			await this.transaction(async () => {
				await db
					.update(payments)
					.set({
						checkoutUrl: initialized.checkoutUrl,
						chapaReference: initialized.providerReference,
					})
					.where(
						and(eq(payments.id, payment.id), eq(payments.status, "PENDING")),
					);
				await db.insert(paymentEvents).values({
					tenantId: payment.tenantId,
					paymentId: payment.id,
					type: "initialized",
					payload: { checkoutCreated: true },
				});
			});
			return { checkout_url: initialized.checkoutUrl, tx_ref: payment.txRef };
		} catch (error) {
			await this.failPending(
				payment,
				"FAILED",
				"Checkout initialization failed",
			);
			throw error;
		}
	}

	private async failPending(
		payment: typeof payments.$inferSelect,
		status: "FAILED" | "CANCELLED" | "EXPIRED",
		reason: string,
	) {
		await this.transaction(async () => {
			const [changed] = await db
				.update(payments)
				.set({ status })
				.where(and(eq(payments.id, payment.id), eq(payments.status, "PENDING")))
				.returning({ id: payments.id });
			if (!changed) return;
			if (payment.referenceId && payment.purpose === "visit") {
				await db
					.update(appointments)
					.set({
						status: "CANCELLED",
						cancelledAt: new Date(),
						cancelledReason: reason,
						paymentExpiresAt: null,
					})
					.where(
						and(
							eq(appointments.id, payment.referenceId),
							eq(appointments.status, "PENDING_PAYMENT"),
						),
					);
			}
			if (payment.purpose === "card")
				await db
					.update(userCards)
					.set({
						status: status.toLowerCase() as "failed" | "cancelled" | "expired",
					})
					.where(eq(userCards.paymentId, payment.id));
			await db.insert(paymentEvents).values({
				tenantId: payment.tenantId,
				paymentId: payment.id,
				type: "status_changed",
				payload: { status, reason },
			});
		});
	}

	/**
	 * Cancel `PENDING_PAYMENT` appointments whose payment hold has lapsed.
	 *
	 * Runs on its own connection, outside the caller's ambient transaction.
	 * A single failing statement there would abort the whole request
	 * transaction even though the error is swallowed below, which used to
	 * turn a routine sweep into a failed booking with a confusing
	 * "current transaction is aborted" error.
	 */
	private async releaseExpiredHolds(tenantId: string) {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			// Tenant scope only, on this dedicated connection: the RLS policy
			// on payments/appointments keys off `app.tenant_id`.
			await client.query("SELECT set_config('app.tenant_id', $1, true)", [
				tenantId,
			]);
			await client.query("SELECT set_config('app.user_id', '', true)");
			const scoped = drizzle({ client });
			await withDatabase(
				scoped as unknown as Parameters<typeof withDatabase>[0],
				async () => {
					await this.releaseExpiredHoldsScoped(tenantId);
				},
			);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK").catch(() => undefined);
			logger.error(
				{ tenantId, err: error },
				"Failed to release expired holds safely",
			);
		} finally {
			client.release();
		}
	}

	private async releaseExpiredHoldsScoped(tenantId: string) {
		const now = new Date();
		const expired = await db
			.select({ id: appointments.id, paymentId: appointments.paymentId })
			.from(appointments)
			.where(
				and(
					eq(appointments.tenantId, tenantId),
					eq(appointments.status, "PENDING_PAYMENT"),
					lt(appointments.paymentExpiresAt, now),
				),
			);
		for (const appointment of expired) {
			const [changed] = await db
				.update(appointments)
				.set({
					status: "CANCELLED",
					cancelledAt: now,
					cancelledReason: "Payment hold expired",
					paymentExpiresAt: null,
				})
				.where(
					and(
						eq(appointments.id, appointment.id),
						eq(appointments.status, "PENDING_PAYMENT"),
					),
				)
				.returning({ id: appointments.id });
			if (!changed || !appointment.paymentId) continue;
			await db.insert(appointmentStatusHistory).values({
				tenantId,
				appointmentId: appointment.id,
				oldStatus: "PENDING_PAYMENT",
				newStatus: "CANCELLED",
				changedAt: now,
				reason: "Payment hold expired",
			});
			const [payment] = await db
				.update(payments)
				.set({ status: "EXPIRED" })
				.where(
					and(
						eq(payments.id, appointment.paymentId),
						eq(payments.status, "PENDING"),
					),
				)
				.returning({ id: payments.id });
			if (payment)
				await db.insert(paymentEvents).values({
					tenantId,
					paymentId: payment.id,
					type: "status_changed",
					payload: { status: "EXPIRED", reason: "payment hold expired" },
				});
		}
	}

	private async pendingBalanceReservations(
		tenantId: string,
		patientId: string,
	) {
		const [row] = await db
			.select({
				amount: sql<string>`COALESCE(SUM(base_amount), 0)::numeric(12, 2)::text`,
			})
			.from(payments)
			.where(
				and(
					eq(payments.tenantId, tenantId),
					eq(payments.patientId, patientId),
					eq(payments.purpose, "balance"),
					eq(payments.method, "CHAPA"),
					eq(payments.status, "PENDING"),
					gt(payments.expiresAt, new Date()),
				),
			);
		return row?.amount ?? "0.00";
	}

	async settleVerifiedPayment(
		txRefValue: string,
		verified: ChapaVerifiedPayment,
		expectedTenantId?: string,
	) {
		return this.transaction(async () =>
			this.applyVerifiedPayment(txRefValue, verified, expectedTenantId),
		);
	}

	async resolveCheckoutReturn(txRefValue: string) {
		return db.transaction(async (transaction) => {
			await transaction.execute(
				sql`select set_config('app.tenant_id', '', true)`,
			);
			await transaction.execute(
				sql`select set_config('app.is_super_admin', 'true', true)`,
			);
			return withDatabase(transaction, async () => {
				const [payment] = await db
					.select({ slug: tenants.slug })
					.from(payments)
					.innerJoin(tenants, eq(payments.tenantId, tenants.id))
					.where(eq(payments.txRef, txRefValue))
					.limit(1);
				if (!payment)
					throw paymentError(
						"Payment return reference not found",
						404,
						ErrorCode.NOT_FOUND,
					);
				return `nexa-${payment.slug}://payment-return?tx_ref=${encodeURIComponent(txRefValue)}`;
			});
		});
	}

	async processWebhook(
		rawBodyOrPayload: string | unknown,
		signature: string | undefined,
	) {
		const { txRef: reference, verified } = await handleWebhook(
			rawBodyOrPayload,
			signature,
		);
		return db.transaction(async (transaction) => {
			await transaction.execute(
				sql`select set_config('app.tenant_id', '', true)`,
			);
			await transaction.execute(
				sql`select set_config('app.is_super_admin', 'true', true)`,
			);
			return withDatabase(transaction, () =>
				this.applyVerifiedPayment(reference, verified, undefined, true),
			);
		});
	}

	private async applyVerifiedPayment(
		txRefValue: string,
		verified: ChapaVerifiedPayment,
		expectedTenantId?: string,
		webhook = false,
	) {
		const conditions = [eq(payments.txRef, txRefValue)];
		if (expectedTenantId)
			conditions.push(eq(payments.tenantId, expectedTenantId));
		const [payment] = await db
			.select()
			.from(payments)
			.where(and(...conditions))
			.limit(1);
		if (!payment)
			throw paymentError("Payment not found", 404, ErrorCode.NOT_FOUND);
		const verifiedPayload = safeVerifiedPayload(verified);
		if (webhook)
			await db.insert(paymentEvents).values({
				tenantId: payment.tenantId,
				paymentId: payment.id,
				type: "webhook",
				payload: { tx_ref: txRefValue, received: true },
			});
		if (payment.status !== "PENDING")
			return { idempotent: true, status: payment.status };
		const providerStatus = verified.status.toLowerCase();
		if (verified.tx_ref !== payment.txRef)
			throw paymentError("Provider transaction reference mismatch", 400);
		if (providerStatus === "success") {
			let amountMatches = false;
			try {
				amountMatches =
					parseEtbCents(verified.amount) === parseEtbCents(payment.totalAmount);
			} catch {
				amountMatches = false;
			}
			if (
				!amountMatches ||
				verified.currency.toUpperCase() !== "ETB" ||
				payment.currency !== "ETB"
			) {
				const [failed] = await db
					.update(payments)
					.set({ status: "FAILED", verifyPayload: verifiedPayload })
					.where(
						and(eq(payments.id, payment.id), eq(payments.status, "PENDING")),
					)
					.returning({ id: payments.id });
				if (!failed) return { idempotent: true, status: payment.status };
				await db.insert(paymentEvents).values({
					tenantId: payment.tenantId,
					paymentId: payment.id,
					type: "verified",
					payload: {
						...verifiedPayload,
						validation: "amount_or_currency_mismatch",
					},
				});
				await db.insert(paymentEvents).values({
					tenantId: payment.tenantId,
					paymentId: payment.id,
					type: "status_changed",
					payload: {
						from: "PENDING",
						to: "FAILED",
						reason: "amount or currency mismatch",
					},
				});
				await this.releasePaymentReferences(
					payment,
					"Payment verification mismatch",
				);
				return { idempotent: false, status: "FAILED" };
			}
			const [updated] = await db
				.update(payments)
				.set({
					status: "SUCCESS",
					paidAt: new Date(),
					verifyPayload: verifiedPayload,
					chapaReference: verified.reference ?? payment.chapaReference,
				})
				.where(and(eq(payments.id, payment.id), eq(payments.status, "PENDING")))
				.returning({ id: payments.id });
			if (!updated) {
				const [latest] = await db
					.select({ status: payments.status })
					.from(payments)
					.where(eq(payments.id, payment.id))
					.limit(1);
				return { idempotent: true, status: latest?.status ?? "PENDING" };
			}
			await db.insert(paymentEvents).values({
				tenantId: payment.tenantId,
				paymentId: payment.id,
				type: "verified",
				payload: verifiedPayload,
			});
			await db.insert(paymentEvents).values({
				tenantId: payment.tenantId,
				paymentId: payment.id,
				type: "status_changed",
				payload: { from: "PENDING", to: "SUCCESS" },
			});
			await this.applySuccessEffects(payment);
			return { idempotent: false, status: "SUCCESS" };
		}
		if (
			["failed", "cancelled", "canceled", "abandoned", "expired"].includes(
				providerStatus,
			)
		) {
			const status =
				providerStatus === "expired"
					? "EXPIRED"
					: providerStatus === "cancelled" ||
						  providerStatus === "canceled" ||
						  providerStatus === "abandoned"
						? "CANCELLED"
						: "FAILED";
			const [failed] = await db
				.update(payments)
				.set({ status, verifyPayload: verifiedPayload })
				.where(and(eq(payments.id, payment.id), eq(payments.status, "PENDING")))
				.returning({ id: payments.id });
			if (!failed) return { idempotent: true, status: payment.status };
			await db.insert(paymentEvents).values({
				tenantId: payment.tenantId,
				paymentId: payment.id,
				type: "verified",
				payload: verifiedPayload,
			});
			await this.releasePaymentReferences(
				payment,
				`Provider reported ${providerStatus}`,
				status,
			);
			return { idempotent: false, status };
		}
		await db.insert(paymentEvents).values({
			tenantId: payment.tenantId,
			paymentId: payment.id,
			type: "verified",
			payload: verifiedPayload,
		});
		return { idempotent: false, status: "PENDING" };
	}

	private async releasePaymentReferences(
		payment: typeof payments.$inferSelect,
		reason: string,
		nextStatus: "FAILED" | "CANCELLED" | "EXPIRED" = "FAILED",
	) {
		if (payment.purpose === "visit" && payment.referenceId) {
			const [cancelled] = await db
				.update(appointments)
				.set({
					status: "CANCELLED",
					cancelledAt: new Date(),
					cancelledReason: reason,
					paymentExpiresAt: null,
				})
				.where(
					and(
						eq(appointments.id, payment.referenceId),
						eq(appointments.status, "PENDING_PAYMENT"),
					),
				)
				.returning({ id: appointments.id });
			if (cancelled)
				await db.insert(appointmentStatusHistory).values({
					tenantId: payment.tenantId,
					appointmentId: cancelled.id,
					oldStatus: "PENDING_PAYMENT",
					newStatus: "CANCELLED",
					changedAt: new Date(),
					reason,
				});
		}
		if (payment.purpose === "card")
			await db
				.update(userCards)
				.set({
					status: nextStatus.toLowerCase() as
						| "failed"
						| "cancelled"
						| "expired",
				})
				.where(eq(userCards.paymentId, payment.id));
	}

	private async applySuccessEffects(payment: typeof payments.$inferSelect) {
		if (payment.purpose === "visit" && payment.referenceId) {
			const [appointment] = await db
				.select()
				.from(appointments)
				.where(
					and(
						eq(appointments.id, payment.referenceId),
						eq(appointments.tenantId, payment.tenantId),
					),
				)
				.limit(1);
			if (
				!appointment ||
				appointment.status !== "PENDING_PAYMENT" ||
				(appointment.paymentExpiresAt &&
					appointment.paymentExpiresAt <= new Date())
			) {
				if (appointment?.status === "PENDING_PAYMENT")
					await db
						.update(appointments)
						.set({
							status: "CANCELLED",
							cancelledAt: new Date(),
							cancelledReason:
								"Payment was confirmed after the appointment hold expired",
							paymentExpiresAt: null,
						})
						.where(eq(appointments.id, appointment.id));
				await db.insert(paymentEvents).values({
					tenantId: payment.tenantId,
					paymentId: payment.id,
					type: "status_changed",
					payload: {
						note: "Late payment requires clinic reconciliation; appointment not confirmed",
					},
				});
				return;
			}
			const [existingBill] = await db
				.select({ id: bills.id })
				.from(bills)
				.where(
					and(
						eq(bills.tenantId, payment.tenantId),
						eq(bills.appointmentId, appointment.id),
					),
				)
				.limit(1);
			let billId = existingBill?.id;
			if (!billId) {
				const base = payment.baseAmount;
				const [bill] = await db
					.insert(bills)
					.values({
						tenantId: payment.tenantId,
						patientId: appointment.patientId,
						appointmentId: appointment.id,
						billNumber: `APT-${appointment.id.slice(0, 8).toUpperCase()}`,
						status: "PAID",
						subtotal: base,
						discountAmount: "0",
						taxAmount: "0",
						totalAmount: base,
						notes: "Paid appointment visit",
						issuedAt: new Date(),
						createdByUserId: appointment.createdByUserId,
					})
					.returning({ id: bills.id });
				if (!bill) throw new Error("Unable to create visit bill");
				billId = bill.id;
				await db.insert(billItems).values({
					tenantId: payment.tenantId,
					billId,
					procedureId: null,
					description: appointment.reason ?? "Dental appointment",
					quantity: "1",
					unitPrice: base,
					discountAmount: "0",
					taxAmount: "0",
					totalAmount: base,
				});
			}
			await this.allocateToBill(payment, billId, payment.baseAmount);
			await db
				.update(payments)
				.set({ billId })
				.where(eq(payments.id, payment.id));
			await db
				.update(appointments)
				.set({
					status: "CONFIRMED",
					paymentExpiresAt: null,
					cancelledAt: null,
					cancelledReason: null,
				})
				.where(
					and(
						eq(appointments.id, appointment.id),
						eq(appointments.status, "PENDING_PAYMENT"),
					),
				);
			await db.insert(appointmentStatusHistory).values({
				tenantId: payment.tenantId,
				appointmentId: appointment.id,
				oldStatus: "PENDING_PAYMENT",
				newStatus: "CONFIRMED",
				changedByUserId: null,
				changedAt: new Date(),
			});
			return;
		}
		if (payment.purpose === "card") {
			const [purchase] = await db
				.select({
					id: userCards.id,
					validityDays: cardProducts.validityDays,
					patientId: userCards.patientId,
				})
				.from(userCards)
				.innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
				.where(eq(userCards.paymentId, payment.id))
				.limit(1);
			if (!purchase)
				throw new Error("Card purchase record not found for payment");
			const activatedAt = new Date();
			const [card] = await db
				.update(userCards)
				.set({
					status: "active",
					activatedAt,
					expiresAt: purchase.validityDays
						? new Date(
								activatedAt.getTime() + purchase.validityDays * 86_400_000,
							)
						: null,
				})
				.where(eq(userCards.id, purchase.id))
				.returning({ id: userCards.id });
			if (!card) throw new Error("Card purchase record not found for payment");
			await this.syncMembershipTier(payment.tenantId, purchase.patientId);
			return;
		}
		if (payment.purpose === "balance") {
			const balanceBills = await this.outstandingBills(
				payment.tenantId,
				payment.patientId!,
			);
			const allocations = allocateEtbPayment(
				payment.baseAmount,
				balanceBills.map((bill) => ({
					billId: bill.id,
					remaining: bill.remaining,
				})),
			);
			for (const allocation of allocations)
				await this.allocateToBill(
					payment,
					allocation.billId,
					allocation.amount,
				);
		}
	}

	/**
	 * Recompute the membership tier a patient currently holds and store it on
	 * `patients` so dashboards can badge a patient without joining cards.
	 */
	private async syncMembershipTier(tenantId: string, patientId: string | null) {
		if (!patientId) return;
		const active = await db
			.select({ name: cardProducts.name, expiresAt: userCards.expiresAt })
			.from(userCards)
			.innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
			.where(
				and(
					eq(userCards.tenantId, tenantId),
					eq(userCards.patientId, patientId),
					eq(userCards.status, "active"),
				),
			);
		const now = new Date();
		const best =
			active
				.filter((row) => !row.expiresAt || row.expiresAt > now)
				.map((row) => row.name)
				.toSorted((a, b) => tierRank(b) - tierRank(a))[0] ?? null;
		await db
			.update(patients)
			.set({ membershipTier: best })
			.where(and(eq(patients.id, patientId), eq(patients.tenantId, tenantId)));
	}

	private async allocateToBill(
		payment: typeof payments.$inferSelect,
		billId: string,
		amount: string,
	) {
		if (parseEtbCents(amount) === 0) return;
		await db.insert(paymentAllocations).values({
			tenantId: payment.tenantId,
			paymentId: payment.id,
			billId,
			amount,
		});
		const [bill] = await db
			.select({
				total: bills.totalAmount,
				paid: billPaidAmountSql,
			})
			.from(bills)
			.where(and(eq(bills.tenantId, payment.tenantId), eq(bills.id, billId)))
			.limit(1);
		if (bill) {
			const paid = parseEtbCents(bill.paid);
			const total = parseEtbCents(bill.total);
			const status =
				paid <= 0 ? "PENDING" : paid >= total ? "PAID" : "PARTIALLY_PAID";
			await db.update(bills).set({ status }).where(eq(bills.id, billId));
		}
	}

	private async outstandingBills(tenantId: string, patientId: string) {
		const rows = await db
			.select({
				id: bills.id,
				total: bills.totalAmount,
				paid: billPaidAmountSql,
			})
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					eq(bills.patientId, patientId),
					isNull(bills.deletedAt),
					ne(bills.status, "CANCELLED"),
					ne(bills.status, "VOID"),
				),
			)
			.orderBy(asc(bills.createdAt), asc(bills.id));
		return rows
			.map((bill) => ({
				...bill,
				remaining: formatEtbCents(
					Math.max(0, parseEtbCents(bill.total) - parseEtbCents(bill.paid)),
				),
			}))
			.filter((bill) => parseEtbCents(bill.remaining) > 0);
	}

	async getPatientBalance(tenantId: string, patientId: string) {
		const balances = await this.outstandingBills(tenantId, patientId);
		const all = await db
			.select({
				total: bills.totalAmount,
				paid: billPaidAmountSql,
			})
			.from(bills)
			.where(
				and(
					eq(bills.tenantId, tenantId),
					eq(bills.patientId, patientId),
					isNull(bills.deletedAt),
					ne(bills.status, "CANCELLED"),
					ne(bills.status, "VOID"),
				),
			);
		return {
			...summarizeEtbBalance(all),
			pending: await this.pendingBalanceReservations(tenantId, patientId),
			available: formatEtbCents(
				Math.max(
					0,
					parseEtbCents(summarizeEtbBalance(all).remaining) -
						parseEtbCents(
							await this.pendingBalanceReservations(tenantId, patientId),
						),
				),
			),
			billsOutstanding: balances.length,
		};
	}

	async verifyStatus(tenantId: string, userId: string, reference: string) {
		await this.releaseExpiredHolds(tenantId);
		const [payment] = await db
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.tenantId, tenantId),
					eq(payments.txRef, reference),
					eq(payments.userId, userId),
				),
			)
			.limit(1);
		if (!payment)
			throw paymentError("Payment not found", 404, ErrorCode.NOT_FOUND);
		if (payment.status === "PENDING" && payment.method === "CHAPA") {
			const verified = await verifyPayment(reference);
			return this.settleVerifiedPayment(reference, verified, tenantId);
		}
		return { idempotent: true, status: payment.status };
	}

	async recordManual(
		tenantId: string,
		staffUserId: string,
		input: {
			patientId: string;
			purpose: PaymentPurpose;
			referenceId?: string;
			amount: string;
			method: "CASH" | "MOBILE_TRANSFER";
			transferReference?: string;
			note?: string;
		},
	) {
		const identity = await this.identityForPatient(tenantId, input.patientId);
		let referenceId = input.referenceId ?? null;
		let baseAmount = input.amount;
		if (input.purpose === "visit") {
			if (!referenceId)
				throw paymentError("Appointment is required for visit payment");
			const [appointment] = await db
				.select()
				.from(appointments)
				.where(
					and(
						eq(appointments.tenantId, tenantId),
						eq(appointments.id, referenceId),
						eq(appointments.patientId, identity.patientId),
						eq(appointments.status, "PENDING_PAYMENT"),
					),
				)
				.limit(1);
			if (!appointment)
				throw paymentError(
					"Pending appointment not found",
					404,
					ErrorCode.NOT_FOUND,
				);
			const service = await this.getServiceByName(
				tenantId,
				appointment.reason ?? "",
			);
			const servicePrice = service.defaultPrice;
			if (typeof servicePrice !== "string")
				throw paymentError(
					"Service price is not configured",
					409,
					ErrorCode.CONFLICT,
				);
			if (parseEtbCents(input.amount) !== parseEtbCents(servicePrice))
				throw paymentError("Manual visit payment must match the service price");
			baseAmount = servicePrice;
		} else if (input.purpose === "card") {
			if (!referenceId) throw paymentError("Card plan is required");
			if (!identity.userId)
				throw paymentError("A patient account is required to purchase a card");
			await this.ensureCardProducts(tenantId);
			const [product] = await db
				.select()
				.from(cardProducts)
				.where(
					and(
						eq(cardProducts.tenantId, tenantId),
						eq(cardProducts.id, referenceId),
						eq(cardProducts.isActive, true),
					),
				)
				.limit(1);
			if (!product)
				throw paymentError("Card plan not found", 404, ErrorCode.NOT_FOUND);
			if (parseEtbCents(input.amount) !== parseEtbCents(product.price))
				throw paymentError("Manual card payment must match the card price");
			baseAmount = product.price;
		} else {
			const balance = await this.getPatientBalance(
				tenantId,
				identity.patientId,
			);
			const amountCents = parseEtbCents(input.amount);
			if (amountCents < 1 || amountCents > parseEtbCents(balance.available))
				throw paymentError(
					"Manual payment exceeds the available outstanding balance",
				);
			baseAmount = formatEtbCents(amountCents);
		}
		return this.transaction(async () => {
			if (input.purpose === "balance") {
				await db.execute(
					sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity.patientId}, 0))`,
				);
				const currentBalance = await this.getPatientBalance(
					tenantId,
					identity.patientId,
				);
				if (
					parseEtbCents(baseAmount) > parseEtbCents(currentBalance.available)
				) {
					throw paymentError(
						"Manual payment exceeds the available outstanding balance",
						409,
						ErrorCode.CONFLICT,
					);
				}
			}
			const now = new Date();
			const [payment] = await db
				.insert(payments)
				.values({
					tenantId,
					billId: null,
					txRef: null,
					userId: identity.userId,
					patientId: identity.patientId,
					purpose: input.purpose,
					referenceId,
					baseAmount,
					serviceCharge: "0.00",
					totalAmount: baseAmount,
					amount: baseAmount,
					currency: "ETB",
					method: input.method,
					status: "SUCCESS",
					transferReference: input.transferReference,
					reference: input.transferReference,
					recordedByUserId: staffUserId,
					receivedByUserId: staffUserId,
					paidAt: now,
				})
				.returning();
			if (!payment) throw new Error("Unable to record payment");
			if (input.purpose === "visit" && referenceId) {
				const [appointment] = await db
					.update(appointments)
					.set({
						status: "CONFIRMED",
						paymentId: payment.id,
						paymentExpiresAt: null,
						cancelledAt: null,
						cancelledReason: null,
					})
					.where(
						and(
							eq(appointments.tenantId, tenantId),
							eq(appointments.id, referenceId),
							eq(appointments.status, "PENDING_PAYMENT"),
						),
					)
					.returning({
						id: appointments.id,
						patientId: appointments.patientId,
						reason: appointments.reason,
						createdByUserId: appointments.createdByUserId,
					});
				if (!appointment)
					throw paymentError(
						"Appointment is no longer pending",
						409,
						ErrorCode.CONFLICT,
					);
				const bill = await this.createVisitBill(
					tenantId,
					appointment,
					baseAmount,
				);
				await this.allocateToBill(payment, bill.id, baseAmount);
				await db
					.update(payments)
					.set({ billId: bill.id })
					.where(eq(payments.id, payment.id));
				await db.insert(appointmentStatusHistory).values({
					tenantId,
					appointmentId: appointment.id,
					oldStatus: "PENDING_PAYMENT",
					newStatus: "CONFIRMED",
					changedByUserId: staffUserId,
					changedAt: now,
				});
			}
			if (input.purpose === "balance") {
				const outstanding = await this.outstandingBills(
					tenantId,
					identity.patientId,
				);
				for (const allocation of allocateEtbPayment(
					baseAmount,
					outstanding.map((bill) => ({
						billId: bill.id,
						remaining: bill.remaining,
					})),
				))
					await this.allocateToBill(
						payment,
						allocation.billId,
						allocation.amount,
					);
			}
			if (input.purpose === "card" && referenceId) {
				const [product] = await db
					.select({ validityDays: cardProducts.validityDays })
					.from(cardProducts)
					.where(eq(cardProducts.id, referenceId))
					.limit(1);
				await db.insert(userCards).values({
					tenantId,
					userId: identity.userId!,
					patientId: identity.patientId,
					cardProductId: referenceId,
					paymentId: payment.id,
					status: "active",
					activatedAt: now,
					expiresAt: product?.validityDays
						? new Date(now.getTime() + product.validityDays * 86_400_000)
						: null,
				});
				await this.syncMembershipTier(tenantId, identity.patientId);
			}
			await db.insert(paymentEvents).values({
				tenantId,
				paymentId: payment.id,
				type: "manual_recorded",
				payload: {
					method: input.method,
					purpose: input.purpose,
					amount: baseAmount,
					transferReference: input.transferReference ?? null,
					note: input.note ?? null,
					recordedBy: staffUserId,
				},
			});
			await db.insert(paymentEvents).values({
				tenantId,
				paymentId: payment.id,
				type: "status_changed",
				payload: { to: "SUCCESS", source: "manual" },
			});
			return payment;
		});
	}

	private async getServiceByName(tenantId: string, serviceName: string) {
		const [service] = await db
			.select({ id: procedures.id, defaultPrice: procedures.defaultPrice })
			.from(procedures)
			.where(
				and(
					eq(procedures.tenantId, tenantId),
					eq(procedures.name, serviceName),
					eq(procedures.isActive, true),
				),
			)
			.limit(1);
		if (!service)
			throw paymentError(
				"Service price is no longer available",
				409,
				ErrorCode.CONFLICT,
			);
		if (service.defaultPrice === null)
			throw paymentError(
				"Service price is not configured",
				409,
				ErrorCode.CONFLICT,
			);
		return service;
	}

	private async createVisitBill(
		tenantId: string,
		appointment: {
			id: string;
			patientId: string;
			reason: string | null;
			createdByUserId: string | null;
		},
		baseAmount: string,
	) {
		const [bill] = await db
			.insert(bills)
			.values({
				tenantId,
				patientId: appointment.patientId,
				appointmentId: appointment.id,
				billNumber: `APT-${appointment.id.slice(0, 8).toUpperCase()}`,
				status: "PAID",
				subtotal: baseAmount,
				discountAmount: "0",
				taxAmount: "0",
				totalAmount: baseAmount,
				notes: "Paid appointment visit",
				issuedAt: new Date(),
				createdByUserId: appointment.createdByUserId,
			})
			.returning({ id: bills.id });
		if (!bill) throw new Error("Unable to create visit bill");
		await db.insert(billItems).values({
			tenantId,
			billId: bill.id,
			procedureId: null,
			description: appointment.reason ?? "Dental appointment",
			quantity: "1",
			unitPrice: baseAmount,
			discountAmount: "0",
			taxAmount: "0",
			totalAmount: baseAmount,
		});
		return bill;
	}

	async listMine(
		tenantId: string,
		userId: string,
		query: { page: number; pageSize: number },
	) {
		const identity = await this.identityForUser(tenantId, userId);
		const ownerFilter = and(
			eq(payments.tenantId, tenantId),
			or(
				eq(payments.userId, userId),
				eq(payments.patientId, identity.patientId),
			),
		);
		const offset = (query.page - 1) * query.pageSize;
		const [items, totalRows] = await Promise.all([
			db
				.select({
					id: payments.id,
					txRef: payments.txRef,
					purpose: payments.purpose,
					referenceId: payments.referenceId,
					baseAmount: payments.baseAmount,
					serviceCharge: payments.serviceCharge,
					totalAmount: payments.totalAmount,
					currency: payments.currency,
					method: payments.method,
					status: payments.status,
					transferReference: payments.transferReference,
					paidAt: payments.paidAt,
					createdAt: payments.createdAt,
				})
				.from(payments)
				.where(ownerFilter)
				.orderBy(desc(payments.createdAt))
				.limit(query.pageSize)
				.offset(offset),
			db.select({ value: count() }).from(payments).where(ownerFilter),
		]);
		return {
			items: items.map((item) => ({
				...item,
				paidAt: item.paidAt?.toISOString() ?? null,
				createdAt: item.createdAt.toISOString(),
			})),
			total: totalRows[0]?.value ?? 0,
			page: query.page,
			pageSize: query.pageSize,
		};
	}

	/**
	 * The membership tiers the clinic sells.
	 *
	 * `config/card-tiers.ts` is the single source of truth for prices and
	 * benefits; each tier is pushed into `card_products` for this tenant so the
	 * purchase flow can reference it by id without racing a freshly created
	 * tenant that missed the boot-time migration.
	 */
	async listCards(tenantId: string) {
		await this.ensureCardProducts(tenantId);
		const rows = await db
			.select()
			.from(cardProducts)
			.where(
				and(
					eq(cardProducts.tenantId, tenantId),
					eq(cardProducts.isActive, true),
				),
			);
		const byName = new Map(rows.map((row) => [row.name, row]));
		return CARD_TIERS.flatMap((tier) => {
			const row = byName.get(tier.name);
			if (!row) return [];
			const total = inclusiveAmounts(tier.price);
			return [
				{
					id: row.id,
					name: tier.name,
					summary: tier.summary,
					benefits: tier.benefits,
					baseAmount: total.baseAmount,
					// One inclusive price on the mobile app: base + service charge.
					price: total.totalAmount,
					currency: "ETB",
					validityDays: tier.validityDays,
					rank: tier.rank,
				},
			];
		}).concat(
			// Products the clinic created in the dashboard are still purchasable
			// and keep their stored price.
			rows
				.filter((row) => !findCardTier(row.name))
				.map((card) => {
					const total = inclusiveAmounts(card.price);
					return {
						id: card.id,
						name: card.name,
						summary: card.description ?? "",
						benefits: [],
						baseAmount: total.baseAmount,
						price: total.totalAmount,
						currency: "ETB",
						validityDays: card.validityDays,
						rank: 0,
					};
				}),
		);
	}

	/** Upsert `CARD_TIERS` into this tenant's card catalog. */
	private async ensureCardProducts(tenantId: string) {
		for (const tier of CARD_TIERS) {
			const [existing] = await db
				.select({ id: cardProducts.id, price: cardProducts.price })
				.from(cardProducts)
				.where(
					and(
						eq(cardProducts.tenantId, tenantId),
						eq(cardProducts.name, tier.name),
					),
				)
				.limit(1);
			if (!existing) {
				await db.insert(cardProducts).values({
					tenantId,
					name: tier.name,
					description: tier.summary,
					price: tier.price,
					validityDays: tier.validityDays,
				});
				continue;
			}
			if (existing.price !== tier.price) {
				await db
					.update(cardProducts)
					.set({
						price: tier.price,
						description: tier.summary,
						validityDays: tier.validityDays,
					})
					.where(eq(cardProducts.id, existing.id));
			}
		}
	}

	async listMyCards(tenantId: string, userId: string) {
		const rows = await db
			.select({
				id: userCards.id,
				status: userCards.status,
				activatedAt: userCards.activatedAt,
				expiresAt: userCards.expiresAt,
				card: {
					id: cardProducts.id,
					name: cardProducts.name,
					description: cardProducts.description,
				},
			})
			.from(userCards)
			.innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
			.where(
				and(eq(userCards.tenantId, tenantId), eq(userCards.userId, userId)),
			)
			.orderBy(desc(userCards.createdAt));
		return rows.map((row) => {
			const tier = findCardTier(row.card.name);
			return {
				...row,
				summary: tier?.summary ?? row.card.description,
				benefits: tier?.benefits ?? [],
				baseAmount: tier ? tier.price : null,
				totalAmount: tier ? inclusiveAmounts(tier.price).totalAmount : null,
				activatedAt: row.activatedAt?.toISOString() ?? null,
				expiresAt: row.expiresAt?.toISOString() ?? null,
			};
		});
	}

	async listAll(
		tenantId: string,
		filters: {
			search?: string;
			status?: string;
			method?: string;
			purpose?: string;
			recordedBy?: string;
			from?: Date;
			to?: Date;
			sort?: "asc" | "desc";
			page: number;
			pageSize: number;
		},
	) {
		const conditions = [eq(payments.tenantId, tenantId)];
		if (filters.status)
			conditions.push(
				eq(
					payments.status,
					filters.status as typeof payments.$inferSelect.status,
				),
			);
		if (filters.method)
			conditions.push(
				eq(
					payments.method,
					filters.method as typeof payments.$inferSelect.method,
				),
			);
		if (filters.purpose)
			conditions.push(eq(payments.purpose, filters.purpose as PaymentPurpose));
		if (filters.recordedBy)
			conditions.push(eq(payments.recordedByUserId, filters.recordedBy));
		// Bucket on when the money actually landed, falling back to creation
		// time for rows that never settled.
		if (filters.from)
			conditions.push(
				sql`COALESCE(${payments.paidAt}, ${payments.createdAt}) >= ${filters.from}`,
			);
		if (filters.to)
			conditions.push(
				sql`COALESCE(${payments.paidAt}, ${payments.createdAt}) < ${filters.to}`,
			);
		const search = filters.search?.trim();
		const where = and(
			...conditions,
			search
				? or(
						ilike(patients.firstName, `%${search}%`),
						ilike(patients.lastName, `%${search}%`),
						ilike(patients.phone, `%${search}%`),
						ilike(payments.txRef, `%${search}%`),
						ilike(payments.transferReference, `%${search}%`),
					)
				: undefined,
		);
		const [items, totalRows] = await Promise.all([
			db
				.select({
					id: payments.id,
					txRef: payments.txRef,
					purpose: payments.purpose,
					referenceId: payments.referenceId,
					baseAmount: payments.baseAmount,
					serviceCharge: payments.serviceCharge,
					totalAmount: payments.totalAmount,
					currency: payments.currency,
					method: payments.method,
					status: payments.status,
					transferReference: payments.transferReference,
					paidAt: payments.paidAt,
					createdAt: payments.createdAt,
					patientId: payments.patientId,
					patientName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
					patientPhone: patients.phone,
					recordedBy: payments.recordedByUserId,
					recordedByName: users.name,
				})
				.from(payments)
				.leftJoin(
					patients,
					and(
						eq(payments.patientId, patients.id),
						eq(patients.tenantId, tenantId),
					),
				)
				.leftJoin(users, eq(payments.recordedByUserId, users.id))
				.where(where)
				.orderBy(
					filters.sort === "asc"
						? sql`COALESCE(${payments.paidAt}, ${payments.createdAt}) ASC`
						: sql`COALESCE(${payments.paidAt}, ${payments.createdAt}) DESC`,
				)
				.limit(filters.pageSize)
				.offset((filters.page - 1) * filters.pageSize),
			db
				.select({ value: count() })
				.from(payments)
				.leftJoin(
					patients,
					and(
						eq(payments.patientId, patients.id),
						eq(patients.tenantId, tenantId),
					),
				)
				.where(where),
		]);
		return {
			items: items.map((item) => ({
				...item,
				paidAt: item.paidAt?.toISOString() ?? null,
				createdAt: item.createdAt.toISOString(),
			})),
			total: totalRows[0]?.value ?? 0,
			page: filters.page,
			pageSize: filters.pageSize,
		};
	}

	/**
	 * Payments a staff member still has to act on: checkouts waiting for the
	 * patient, transfers that never arrived, and gateway failures.
	 */
	async listQueue(
		tenantId: string,
		filters: { status?: string; page: number; pageSize: number },
	) {
		const conditions = [eq(payments.tenantId, tenantId)];
		if (filters.status)
			conditions.push(
				eq(
					payments.status,
					filters.status as typeof payments.$inferSelect.status,
				),
			);
		else
			conditions.push(
				inArray(payments.status, ["PENDING", "FAILED", "EXPIRED"]),
			);
		const where = and(...conditions);
		const [items, totalRows] = await Promise.all([
			db
				.select({
					id: payments.id,
					txRef: payments.txRef,
					purpose: payments.purpose,
					baseAmount: payments.baseAmount,
					serviceCharge: payments.serviceCharge,
					totalAmount: payments.totalAmount,
					currency: payments.currency,
					method: payments.method,
					status: payments.status,
					referenceId: payments.referenceId,
					transferReference: payments.transferReference,
					checkoutUrl: payments.checkoutUrl,
					expiresAt: payments.expiresAt,
					paidAt: payments.paidAt,
					createdAt: payments.createdAt,
					patientId: payments.patientId,
					patientName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
					patientPhone: patients.phone,
					recordedByName: users.name,
					appointmentStartAt: appointments.startAt,
					appointmentStatus: appointments.status,
				})
				.from(payments)
				.leftJoin(
					patients,
					and(
						eq(payments.patientId, patients.id),
						eq(patients.tenantId, tenantId),
					),
				)
				.leftJoin(users, eq(payments.recordedByUserId, users.id))
				.leftJoin(appointments, eq(payments.referenceId, appointments.id))
				.where(where)
				.orderBy(desc(payments.createdAt))
				.limit(filters.pageSize)
				.offset((filters.page - 1) * filters.pageSize),
			db.select({ value: count() }).from(payments).where(where),
		]);
		const now = Date.now();
		return {
			items: items.map((item) => ({
				...item,
				paidAt: item.paidAt?.toISOString() ?? null,
				createdAt: item.createdAt.toISOString(),
				expiresAt: item.expiresAt?.toISOString() ?? null,
				appointmentStartAt: item.appointmentStartAt?.toISOString() ?? null,
				// A checkout whose hold has lapsed can no longer be confirmed.
				holdExpired: Boolean(item.expiresAt && item.expiresAt.getTime() < now),
			})),
			total: totalRows[0]?.value ?? 0,
			page: filters.page,
			pageSize: filters.pageSize,
		};
	}

	async listRecorders(tenantId: string) {
		return db
			.selectDistinct({ id: users.id, name: users.name })
			.from(payments)
			.innerJoin(users, eq(payments.recordedByUserId, users.id))
			.where(eq(payments.tenantId, tenantId))
			.orderBy(asc(users.name));
	}

	async summary(tenantId: string) {
		const [row] = await db
			.select({
				totalRevenue: sql<string>`COALESCE(SUM(base_amount) FILTER (WHERE status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				serviceChargesCollected: sql<string>`COALESCE(SUM(service_charge) FILTER (WHERE status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				grossCollected: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				pendingCount: sql<number>`COUNT(*) FILTER (WHERE status = 'PENDING')::int`,
				failedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'FAILED')::int`,
				cash: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE method = 'CASH' AND status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				transfer: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE method = 'MOBILE_TRANSFER' AND status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				chapa: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE method = 'CHAPA' AND status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				today: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE COALESCE(paid_at, created_at) >= date_trunc('day', now()) AND status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				week: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE COALESCE(paid_at, created_at) >= date_trunc('week', now()) AND status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				month: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE COALESCE(paid_at, created_at) >= date_trunc('month', now()) AND status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
				expiredCount: sql<number>`COUNT(*) FILTER (WHERE status = 'EXPIRED')::int`,
				cancelledCount: sql<number>`COUNT(*) FILTER (WHERE status = 'CANCELLED')::int`,
				visitCount: sql<number>`COUNT(*) FILTER (WHERE purpose = 'visit' AND status IN ('SUCCESS', 'COMPLETED'))::int`,
				cardCount: sql<number>`COUNT(*) FILTER (WHERE purpose = 'card' AND status IN ('SUCCESS', 'COMPLETED'))::int`,
				balanceCount: sql<number>`COUNT(*) FILTER (WHERE purpose = 'balance' AND status IN ('SUCCESS', 'COMPLETED'))::int`,
			})
			.from(payments)
			.where(eq(payments.tenantId, tenantId));
		return (
			row ?? {
				totalRevenue: "0.00",
				serviceChargesCollected: "0.00",
				grossCollected: "0.00",
				pendingCount: 0,
				failedCount: 0,
				cash: "0.00",
				transfer: "0.00",
				chapa: "0.00",
				today: "0.00",
				week: "0.00",
				month: "0.00",
				expiredCount: 0,
				cancelledCount: 0,
				visitCount: 0,
				cardCount: 0,
				balanceCount: 0,
			}
		);
	}
}

export const paymentsService = new PaymentsService();
