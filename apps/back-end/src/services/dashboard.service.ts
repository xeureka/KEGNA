import { appointmentService } from "./appointment.service";
import { billingRepository } from "@/repositories/billing.repository";
import { patientRepository } from "@/repositories/patient.repository";
import type { AppointmentRow } from "@/repositories/appointment.repository";
import type { AppointmentStatus } from "@/db/schema";

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

const DAY = 24 * 60 * 60 * 1000;

function num(v: unknown): number {
	return typeof v === "number" ? v : 0;
}

async function settle<T>(work: Promise<T>): Promise<T | null> {
	try {
		return await work;
	} catch {
		return null;
	}
}

export interface DashboardStats {
	date: string;
	role: string | null;
	today: {
		total: number;
		checkedIn: number;
		inProgress: number;
		completed: number;
		cancelled: number;
		revenueCollected: number;
		queue: AppointmentRow[];
	};
	upcoming: {
		items: AppointmentRow[];
		total: number;
	};
	month: {
		appointments: number;
		newPatients: number;
		billsIssued: number;
		revenueCollected: number;
	};
	outstandingBalance: number;
	statusDistribution: Array<{ status: AppointmentStatus; value: number }>;
}

export class DashboardService {
	async getStats(
		tenantId: string,
		opts: { roleName?: string | null; doctorId?: string | null },
	): Promise<DashboardStats> {
		const now = new Date();
		const today = dateStr(now);
		const dayStart = new Date(now);
		dayStart.setUTCHours(0, 0, 0, 0);
		const tomorrow = new Date(dayStart.getTime() + DAY);
		const nextWeek = new Date(dayStart.getTime() + 7 * DAY);
		const monthStart = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
		);
		const nextMonth = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
		);

		const doctorId = opts.doctorId ?? undefined;

		// Tenant requests run inside one Drizzle transaction so RLS settings are
		// transaction-local. Do not issue concurrent queries on that one client.
		// Each independent card remains best-effort, but failures settle visibly as
		// an empty card instead of leaving a transaction with overlapping queries.
		const queueVal = await settle(
			appointmentService.queueForDay(tenantId, today, doctorId),
		);
		const todayCountsVal = await settle(
			appointmentService.statusCounts(tenantId, dayStart, tomorrow, doctorId),
		);
		const upcomingVal = await settle(
			opts.doctorId
				? appointmentService.list(tenantId, {
						doctorId,
						dateFrom: today,
						dateTo: dateStr(nextWeek),
						page: 1,
						pageSize: 20,
					})
				: appointmentService.list(tenantId, {
						dateFrom: today,
						dateTo: dateStr(nextWeek),
						page: 1,
						pageSize: 20,
					}),
		);
		const monthCountsVal = await settle(
			appointmentService.statusCounts(
				tenantId,
				monthStart,
				nextMonth,
				doctorId,
			),
		);
		const revenueCollectedVal = num(
			await settle(billingRepository.collectedIn(tenantId, dayStart, tomorrow)),
		);
		const billsIssuedVal = num(
			await settle(
				billingRepository.countBillsInPeriod(tenantId, monthStart, nextMonth),
			),
		);
		const newPatientsVal = num(
			await settle(patientRepository.count(tenantId, undefined, monthStart)),
		);
		const outstandingBalanceVal = num(
			await settle(billingRepository.outstandingBalance(tenantId)),
		);

		const todayCountsList = todayCountsVal ?? [];
		const todayCount = (status: AppointmentStatus) =>
			todayCountsList.find((c) => c.status === status)?.value ?? 0;

		const queueItems = queueVal ?? [];
		const upcomingItems: { items: AppointmentRow[]; total: number } =
			upcomingVal
				? { items: upcomingVal.items, total: upcomingVal.total }
				: { items: [], total: 0 };
		const monthAppointments = (monthCountsVal ?? []).reduce(
			(sum, c) => sum + (c?.value ?? 0),
			0,
		);

		const revenueCollectedMonth = await billingRepository
			.collectedIn(tenantId, monthStart, nextMonth)
			.catch(() => 0);

		return {
			date: today,
			role: opts.roleName ?? null,
			today: {
				total: todayCountsList.reduce((sum, c) => sum + c.value, 0),
				checkedIn: todayCount("CHECKED_IN") + todayCount("IN_PROGRESS"),
				inProgress: todayCount("IN_PROGRESS"),
				completed: todayCount("COMPLETED"),
				cancelled: todayCount("CANCELLED") + todayCount("NO_SHOW"),
				revenueCollected: Math.round(revenueCollectedVal * 100) / 100,
				queue: queueItems,
			},
			upcoming: {
				items: upcomingItems.items.filter(
					(a) => a.status === "SCHEDULED" || a.status === "CONFIRMED",
				),
				total: upcomingItems.items.filter(
					(a) => a.status === "SCHEDULED" || a.status === "CONFIRMED",
				).length,
			},
			month: {
				appointments: monthAppointments,
				newPatients: newPatientsVal,
				billsIssued: billsIssuedVal,
				revenueCollected: Math.round(revenueCollectedMonth * 100) / 100,
			},
			outstandingBalance: Math.round(outstandingBalanceVal * 100) / 100,
			statusDistribution: todayCountsList,
		};
	}
}

export const dashboardService = new DashboardService();
