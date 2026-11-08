import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
	AppointmentFormModal,
	type AppointmentPrefill,
} from "@/components/appointments/appointment-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { api } from "@/lib/api";
import {
	addDays,
	buildMonthGrid,
	DAY_LABELS,
	formatDayLabel,
	formatMonthLabel,
	isSameDay,
	isToday,
	minutesToLabel,
	minutesToTime,
	startOfMonth,
	startOfWeek,
	toISODate,
} from "@/lib/calendar";
import type { Appointment, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";
import { hasPermission, useSession } from "@/lib/auth";

const START_MINUTES = 8 * 60;
const END_MINUTES = 18 * 60;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 36;

type View = "day" | "week" | "month";

const toneClasses: Record<Appointment["status"], string> = {
	SCHEDULED: "border-slate-200 bg-slate-50 text-slate-700",
	CONFIRMED: "border-primary-200 bg-primary-50 text-primary-700",
	CHECKED_IN: "border-slate-200 bg-slate-50 text-slate-700",
	IN_PROGRESS: "border-primary-200 bg-primary-50 text-primary-700",
	COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
	CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
	NO_SHOW: "border-amber-200 bg-amber-50 text-amber-700",
};

function startAtToMinutes(iso: string): number {
	const d = new Date(iso);
	return d.getHours() * 60 + d.getMinutes();
}

function startAtToDate(iso: string): Date {
	return new Date(iso);
}

export function AppointmentCalendarPage() {
	const { data: session } = useSession();
	const isDoctor = session?.role?.name === "DOCTOR";
	const canBook = hasPermission("appointments.create");
	const [view, setView] = useState<View>("week");
	const [cursor, setCursor] = useState(() => new Date());
	const [createOpen, setCreateOpen] = useState(false);
	const [prefill, setPrefill] = useState<AppointmentPrefill | undefined>();

	const { from, to } = useMemo(() => {
		if (view === "day") return { from: cursor, to: cursor };
		if (view === "week") {
			const monday = startOfWeek(cursor);
			return { from: monday, to: addDays(monday, 6) };
		}
		const first = startOfMonth(cursor);
		return {
			from: first,
			to: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0),
		};
	}, [view, cursor]);

	const { data, isLoading, error } = useQuery({
		queryKey: [
			"appointments",
			"calendar",
			view,
			toISODate(from),
			toISODate(to),
		],
		queryFn: () =>
			api.get<Paginated<Appointment>>("/appointments", {
				page: 1,
				pageSize: 100,
				dateFrom: toISODate(from),
				dateTo: toISODate(to),
			}),
	});
	const { data: doctorProfile } = useQuery({
		queryKey: ["doctor", "me"],
		queryFn: () => api.get<{ id: string }>("/doctors/me/profile"),
		enabled: isDoctor,
	});

	const appointments = data?.items ?? [];

	const move = (dir: 1 | -1) => {
		setCursor((c) => {
			if (view === "day") return addDays(c, dir);
			if (view === "week") return addDays(c, dir * 7);
			return new Date(c.getFullYear(), c.getMonth() + dir, 1);
		});
	};

	const openBooking = (p?: AppointmentPrefill) => {
		if (!canBook) return;
		setPrefill(p);
		setCreateOpen(true);
	};

	const rangeLabel =
		view === "day"
			? formatDayLabel(cursor)
			: view === "week"
				? `${formatDayLabel(from)} – ${formatDayLabel(to)}`
				: formatMonthLabel(cursor);

	return (
		<div className="space-y-5">
			<PageHeader
				title="Appointment calendar"
				subtitle="Booked and available slots across the practice"
				actions={
					canBook ? (
						<Button onClick={() => openBooking()}>
							<Plus className="size-4" /> New appointment
						</Button>
					) : undefined
				}
			/>

			<Card>
				<div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
					<div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
						{(["day", "week", "month"] as const).map((v) => (
							<button
								key={v}
								type="button"
								onClick={() => setView(v)}
								className={cn(
									"px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
									view === v
										? "bg-primary-600 text-white"
										: "bg-white text-slate-600 hover:bg-slate-50",
								)}
							>
								{v}
							</button>
						))}
					</div>

					<div className="flex items-center gap-1.5">
						<Button
							size="sm"
							variant="secondary"
							onClick={() => move(-1)}
							aria-label="Previous"
						>
							<ChevronLeft className="size-4" />
						</Button>
						<Button
							size="sm"
							variant="secondary"
							onClick={() => setCursor(new Date())}
						>
							Today
						</Button>
						<Button
							size="sm"
							variant="secondary"
							onClick={() => move(1)}
							aria-label="Next"
						>
							<ChevronRight className="size-4" />
						</Button>
					</div>

					<p className="ml-auto flex items-center gap-2 text-sm font-semibold text-slate-800">
						<CalendarDays className="size-4 text-slate-400" />
						{rangeLabel}
					</p>
				</div>

				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error ? error.message : "Failed to load schedule"
						}
					/>
				) : null}

				{!isLoading && !error ? (
					<div className="p-4">
						{view === "day" ? (
							<DayView
								date={cursor}
								appointments={appointments}
								onBook={openBooking}
							/>
						) : null}
						{view === "week" ? (
							<WeekView
								weekStart={from}
								appointments={appointments}
								onBook={openBooking}
								onNavigateDay={(day) => {
									setCursor(day);
									setView("day");
								}}
							/>
						) : null}
						{view === "month" ? (
							<MonthView
								monthDate={cursor}
								appointments={appointments}
								onNavigateDay={(day) => {
									setCursor(day);
									setView("day");
								}}
							/>
						) : null}
					</div>
				) : null}
			</Card>

			<AppointmentFormModal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onCreated={() => setCreateOpen(false)}
				prefill={prefill}
				hideDoctor={isDoctor}
				defaultDoctorId={doctorProfile?.id}
			/>
		</div>
	);
}

