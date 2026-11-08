import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Banknote,
	CalendarDays,
	CheckCircle2,
	ClipboardList,
	FileText,
	ReceiptText,
	WalletCards,
	Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { StatCard } from "@/components/ui/stat-card";
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
	Th,
} from "@/components/ui/table";
import { hasPermission, useSession } from "@/lib/auth";
import { api } from "@/lib/api";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status";
import {
	type DashboardData,
	type DashboardQueueItem,
	type PlatformTenant,
	type RoleName,
} from "@/lib/types";
import {
	formatCurrency,
	formatDateTime,
	formatTime,
	titleCase,
} from "@/lib/utils";

const cancelSchema = z.object({
	cancelledReason: z.string().trim().min(1, "A reason is required").max(2000),
});
type CancelFormValues = z.infer<typeof cancelSchema>;

type ActionStatus = "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW";

const CAN_MANAGE: RoleName[] = ["RECEPTIONIST"];
const SEE_FINANCE: RoleName[] = [
	"OWNER",
	"ADMIN",
	"RECEPTIONIST",
	"ACCOUNTANT",
];

function isWaiting(status: string): boolean {
	return (
		status === "SCHEDULED" || status === "CONFIRMED" || status === "CHECKED_IN"
	);
}

export function DashboardPage() {
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	const [cancelTarget, setCancelTarget] = useState<DashboardQueueItem | null>(
		null,
	);

	const roleName: RoleName = (session?.role?.name as RoleName) || "OWNER";
	const isSuperAdmin = session?.user?.isSuperAdmin === true;
	const canTransition =
		(hasPermission("appointments.update") || CAN_MANAGE.includes(roleName)) &&
		roleName !== "ACCOUNTANT";

	const dashboardQuery = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => api.get<DashboardData>("/dashboard"),
		enabled: !isSuperAdmin,
		refetchInterval: 5_000,
		refetchIntervalInBackground: false,
	});
	const platformQuery = useQuery({
		queryKey: ["platform-tenants"],
		queryFn: () => api.get<PlatformTenant[]>("/super-admin/tenants"),
		enabled: isSuperAdmin,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		queryClient.invalidateQueries({ queryKey: ["appointments"] });
	};

	const statusMutation = useMutation({
		mutationFn: ({
			id,
			status,
			reason,
		}: {
			id: string;
			status: ActionStatus;
			reason?: string;
		}) =>
			api.patch<DashboardQueueItem>(`/appointments/${id}/status`, {
				status,
				reason,
			}),
		onSuccess: () => {
			toast.success("Appointment updated");
			invalidate();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Action failed"),
	});

	const cancelMutation = useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			api.patch<DashboardQueueItem>(`/appointments/${id}/status`, {
				status: "CANCELLED",
				reason,
			}),
		onSuccess: () => {
			toast.success("Appointment cancelled");
			setCancelTarget(null);
			invalidate();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Cancel failed"),
	});

	if (isSuperAdmin) {
		return <PlatformDashboard query={platformQuery} />;
	}

	const data = dashboardQuery.data;
	const isDoctor = roleName === "DOCTOR";
	const seeFinance = SEE_FINANCE.includes(roleName);

	const queue = [...(data?.today?.queue ?? [])].sort((a, b) =>
		(a.startAt ?? "").localeCompare(b.startAt ?? ""),
	);
	const waiting = queue.filter((q) => isWaiting(q.status));
	const inProgress = queue.filter((q) => q.status === "IN_PROGRESS");
	const upcoming = data?.upcoming?.items ?? [];

	const subtitle = isDoctor
		? `Welcome back, ${session?.user?.name ?? "doctor"}`
		: data
			? `Operations overview for ${formatDateTime(data.date)}`
			: "Operations overview";

	const actionsFor = (item: DashboardQueueItem): ReactNode =>
		canTransition ? (
			<FrontDeskActions
				status={item.status}
				busy={statusMutation.isPending}
				onTransition={(status) =>
					statusMutation.mutate({ id: item.id, status })
				}
				onCancel={() => setCancelTarget(item)}
			/>
		) : (
			<span className="text-xs text-slate-400">—</span>
		);

	return (
		<div className="space-y-6">
			<PageHeader title="Dashboard" subtitle={subtitle} />

			{dashboardQuery.isError ? (
				<InlineError
					message={
						dashboardQuery.error instanceof Error
							? dashboardQuery.error.message
							: "Failed to load dashboard"
					}
				/>
			) : null}

			{dashboardQuery.isLoading ? <Spinner label="Loading overview" /> : null}

			{!dashboardQuery.isLoading && !dashboardQuery.isError && !data ? (
				<InlineError message="The dashboard returned no data. Refresh and try again." />
			) : null}

			{data ? (
				<>
					{isDoctor ? (
						<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
							<StatCard
								label="Today's appointments"
								value={data.today?.total ?? 0}
								icon={CalendarDays}
							/>
							<StatCard
								label="In consultation"
								value={data.today?.inProgress ?? 0}
								icon={ClipboardList}
							/>
							<StatCard
								label="Completed"
								value={data.today?.completed ?? 0}
								icon={CheckCircle2}
							/>
							<StatCard
								label="Collected (today)"
								value={formatCurrency(data.today?.revenueCollected ?? 0)}
								icon={Banknote}
							/>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
							<StatCard
								label="Appointments (month)"
								value={data.month?.appointments ?? 0}
								icon={CalendarDays}
							/>
							<StatCard
								label="New patients (month)"
								value={data.month?.newPatients ?? 0}
								icon={Users}
							/>
							<StatCard
								label="Bills issued (month)"
								value={data.month?.billsIssued ?? 0}
								icon={FileText}
							/>
							{seeFinance ? (
								<StatCard
									label="Revenue (month)"
									value={formatCurrency(data.month?.revenueCollected ?? 0)}
									icon={Banknote}
								/>
							) : (
								<StatCard
									label="Checked in (today)"
									value={data.today?.checkedIn ?? 0}
									icon={CheckCircle2}
								/>
							)}
							<StatCard
								label="Collected (today)"
								value={formatCurrency(data.today?.revenueCollected ?? 0)}
								icon={ReceiptText}
							/>
						</div>
					)}

					{!isDoctor ? (
						<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
							<StatCard
								label="Today total"
								value={data.today?.total ?? 0}
								icon={ClipboardList}
							/>
							<StatCard
								label="Checked in"
								value={data.today?.checkedIn ?? 0}
								icon={CheckCircle2}
							/>
							<StatCard
								label="In consultation"
								value={data.today?.inProgress ?? 0}
								icon={Users}
							/>
							<StatCard
								label="Completed"
								value={data.today?.completed ?? 0}
								icon={FileText}
							/>
						</div>
					) : null}
					{seeFinance ? (
						<StatCard
							label="Outstanding balance"
							value={formatCurrency(data.outstandingBalance ?? 0)}
							icon={WalletCards}
						/>
					) : null}

					{(data.statusDistribution?.length ?? 0) > 0 ? (
						<Card>
							<CardHeader title="Today by status" />
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{(data.statusDistribution ?? []).map((row) => (
										<Badge
											key={row.status}
											tone={APPOINTMENT_STATUS_TONE[row.status] ?? "neutral"}
										>
											{titleCase(row.status)} · {row.value}
										</Badge>
									))}
								</div>
							</CardContent>
						</Card>
					) : null}

					<Card>
						<CardHeader
							title={isDoctor ? "Today's consultations" : "Today's queue"}
							subtitle={`${queue.length} appointment${queue.length === 1 ? "" : "s"}`}
						/>
						<div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
							<QueueColumn
								title={`Waiting room (${waiting.length})`}
								entries={waiting}
								actions={actionsFor}
								empty="No patients waiting."
							/>
							<QueueColumn
								title={`In consultation (${inProgress.length})`}
								entries={inProgress}
								actions={actionsFor}
								empty={
									isDoctor
										? "No consultations under way."
										: "No consultations under way."
								}
							/>
						</div>
					</Card>

					<Card>
						<CardHeader
							title="Today's appointments"
							subtitle={
								isDoctor
									? "Appointments assigned to you"
									: "All appointments for this tenant"
							}
						/>
						{queue.length === 0 ? (
							<div className="px-5 py-10 text-center text-sm text-slate-500">
								No appointments scheduled today.
							</div>
						) : (
							<Table>
								<TableHead>
									<Th>Date & time</Th>
									<Th>Patient</Th>
									<Th>Doctor</Th>
									<Th>Status</Th>
								</TableHead>
								<TableBody>
									{queue.map((item) => (
										<TableRow key={item.id}>
											<Td className="font-medium whitespace-nowrap text-slate-900">
												{formatDateTime(item.startAt)}
											</Td>
											<Td className="font-medium text-slate-900">
												{item.patientName}
											</Td>
											<Td className="text-slate-600">{item.doctorName}</Td>
											<Td>
												<Badge
													tone={
														APPOINTMENT_STATUS_TONE[item.status] ?? "neutral"
													}
												>
													{titleCase(item.status)}
												</Badge>
											</Td>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</Card>

					{upcoming.length > 0 || !isDoctor ? (
						<Card>
							<CardHeader
								title="Upcoming"
								subtitle={
									isDoctor
										? "Your next scheduled appointments"
										: "Next scheduled appointments"
								}
							/>
							{upcoming.length === 0 ? (
								<div className="px-5 py-10 text-center text-sm text-slate-500">
									No upcoming appointments scheduled.
								</div>
							) : (
								<Table>
									<TableHead>
										<Th>Date & time</Th>
										<Th>Patient</Th>
										<Th>Doctor</Th>
										<Th>Status</Th>
										<Th className="text-right">Actions</Th>
									</TableHead>
									<TableBody>
										{upcoming.map((item) => (
											<TableRow key={item.id}>
												<Td className="font-medium whitespace-nowrap text-slate-900">
													{formatDateTime(item.startAt)}
												</Td>
												<Td className="font-medium text-slate-900">
													{item.patientName}
												</Td>
												<Td className="text-slate-600">{item.doctorName}</Td>
												<Td>
													<Badge
														tone={
															APPOINTMENT_STATUS_TONE[item.status] ?? "neutral"
														}
													>
														{titleCase(item.status)}
													</Badge>
												</Td>
												<Td className="text-right">{actionsFor(item)}</Td>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</Card>
					) : null}
				</>
			) : null}

			<CancelWithReasonModal
				appt={cancelTarget}
				onClose={() => setCancelTarget(null)}
				onConfirm={(reason) => {
					if (cancelTarget)
						cancelMutation.mutate({ id: cancelTarget.id, reason });
				}}
				submitting={cancelMutation.isPending}
			/>
		</div>
	);
}

export function PlatformDashboard({
	query,
}: {
	query: {
		data?: PlatformTenant[];
		isLoading: boolean;
		isError: boolean;
		error: unknown;
	};
}) {
	const tenants = query.data ?? [];
	const queryClient = useQueryClient();
	const tenantMutation = useMutation({
		mutationFn: ({
			id,
			...body
		}: {
			id: string;
			name?: string;
			status?: string;
		}) => api.patch(`/super-admin/tenants/${id}`, body),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }),
	});
	const active = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
	const suspended = tenants.filter(
		(tenant) => tenant.status === "SUSPENDED",
	).length;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Platform Dashboard"
				subtitle="Tenant health and onboarding controls"
			/>
			{query.isError ? (
				<InlineError
					message={
						query.error instanceof Error
							? query.error.message
							: "Unable to load tenant health"
					}
				/>
			) : null}
			{query.isLoading ? <Spinner label="Loading platform overview" /> : null}
			{!query.isLoading && !query.isError ? (
				<>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<StatCard
							label="Total clinics"
							value={tenants.length}
							icon={Users}
						/>
						<StatCard
							label="Active clinics"
							value={active}
							icon={CheckCircle2}
						/>
						<StatCard
							label="Suspended clinics"
							value={suspended}
							icon={ClipboardList}
						/>
					</div>
					<Card>
						<CardHeader
							title="Clinic tenants"
							subtitle="Platform-wide tenant status"
						/>
						{tenants.length === 0 ? (
							<div className="px-5 py-10 text-center text-sm text-slate-500">
								No tenants yet. Use Tenant Onboarding to create the first
								clinic.
							</div>
						) : (
							<Table>
								<TableHead>
									<Th>Clinic</Th>
									<Th>Slug</Th>
									<Th>Status</Th>
									<Th>Brand</Th>
									<Th>Actions</Th>
								</TableHead>
								<TableBody>
									{tenants.map((tenant) => (
										<TableRow key={tenant.id}>
											<Td className="font-medium text-slate-900">
												{tenant.name}
											</Td>
											<Td className="text-slate-600">{tenant.slug}</Td>
											<Td>
												<Badge
													tone={
														tenant.status === "ACTIVE" ? "success" : "danger"
													}
												>
													{titleCase(tenant.status)}
												</Badge>
											</Td>
											<Td className="space-x-2">
												<Button
													size="sm"
													variant="secondary"
													onClick={() => {
														const name = window.prompt(
															"Tenant name",
															tenant.name,
														);
														if (name?.trim() && name.trim() !== tenant.name)
															tenantMutation.mutate({
																id: tenant.id,
																name: name.trim(),
															});
													}}
												>
													Edit
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => {
														if (window.confirm(`Deactivate ${tenant.name}?`))
															tenantMutation.mutate({
																id: tenant.id,
																status: "SUSPENDED",
															});
													}}
												>
													{tenant.status === "ACTIVE"
														? "Deactivate"
														: "Keep inactive"}
												</Button>
											</Td>
											<Td>
												<span
													className="inline-block size-4 rounded-full border border-slate-200"
													style={{ backgroundColor: tenant.brandColor }}
													title={tenant.brandColor}
												/>
											</Td>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</Card>
				</>
			) : null}
		</div>
	);
}

function QueueColumn({
	title,
	entries,
	actions,
	empty,
}: {
	title: string;
	entries: DashboardQueueItem[];
	actions: (item: DashboardQueueItem) => ReactNode;
	empty: string;
}) {
	return (
		<div>
			<div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">
				{title}
			</div>
			{entries.length === 0 ? (
				<div className="px-5 py-10 text-center text-sm text-slate-500">
					{empty}
				</div>
			) : (
				<ul className="divide-y divide-slate-200">
					{entries.map((item) => (
						<li
							key={item.id}
							className="flex items-center justify-between gap-3 px-5 py-3"
						>
							<div className="min-w-0">
								<p className="text-sm font-medium text-slate-900">
									{formatTime(item.startAt)} · {item.patientName}
								</p>
								<p className="truncate text-xs text-slate-500">
									{item.doctorName}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<Badge tone={APPOINTMENT_STATUS_TONE[item.status] ?? "neutral"}>
									{titleCase(item.status)}
								</Badge>
								{actions(item)}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function FrontDeskActions({
	status,
	busy,
	onTransition,
	onCancel,
}: {
	status: string;
	busy: boolean;
	onTransition: (status: ActionStatus) => void;
	onCancel: () => void;
}) {
	if (status === "SCHEDULED" || status === "CONFIRMED") {
		return (
			<div className="inline-flex items-center gap-1.5">
				<Button
					size="sm"
					loading={busy}
					onClick={() => onTransition("CHECKED_IN")}
				>
					Check in
				</Button>
				<Button
					size="sm"
					variant="secondary"
					loading={busy}
					onClick={() => onTransition("NO_SHOW")}
				>
					No-show
				</Button>
				<Button size="sm" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		);
	}
	if (status === "CHECKED_IN") {
		return (
			<div className="inline-flex items-center gap-1.5">
				<Button
					size="sm"
					loading={busy}
					onClick={() => onTransition("IN_PROGRESS")}
				>
					Start visit
				</Button>
				<Button size="sm" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		);
	}
	if (status === "IN_PROGRESS") {
		return (
			<div className="inline-flex items-center gap-1.5">
				<Button
					size="sm"
					loading={busy}
					onClick={() => onTransition("COMPLETED")}
				>
					Complete
				</Button>
				<Button size="sm" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		);
	}
	return <span className="text-xs text-slate-400">—</span>;
}

function CancelWithReasonModal({
	appt,
	onClose,
	onConfirm,
	submitting,
}: {
	appt: DashboardQueueItem | null;
	onClose: () => void;
	onConfirm: (reason: string) => void;
	submitting: boolean;
}) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<CancelFormValues>({
		resolver: zodResolver(cancelSchema),
	});

	const close = () => {
		reset();
		onClose();
	};

	return (
		<Modal
			open={appt !== null}
			onClose={close}
			title="Cancel appointment"
			subtitle={
				appt
					? `${appt.patientName} · ${formatDateTime(appt.startAt)}`
					: undefined
			}
		>
			<form
				onSubmit={handleSubmit((v) => onConfirm(v.cancelledReason))}
				className="space-y-4"
			>
				<Field
					label="Reason"
					error={errors.cancelledReason?.message}
					hint="Required — recorded against the appointment."
				>
					<Textarea
						placeholder="e.g. Patient unable to attend"
						{...register("cancelledReason")}
					/>
				</Field>
				<div className="flex items-center justify-end gap-2">
					<Button type="button" variant="secondary" onClick={close}>
						Keep appointment
					</Button>
					<Button type="submit" variant="danger" loading={submitting}>
						Cancel appointment
					</Button>
				</div>
			</form>
		</Modal>
	);
}
