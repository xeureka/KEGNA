import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "../../lib/api.ts";
import type {
	Appointment,
	Doctor,
	Paginated,
	Patient,
} from "../../lib/types.ts";
import { Button } from "../ui/button.tsx";
import { Field, Input, Select } from "../ui/field.tsx";
import { Modal } from "../ui/modal.tsx";

const appointmentSchema = z
	.object({
		patientId: z.string().uuid("Select a patient").optional(),
		doctorId: z.string().uuid("Select a doctor"),
		appointmentDate: z.string().min(1, "Pick a date"),
		startTime: z.string().min(1, "Start time is required"),
		endTime: z.string().min(1, "End time is required"),
		reason: z.string().trim().max(2000).optional(),
	})
	.refine((v) => !v.startTime || !v.endTime || v.startTime < v.endTime, {
		message: "Start time must be before end time",
		path: ["endTime"],
	})
	.refine(
		(v) =>
			!v.appointmentDate ||
			!v.startTime ||
			new Date(`${v.appointmentDate}T${v.startTime}:00`) > new Date(),
		{
			message: "Appointments must be scheduled in the future",
			path: ["appointmentDate"],
		},
	);

export type AppointmentFormValues = z.infer<typeof appointmentSchema>;

export interface AppointmentPrefill {
	doctorId?: string;
	appointmentDate?: string;
	startTime?: string;
	endTime?: string;
}

function toISODateTime(date: string, time: string): string {
	return `${date}T${time}:00`;
}

function useDoctorOptions(enabled: boolean) {
	return useQuery({
		queryKey: ["doctors", "options"],
		queryFn: () =>
			api.get<Paginated<Doctor>>("/doctors", { page: 1, pageSize: 100 }),
		enabled,
	});
}

function AppointmentFields({
	register,
	errors,
	doctors,
	patients,
	showPatient,
	hideDoctor,
	selectedDate,
}: {
	register: ReturnType<typeof useForm<AppointmentFormValues>>["register"];
	errors: Record<string, { message?: string } | undefined>;
	doctors: Doctor[];
	patients?: Patient[];
	showPatient?: boolean;
	hideDoctor: boolean;
	selectedDate: string;
}) {
	const now = new Date();
	const today = now.toISOString().slice(0, 10);
	const minimumTime =
		selectedDate === today
			? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
			: undefined;
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{showPatient ? (
				<Field label="Patient" error={errors.patientId?.message}>
					<Select {...register("patientId")}>
						<option value="">Select patient…</option>
						{(patients ?? []).map((p) => (
							<option key={p.id} value={p.id}>
								{p.firstName} {p.lastName}
							</option>
						))}
					</Select>
				</Field>
			) : null}
			{!hideDoctor ? (
				<Field label="Doctor" error={errors.doctorId?.message}>
					<Select {...register("doctorId")}>
						<option value="">Select doctor…</option>
						{doctors.map((d) => (
							<option key={d.id} value={d.id}>
								{d.userName} — {d.specialization}
							</option>
						))}
					</Select>
				</Field>
			) : null}
			<Field
				label="Date"
				error={errors.appointmentDate?.message}
				className={hideDoctor ? "sm:col-span-2" : undefined}
			>
				<Input type="date" min={today} {...register("appointmentDate")} />
			</Field>
			<div className="grid grid-cols-2 gap-3 sm:col-span-2">
				<Field label="Start" error={errors.startTime?.message}>
					<Input type="time" min={minimumTime} {...register("startTime")} />
				</Field>
				<Field label="End" error={errors.endTime?.message}>
					<Input type="time" min={minimumTime} {...register("endTime")} />
				</Field>
			</div>
			<Field
				label="Reason"
				error={errors.reason?.message}
				className="sm:col-span-2"
			>
				<Input placeholder="e.g. Routine checkup" {...register("reason")} />
			</Field>
		</div>
	);
}

