import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CalendarDays, ReceiptText, Users } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api";
import type { DashboardData, DailyReport, FinancialReport } from "@/lib/types";
import { formatCurrency, titleCase } from "@/lib/utils";

function todayStr() {
	return new Date().toISOString().slice(0, 10);
}

function Distribution({
	title,
	items,
	total,
}: {
	title: string;
	items: Array<{ label: string; count: number }>;
	total: number;
}) {
	return (
		<Card>
			<CardHeader title={title} subtitle="Breakdown across records" />
			<CardContent className="space-y-3">
				{items.map((item) => {
					const pct = total === 0 ? 0 : Math.round((item.count / total) * 100);
					return (
						<div key={item.label}>
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-600">{item.label}</span>
								<span className="font-semibold text-slate-900">
									{item.count}
									<span className="ml-1.5 text-xs font-normal text-slate-400">
										{pct}%
									</span>
								</span>
							</div>
							<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
								<div
									className="h-full rounded-full bg-primary-600"
									style={{ width: `${pct}%` }}
								/>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}

export function ReportsPage() {
	const [dailyDate, setDailyDate] = useState(todayStr);
	const [dateFrom, setDateFrom] = useState(todayStr);
	const [dateTo, setDateTo] = useState(todayStr);
	const [doctorId, setDoctorId] = useState("");
	const [treatmentType, setTreatmentType] = useState("");

	const {
		data: dashboard,
		isLoading: dashLoading,
		error: dashError,
	} = useQuery<DashboardData>({
		queryKey: ["reports", "dashboard"],
		queryFn: () => api.get<DashboardData>("/dashboard"),
		refetchInterval: 10_000,
	});

	const {
		data: daily,
		isLoading: dailyLoading,
		error: dailyError,
	} = useQuery<DailyReport>({
		queryKey: ["reports", "daily", dailyDate],
		queryFn: () => api.get<DailyReport>("/reports/daily", { date: dailyDate }),
		refetchInterval: 10_000,
	});

	const { data: financial } = useQuery<FinancialReport>({
		queryKey: [
			"reports",
			"financial",
			dateFrom,
			dateTo,
			doctorId,
			treatmentType,
		],
		queryFn: () =>
			api.get<FinancialReport>("/reports/financial", {
				dateFrom,
				dateTo,
				doctorId: doctorId || undefined,
				treatmentType: treatmentType || undefined,
			}),
		refetchInterval: 10_000,
	});

	const isLoading = dashLoading || dailyLoading;
	const error = dashError ?? dailyError;

	const dailyApptItems = daily
		? [
				{ label: titleCase("scheduled"), count: daily.appointments.scheduled },
				{ label: titleCase("confirmed"), count: daily.appointments.confirmed },
				{ label: titleCase("checkedIn"), count: daily.appointments.checkedIn },
				{
					label: titleCase("inProgress"),
					count: daily.appointments.inProgress,
				},
				{ label: titleCase("completed"), count: daily.appointments.completed },
				{ label: titleCase("cancelled"), count: daily.appointments.cancelled },
				{ label: titleCase("noShow"), count: daily.appointments.noShow },
			]
		: [];

	return (
		<div className="space-y-6">
			<PageHeader
				title="Reports"
				subtitle="Revenue, billing and appointment analytics"
			/>

			{isLoading ? <Spinner /> : null}
			{error ? (
				<InlineError
					message={
						error instanceof Error ? error.message : "Failed to load reports"
					}
				/>
			) : null}

			{dashboard ? (
				<>
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard
							label="Month Appointments"
							value={dashboard.month.appointments}
							icon={CalendarDays}
						/>
						<StatCard
							label="New Patients"
							value={dashboard.month.newPatients}
							icon={Users}
						/>
						<StatCard
							label="Bills Issued"
							value={dashboard.month.billsIssued}
							icon={ReceiptText}
						/>
						<StatCard
							label="Revenue Collected"
							value={formatCurrency(dashboard.month.revenueCollected)}
							icon={Banknote}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
						<StatCard
							label="Today's Total"
							value={dashboard.today.total}
							icon={CalendarDays}
						/>
						<StatCard
							label="Checked In"
							value={dashboard.today.checkedIn}
							icon={Users}
						/>
						<StatCard
							label="In Progress"
							value={dashboard.today.inProgress}
							icon={ReceiptText}
						/>
						<StatCard
							label="Completed"
							value={dashboard.today.completed}
							icon={Banknote}
						/>
						<StatCard
							label="Today's Revenue"
							value={formatCurrency(dashboard.today.revenueCollected)}
							icon={Banknote}
						/>
					</div>
				</>
			) : null}

			{daily ? (
				<>
					<Card>
						<CardHeader
							title="Daily Report"
							subtitle={`Stats for ${daily.date}`}
						/>
						<CardContent>
							<div className="mb-4">
								<label className="text-sm font-medium text-slate-600">
									Pick a date
								</label>
								<input
									type="date"
									value={dailyDate}
									onChange={(e) => setDailyDate(e.target.value)}
									className="ml-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
								<StatCard
									label="Patients Seen"
									value={daily.patientsSeen}
									icon={Users}
								/>
								<StatCard
									label="Bills Issued"
									value={daily.billsIssued}
									icon={ReceiptText}
								/>
								<StatCard
									label="Invoiced"
									value={formatCurrency(daily.invoiced)}
									icon={ReceiptText}
								/>
								<StatCard
									label="Revenue Collected"
									value={formatCurrency(daily.revenueCollected)}
									icon={Banknote}
								/>
								<StatCard
									label="Total Appointments"
									value={daily.appointments.total}
									icon={CalendarDays}
								/>
							</div>
						</CardContent>
					</Card>

					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<Distribution
							title="Appointments by status"
							items={dailyApptItems}
							total={daily.appointments.total}
						/>
					</div>
				</>
			) : null}

			{financial ? (
				<Card>
					<CardHeader
						title="Financial report"
						subtitle="Filter by date range, doctor, and treatment type."
					/>
					<CardContent>
						<div className="mb-4 flex flex-wrap items-end gap-3">
							<label className="text-sm text-slate-600">
								From
								<input
									type="date"
									value={dateFrom}
									onChange={(e) => setDateFrom(e.target.value)}
									className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
								/>
							</label>
							<label className="text-sm text-slate-600">
								To
								<input
									type="date"
									value={dateTo}
									onChange={(e) => setDateTo(e.target.value)}
									className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
								/>
							</label>
							<label className="text-sm text-slate-600">
								Doctor ID
								<input
									value={doctorId}
									onChange={(e) => setDoctorId(e.target.value)}
									placeholder="All doctors"
									className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
								/>
							</label>
							<label className="text-sm text-slate-600">
								Treatment
								<input
									value={treatmentType}
									onChange={(e) => setTreatmentType(e.target.value)}
									placeholder="All treatments"
									className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
								/>
							</label>
						</div>
						<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
							<StatCard
								label="Bills"
								value={financial.bills}
								icon={ReceiptText}
							/>
							<StatCard
								label="Invoiced"
								value={formatCurrency(financial.invoiced)}
								icon={ReceiptText}
							/>
							<StatCard
								label="Collected"
								value={formatCurrency(financial.collected)}
								icon={Banknote}
							/>
							<StatCard
								label="Outstanding"
								value={formatCurrency(financial.outstanding)}
								icon={Banknote}
							/>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
