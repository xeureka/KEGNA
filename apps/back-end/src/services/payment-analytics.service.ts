import { and, count, desc, eq, sql } from "drizzle-orm";
import { payments } from "@/db/schema";
import { db } from "@/db";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

type PaymentRow = typeof payments.$inferSelect;

/**
 * Read-only payment reporting for the patient status endpoint and the
 * staff analytics endpoint. Every query is tenant-scoped by an explicit
 * `tenant_id` predicate (and, for the patient view, `user_id`), so it never
 * crosses clinic or patient boundaries even though it does not mutate.
 */
export class PaymentAnalyticsService {
	/**
	 * Return enriched details for the authenticated patient's own payment.
	 * This is a companion to `PaymentsService.verifyStatus`: callers first run
	 * verify/settlement through the shared finalize path, then read the fresh
	 * row here to expose purpose/amount details to result screens.
	 */
	async getPaymentStatusDetail(
		tenantId: string,
		userId: string,
		txRef: string,
	): Promise<{
		idempotent: boolean;
		status: PaymentRow["status"];
		txRef: string;
		purpose: PaymentRow["purpose"];
		method: PaymentRow["method"];
		currency: string;
		amount: string;
		totalAmount: string;
		baseAmount: string;
		paidAt: string | null;
		createdAt: string;
	}> {
		const [payment] = await db
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.tenantId, tenantId),
					eq(payments.txRef, txRef),
					eq(payments.userId, userId),
				),
			)
			.limit(1);
		if (!payment)
			throw new AppError("Payment not found", 404, ErrorCode.NOT_FOUND);

		return {
			idempotent: payment.status !== "PENDING",
			status: payment.status,
			txRef: payment.txRef ?? txRef,
			purpose: payment.purpose,
			method: payment.method,
			currency: payment.currency,
			amount: payment.totalAmount,
			totalAmount: payment.totalAmount,
			baseAmount: payment.baseAmount,
			paidAt: payment.paidAt?.toISOString() ?? null,
			createdAt: payment.createdAt.toISOString(),
		};
	}

	/**
	 * Tenant-scoped analytics for staff dashboards. Success rate is computed
	 * from success vs total attempts; revenue figures only count settled
	 * payments (SUCCESS/COMPLETED), matching the summary endpoint.
	 */
	async getPaymentAnalytics(tenantId: string) {
		const [totals] = await db
			.select({
				totalAttempts: count(),
				successCount: sql<number>`COUNT(*) FILTER (WHERE status IN ('SUCCESS', 'COMPLETED'))::int`,
				failedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'FAILED')::int`,
			})
			.from(payments)
			.where(eq(payments.tenantId, tenantId));

		const byPurpose = await db
			.select({
				purpose: payments.purpose,
				revenue: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
			})
			.from(payments)
			.where(eq(payments.tenantId, tenantId))
			.groupBy(payments.purpose);

		const byDay = await db
			.select({
				date: sql<string>`to_char(date_trunc('day', COALESCE(${payments.paidAt}, ${payments.createdAt})), 'YYYY-MM-DD')`,
				revenue: sql<string>`COALESCE(SUM(${payments.totalAmount}) FILTER (WHERE status IN ('SUCCESS', 'COMPLETED')), 0)::numeric(12, 2)::text`,
			})
			.from(payments)
			.where(
				and(
					eq(payments.tenantId, tenantId),
					sql`date_trunc('day', COALESCE(${payments.paidAt}, ${payments.createdAt})) >= date_trunc('day', now()) - interval '29 days'`,
				),
			)
			.groupBy(
				sql`date_trunc('day', COALESCE(${payments.paidAt}, ${payments.createdAt}))`,
			)
			.orderBy(
				desc(
					sql`date_trunc('day', COALESCE(${payments.paidAt}, ${payments.createdAt}))`,
				),
			);

		const successCount = totals?.successCount ?? 0;
		const totalAttempts = totals?.totalAttempts ?? 0;
		const successRate =
			totalAttempts === 0
				? 0
				: Math.round((successCount / totalAttempts) * 10_000) / 100;

		const byDayMap = new Map<string, string>();
		for (const day of byDay) byDayMap.set(day.date, day.revenue);

		// Fill the last 30 days so the dashboard series has no holes.
		const revenueByDay: Array<{ date: string; revenue: string }> = [];
		for (let offset = 29; offset >= 0; offset--) {
			const day = new Date();
			day.setUTCHours(0, 0, 0, 0);
			day.setUTCDate(day.getUTCDate() - offset);
			const key = day.toISOString().slice(0, 10);
			revenueByDay.push({ date: key, revenue: byDayMap.get(key) ?? "0.00" });
		}

		const orderedPurposes: Array<PaymentRow["purpose"]> = [
			"visit",
			"card",
			"balance",
		];
		const byPurposeMap = new Map(
			byPurpose.map((row) => [row.purpose, row.revenue]),
		);

		return {
			totalAttempts,
			successCount,
			failedCount: totals?.failedCount ?? 0,
			successRate,
			revenueByPurpose: orderedPurposes.map((purpose) => ({
				purpose,
				revenue: byPurposeMap.get(purpose) ?? "0.00",
			})),
			revenueByDay,
		};
	}
}

export const paymentAnalyticsService = new PaymentAnalyticsService();