export function AppointmentFormModal({
	open,
	onClose,
	onCreated,
	patientId,
	prefill,
	hideDoctor,
	defaultDoctorId,
}: {
	open: boolean;
	onClose: () => void;
	onCreated: () => void;
	patientId?: string;
	prefill?: AppointmentPrefill;
	hideDoctor?: boolean;
	defaultDoctorId?: string;
}) {
	const queryClient = useQueryClient();
	const { data: patientsData } = useQuery({
		queryKey: ["patients", "options"],
		queryFn: () =>
			api.get<Paginated<Patient>>("/patients", { page: 1, pageSize: 100 }),
		enabled: open,
	});
	const { data: doctorsData } = useDoctorOptions(open);

	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<AppointmentFormValues>({
		resolver: zodResolver(appointmentSchema),
	});
	const selectedDate = watch("appointmentDate");

	useEffect(() => {
		if (open) {
			reset({
				patientId: patientId ?? "",
				doctorId: prefill?.doctorId ?? defaultDoctorId ?? "",
				appointmentDate: prefill?.appointmentDate ?? "",
				startTime: prefill?.startTime ?? "",
				endTime: prefill?.endTime ?? "",
				reason: "",
			});
		}
	}, [open, prefill, patientId, defaultDoctorId, reset]);

	const createMutation = useMutation({
		mutationFn: (values: AppointmentFormValues) =>
			api.post<Appointment>("/appointments", {
				patientId: patientId ?? values.patientId,
				doctorId: values.doctorId,
				startAt: toISODateTime(values.appointmentDate, values.startTime),
				endAt: toISODateTime(values.appointmentDate, values.endTime),
				reason: values.reason || undefined,
			}),
		onSuccess: () => {
			toast.success("Appointment scheduled");
			reset();
			onCreated();
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed to schedule"),
	});

	const selectedPatient = (patientsData?.items ?? []).find(
		(p) => p.id === patientId,
	);

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Schedule appointment"
			subtitle="Book a patient visit with a doctor"
			size="lg"
		>
			<form
				onSubmit={handleSubmit((v) => createMutation.mutate(v))}
				className="grid grid-cols-1 gap-4"
			>
				{patientId ? (
					<div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
						<p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
							Patient
						</p>
						<p className="mt-0.5 text-sm font-medium text-slate-900">
							{selectedPatient
								? `${selectedPatient.firstName} ${selectedPatient.lastName}`
								: "Loading…"}
						</p>
					</div>
				) : null}

				<AppointmentFields
					register={register}
					errors={errors}
					doctors={doctorsData?.items ?? []}
					patients={patientsData?.items}
					showPatient={!patientId}
					hideDoctor={hideDoctor ?? false}
					selectedDate={selectedDate}
				/>

				<div className="flex items-center justify-end gap-2 pt-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={createMutation.isPending}>
						<CalendarDays className="size-4" /> Schedule
					</Button>
				</div>
			</form>
		</Modal>
	);
}

export function RescheduleAppointmentModal({
	appt,
	onClose,
	onRescheduled,
}: {
	appt: Appointment | null;
	onClose: () => void;
	onRescheduled: () => void;
}) {
	const queryClient = useQueryClient();
	const { data: doctorsData } = useDoctorOptions(appt !== null);

	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<AppointmentFormValues>({
		resolver: zodResolver(appointmentSchema),
	});

	useEffect(() => {
		if (appt) {
			reset({
				doctorId: appt.doctorId,
				appointmentDate: appt.startAt.slice(0, 10),
				startTime: appt.startAt.slice(11, 16),
				endTime: appt.endAt.slice(11, 16),
				reason: appt.reason ?? "",
			});
		}
	}, [appt, reset]);

	const updateMutation = useMutation({
		mutationFn: (values: AppointmentFormValues) => {
			if (!appt) throw new Error("Missing appointment");
			return api.patch<Appointment>(`/appointments/${appt.id}`, {
				doctorId: values.doctorId,
				startAt: toISODateTime(values.appointmentDate, values.startTime),
				endAt: toISODateTime(values.appointmentDate, values.endTime),
				reason: values.reason || undefined,
			});
		},
		onSuccess: () => {
			toast.success("Appointment rescheduled");
			onRescheduled();
			queryClient.invalidateQueries({ queryKey: ["appointments"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Reschedule failed"),
	});

	const close = () => {
		reset();
		onClose();
	};

	return (
		<Modal
			open={appt !== null}
			onClose={close}
			title="Reschedule appointment"
			subtitle={
				appt
					? `${appt.patientName} · ${appt.startAt.slice(0, 10)} ${appt.startAt.slice(11, 16)}`
					: undefined
			}
			size="lg"
		>
			<form
				onSubmit={handleSubmit((v) => updateMutation.mutate(v))}
				className="grid grid-cols-1 gap-4"
			>
				<AppointmentFields
					register={register}
					errors={errors}
					doctors={doctorsData?.items ?? []}
					hideDoctor={false}
					selectedDate={watch("appointmentDate") ?? ""}
				/>
				<div className="flex items-center justify-end gap-2 pt-2">
					<Button type="button" variant="secondary" onClick={close}>
						Cancel
					</Button>
					<Button type="submit" loading={updateMutation.isPending}>
						<CalendarDays className="size-4" /> Reschedule
					</Button>
				</div>
			</form>
		</Modal>
	);
}
