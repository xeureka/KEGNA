import { appointmentService } from "./appointment.service";
import { billingRepository } from "@/repositories/billing.repository";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

export interface DailyReport {
	date: string;
	appointments: {
		scheduled: number;
		confirmed: number;
		checkedIn: number;
		inProgress: number;
		completed: number;
		cancelled: number;
		noShow: number;
		total: number;
	};
	patientsSeen: number;
	billsIssued: number;
	invoiced: number;
	revenueCollected: number;
}

function dayBounds(date: string): { gte: Date; lte: Date } {
	const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
	return {
		gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
		lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
	};
}

export class ReportService {
	async daily(
		tenantId: string,
		date: string,
		doctorId?: string,
	): Promise<DailyReport> {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			throw new AppError(
				"date must use YYYY-MM-DD format",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		const queue = await appointmentService.queueForDay(
			tenantId,
			date,
			doctorId,
		);
		const { gte, lte } = dayBounds(date);

		const counts = {
			scheduled: queue.filter((a) => a.status === "SCHEDULED").length,
			confirmed: queue.filter((a) => a.status === "CONFIRMED").length,
			checkedIn: queue.filter((a) => a.status === "CHECKED_IN").length,
			inProgress: queue.filter((a) => a.status === "IN_PROGRESS").length,
			completed: queue.filter((a) => a.status === "COMPLETED").length,
			cancelled: queue.filter((a) => a.status === "CANCELLED").length,
			noShow: queue.filter((a) => a.status === "NO_SHOW").length,
			total: queue.length,
		};

		const patientsSeen = new Set(
			queue.filter((a) => a.status === "COMPLETED").map((a) => a.patientId),
		).size;

		const periodEnd = new Date(lte.getTime() + 1);
		// The tenant middleware keeps RLS settings on one transaction-bound
		// PostgreSQL client. Query that client sequentially; Promise.all would
		// interleave commands and produce a 500 for this report.
		const billsIssued = await billingRepository.countBillsInPeriod(
			tenantId,
			gte,
			periodEnd,
		);
		const revenueCollected = await billingRepository.collectedIn(
			tenantId,
			gte,
			periodEnd,
		);
		const periodRows = await billingRepository.summaryForPeriod(
			tenantId,
			gte,
			periodEnd,
		);

		const invoiced =
			Math.round(periodRows.reduce((sum, r) => sum + r.invoiced, 0) * 100) /
			100;

		return {
			date,
			appointments: counts,
			patientsSeen,
			billsIssued,
			invoiced,
			revenueCollected: Math.round(revenueCollected * 100) / 100,
		};
	}
}

export const reportService = new ReportService();
