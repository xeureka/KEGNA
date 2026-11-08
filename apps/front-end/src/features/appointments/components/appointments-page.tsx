import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
	AppointmentFormModal,
	RescheduleAppointmentModal,
} from "@/components/appointments/appointment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
	EmptyState,
	InlineError,
	PageHeader,
	Spinner,
} from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
	Th,
} from "@/components/ui/table";
import { useSort } from "@/hooks/use-sort";
import { api } from "@/lib/api";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status";
import type { Appointment, AppointmentStatus, Paginated } from "@/lib/types";
import { formatDate, formatTime, titleCase } from "@/lib/utils";

const PAGE_SIZE = 10;

const cancelSchema = z.object({
	cancelledReason: z.string().trim().max(2000).optional(),
});

const STATUS_OPTIONS: AppointmentStatus[] = [
	"SCHEDULED",
	"CONFIRMED",
	"CHECKED_IN",
	"IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
	"NO_SHOW",
];

const ACTION_STATUS_MAP: Record<string, AppointmentStatus> = {
	"check-in": "CHECKED_IN",
	start: "IN_PROGRESS",
	complete: "COMPLETED",
	"no-show": "NO_SHOW",
};

export function AppointmentsPage() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
	const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(
		null,
	);

	const { data, isLoading, error } = useQuery({
		queryKey: ["appointments", page, status],
		queryFn: () =>
			api.get<Paginated<Appointment>>("/appointments", {
				page,
				pageSize: PAGE_SIZE,
				status: status || undefined,
			}),
		refetchInterval: 5_000,
		refetchIntervalInBackground: false,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["appointments"] });
		queryClient.invalidateQueries({ queryKey: ["dashboard"] });
	};

	const transitionMutation = useMutation({
		mutationFn: ({
			action,
			id,
		}: {
			action: "check-in" | "start" | "complete" | "no-show";
			id: string;
		}) =>
			api.patch(`/appointments/${id}/status`, {
				status: ACTION_STATUS_MAP[action],
			}),
		onSuccess: () => {
			toast.success("Appointment updated");
			invalidate();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Action failed"),
	});

	const cancelMutation = useMutation({
		mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
			api.patch(`/appointments/${id}/status`, {
				status: "CANCELLED",
				reason: reason || undefined,
			}),
		onSuccess: () => {
			toast.success("Appointment cancelled");
			setCancelTarget(null);
			invalidate();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Cancel failed"),
	});

	const appointments = data?.items ?? [];
	const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

	const { sorted, key, dir, toggle } = useSort(appointments, "startAt");

	return (
		<div className="space-y-5">
			<PageHeader
				title="Appointments"
				subtitle="Patient visits across the practice"
				actions={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className="size-4" /> New appointment
					</Button>
				}
			/>

			<Card>
				<div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
					<label
						htmlFor="status-filter"
						className="text-sm font-medium text-slate-600"
					>
						Status
					</label>
					<Select
						id="status-filter"
						value={status}
						onChange={(e) => {
							setPage(1);
							setStatus(e.target.value);
						}}
						className="w-44"
					>
						<option value="">All statuses</option>
						{STATUS_OPTIONS.map((s) => (
							<option key={s} value={s}>
								{titleCase(s)}
							</option>
						))}
					</Select>
				</div>

				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error
								? error.message
								: "Failed to load appointments"
						}
					/>
				) : null}

				{!isLoading && !error && appointments.length === 0 ? (
					<EmptyState
						title="No appointments found"
						description="Schedule a new appointment for a patient."
						action={
							<Button onClick={() => setCreateOpen(true)}>
								<Plus className="size-4" /> New appointment
							</Button>
						}
					/>
				) : null}

				{!isLoading && !error && appointments.length > 0 ? (
					<>
						<Table>
							<TableHead>
								<SortableTh
									field="startAt"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Date
								</SortableTh>
								<SortableTh
									field="startAt"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Time
								</SortableTh>
								<SortableTh
									field="patientName"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Patient
								</SortableTh>
								<SortableTh
									field="doctorName"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Doctor
								</SortableTh>
								<SortableTh
									field="status"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Status
								</SortableTh>
								<Th className="text-right">Actions</Th>
							</TableHead>
							<TableBody>
								{sorted.map((appt) => (
									<TableRow key={appt.id}>
										<Td className="font-medium whitespace-nowrap text-slate-900">
											{formatDate(appt.startAt)}
										</Td>
										<Td className="whitespace-nowrap text-slate-600">
											{formatTime(appt.startAt.slice(11, 16))} –{" "}
											{formatTime(appt.endAt.slice(11, 16))}
										</Td>
										<Td>
											<p className="font-medium text-slate-900">
												{appt.patientName}
											</p>
											{appt.reason ? (
												<p
													className="max-w-52 truncate text-xs text-slate-500"
													title={appt.reason}
												>
													{appt.reason}
												</p>
											) : null}
										</Td>
										<Td className="text-slate-600">{appt.doctorName}</Td>
										<Td>
											<Badge tone={APPOINTMENT_STATUS_TONE[appt.status]}>
												{titleCase(appt.status)}
											</Badge>
										</Td>
										<Td className="text-right">
											<AppointmentActions
												appt={appt}
												onTransition={(action) =>
													transitionMutation.mutate({ action, id: appt.id })
												}
												onCancel={() => setCancelTarget(appt)}
												onReschedule={() => setRescheduleTarget(appt)}
												busy={transitionMutation.isPending}
											/>
										</Td>
									</TableRow>
								))}
							</TableBody>
						</Table>
						<Pagination
							page={page}
							totalPages={totalPages}
							onPageChange={setPage}
						/>
					</>
				) : null}
			</Card>

			<AppointmentFormModal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onCreated={() => {
					setCreateOpen(false);
					invalidate();
				}}
			/>

			<CancelAppointmentModal
				appt={cancelTarget}
				onClose={() => setCancelTarget(null)}
				onCancel={(reason) => {
					if (cancelTarget)
						cancelMutation.mutate({ id: cancelTarget.id, reason });
				}}
				submitting={cancelMutation.isPending}
			/>

			<RescheduleAppointmentModal
				appt={rescheduleTarget}
				onClose={() => setRescheduleTarget(null)}
				onRescheduled={() => setRescheduleTarget(null)}
			/>
		</div>
	);
}