function DayView({
	date,
	appointments,
	onBook,
}: {
	date: Date;
	appointments: Appointment[];
	onBook: (prefill?: AppointmentPrefill) => void;
}) {
	const slots: number[] = [];
	for (let m = START_MINUTES; m < END_MINUTES; m += SLOT_MINUTES) slots.push(m);

	const bookingAt = (slotStart: number) =>
		appointments.find((a) => {
			const s = startAtToMinutes(a.startAt);
			const e = startAtToMinutes(a.endAt);
			return s < slotStart + SLOT_MINUTES && e > slotStart;
		});

	return (
		<div className="overflow-x-auto">
			<div className="flex min-w-96">
				<div className="w-16 shrink-0">
					{slots.map((m) => (
						<div
							key={m}
							className="pr-2 text-right text-xs text-slate-400"
							style={{ height: SLOT_HEIGHT }}
						>
							{m % 60 === 0 ? minutesToLabel(m) : ""}
						</div>
					))}
				</div>

				<div
					className="relative flex-1 border-l border-slate-200"
					style={{ height: slots.length * SLOT_HEIGHT }}
				>
					{slots.map((m) => {
						const booking = bookingAt(m);
						return (
							<button
								key={m}
								type="button"
								onClick={() => {
									if (!booking) {
										onBook({
											appointmentDate: toISODate(date),
											startTime: minutesToTime(m),
											endTime: minutesToTime(m + SLOT_MINUTES),
										});
									}
								}}
								disabled={Boolean(booking)}
								className={cn(
									"absolute left-0 flex w-full items-center border-b border-slate-100 transition-colors",
									booking ? "" : "hover:bg-primary-500/5",
								)}
								style={{
									top: ((m - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT,
									height: SLOT_HEIGHT,
								}}
							>
								{!booking ? (
									<span className="px-2 text-[11px] text-slate-300">
										Available
									</span>
								) : null}
							</button>
						);
					})}

					{appointments.map((a) => {
						const s = startAtToMinutes(a.startAt);
						const e = startAtToMinutes(a.endAt);
						if (e <= START_MINUTES || s >= END_MINUTES) return null;
						const top =
							((Math.max(s, START_MINUTES) - START_MINUTES) / SLOT_MINUTES) *
							SLOT_HEIGHT;
						const height =
							((Math.min(e, END_MINUTES) - Math.max(s, START_MINUTES)) /
								SLOT_MINUTES) *
							SLOT_HEIGHT;
						return (
							<div
								key={a.id}
								title={`${a.patientName} · ${a.doctorName} · ${a.status.replace("_", " ")}`}
								className={cn(
									"absolute right-1 left-1 z-10 overflow-hidden rounded-md border px-2 py-1",
									toneClasses[a.status],
								)}
								style={{ top: top + 2, height: height - 4 }}
							>
								<p className="truncate text-xs font-semibold">
									{a.patientName}
								</p>
								<p className="truncate text-[11px] opacity-80">
									{minutesToLabel(s)} – {minutesToLabel(e)}
								</p>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function WeekView({
	weekStart,
	appointments,
	onBook,
	onNavigateDay,
}: {
	weekStart: Date;
	appointments: Appointment[];
	onBook: (prefill?: AppointmentPrefill) => void;
	onNavigateDay: (day: Date) => void;
}) {
	const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

	return (
		<div className="overflow-x-auto">
			<div className="grid min-w-[48rem] grid-cols-7 gap-2">
				{days.map((day) => {
					const dayAppts = appointments.filter((a) =>
						isSameDay(startAtToDate(a.startAt), day),
					);
					return (
						<div
							key={toISODate(day)}
							className="flex flex-col rounded-lg border border-slate-200"
						>
							<button
								type="button"
								onClick={() => onNavigateDay(day)}
								className={cn(
									"border-b border-slate-200 px-2 py-1.5 text-center",
									isToday(day) ? "bg-primary-50" : "bg-slate-50",
								)}
							>
								<p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
									{DAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
								</p>
								<p
									className={cn(
										"text-sm font-bold",
										isToday(day) ? "text-primary-600" : "text-slate-800",
									)}
								>
									{day.getDate()}
								</p>
							</button>
							<div className="flex-1 space-y-1 p-1.5">
								{dayAppts.map((a) => (
									<div
										key={a.id}
										title={`${a.patientName} · ${a.doctorName} · ${a.status.replace("_", " ")}`}
										className={cn(
											"rounded-md border px-1.5 py-1",
											toneClasses[a.status],
										)}
									>
										<p className="truncate text-[11px] font-semibold">
											{a.patientName}
										</p>
										<p className="truncate text-[10px] opacity-80">
											{minutesToLabel(startAtToMinutes(a.startAt))} ·{" "}
											{a.doctorName}
										</p>
									</div>
								))}
								{dayAppts.length === 0 ? (
									<button
										type="button"
										onClick={() => onBook({ appointmentDate: toISODate(day) })}
										className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 py-2 text-[11px] text-slate-400 transition-colors hover:border-primary-500 hover:text-primary-600"
									>
										<Plus className="size-3" /> Book slot
									</button>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function MonthView({
	monthDate,
	appointments,
	onNavigateDay,
}: {
	monthDate: Date;
	appointments: Appointment[];
	onNavigateDay: (day: Date) => void;
}) {
	const cells = buildMonthGrid(monthDate);
	const weeks: Date[][] = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

	return (
		<div className="overflow-x-auto">
			<div className="min-w-[44rem]">
				<div className="grid grid-cols-7 border-b border-slate-200">
					{DAY_LABELS.map((label) => (
						<div
							key={label}
							className="px-2 py-1.5 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase"
						>
							{label}
						</div>
					))}
				</div>
				{weeks.map((week) => (
					<div
						key={week[0].toISOString()}
						className="grid grid-cols-7 border-b border-slate-200"
					>
						{week.map((day) => {
							const inMonth = day.getMonth() === monthDate.getMonth();
							const dayAppts = appointments.filter((a) =>
								isSameDay(startAtToDate(a.startAt), day),
							);
							return (
								<button
									key={toISODate(day)}
									type="button"
									onClick={() => onNavigateDay(day)}
									className={cn(
										"flex min-h-20 flex-col items-stretch gap-1 border-r border-slate-100 p-1.5 text-left transition-colors last:border-r-0 hover:bg-slate-50",
										!inMonth && "bg-slate-50 text-slate-400",
									)}
								>
									<span
										className={cn(
											"flex size-6 items-center justify-center rounded-full text-xs font-semibold",
											isToday(day) ? "bg-primary-600 text-white" : "",
										)}
									>
										{day.getDate()}
									</span>
									{dayAppts.slice(0, 2).map((a) => (
										<span
											key={a.id}
											className={cn(
												"truncate rounded px-1 py-0.5 text-[10px] font-medium",
												toneClasses[a.status],
											)}
										>
											{minutesToLabel(startAtToMinutes(a.startAt))}{" "}
											{a.patientName}
										</span>
									))}
									{dayAppts.length > 2 ? (
										<span className="text-[10px] font-medium text-slate-500">
											+{dayAppts.length - 2} more
										</span>
									) : null}
								</button>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
}