function AppointmentActions({
	appt,
	onTransition,
	onCancel,
	onReschedule,
	busy,
}: {
	appt: Appointment;
	onTransition: (action: "check-in" | "start" | "complete" | "no-show") => void;
	onCancel: () => void;
	onReschedule: () => void;
	busy: boolean;
}) {
	switch (appt.status) {
		case "SCHEDULED":
			return (
				<div className="inline-flex items-center gap-1.5">
					<Button
						size="sm"
						loading={busy}
						onClick={() => onTransition("check-in")}
					>
						Check in
					</Button>
					<Button size="sm" variant="secondary" onClick={onReschedule}>
						Reschedule
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => onTransition("no-show")}
					>
						No-show
					</Button>
					<Button size="sm" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				</div>
			);
		case "CONFIRMED":
			return (
				<div className="inline-flex items-center gap-1.5">
					<Button
						size="sm"
						loading={busy}
						onClick={() => onTransition("check-in")}
					>
						Check in
					</Button>
					<Button size="sm" variant="secondary" onClick={onReschedule}>
						Reschedule
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => onTransition("no-show")}
					>
						No-show
					</Button>
					<Button size="sm" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				</div>
			);
		case "CHECKED_IN":
			return (
				<div className="inline-flex items-center gap-1.5">
					<Button
						size="sm"
						loading={busy}
						onClick={() => onTransition("start")}
					>
						Start visit
					</Button>
					<Button size="sm" variant="secondary" onClick={onReschedule}>
						Reschedule
					</Button>
					<Button size="sm" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				</div>
			);
		case "IN_PROGRESS":
			return (
				<div className="inline-flex items-center gap-1.5">
					<Button
						size="sm"
						variant="primary"
						loading={busy}
						onClick={() => onTransition("complete")}
					>
						Complete
					</Button>
					<Button size="sm" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				</div>
			);
		default:
			return <span className="text-xs text-slate-400">—</span>;
	}
}

function CancelAppointmentModal({
	appt,
	onClose,
	onCancel,
	submitting,
}: {
	appt: Appointment | null;
	onClose: () => void;
	onCancel: (reason?: string) => void;
	submitting: boolean;
}) {
	const { register, handleSubmit, reset } = useForm<{
		cancelledReason?: string;
	}>({
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
					? `${appt.patientName} · ${formatDate(appt.startAt)} ${formatTime(appt.startAt.slice(11, 16))}`
					: undefined
			}
		>
			<form
				onSubmit={handleSubmit((v) => onCancel(v.cancelledReason))}
				className="space-y-4"
			>
				<Field
					label="Reason"
					hint="Optional — shown to staff in the appointment record."
				>
					<Input
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
