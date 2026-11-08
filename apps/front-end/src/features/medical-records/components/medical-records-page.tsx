import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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
import { hasPermission } from "@/lib/auth";
import type {
	Doctor,
	MedicalRecord,
	Paginated,
	Patient,
	Procedure,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const LIMIT = 10;

const recordSchema = z.object({
	patientId: z.string().uuid("Select a patient"),
	doctorId: z.string().uuid("Select a doctor").optional(),
	appointmentId: z.string().uuid().optional(),
	chiefComplaint: z.string().trim().max(5000).optional(),
	diagnosis: z.string().trim().min(1, "Diagnosis is required").max(5000),
	treatment: z.string().trim().max(5000).optional(),
	notes: z.string().trim().max(5000).optional(),
});

type RecordFormValues = z.infer<typeof recordSchema>;

const editSchema = z.object({
	doctorId: z.string().uuid("Select a doctor").optional(),
	chiefComplaint: z.string().trim().max(5000).optional(),
	diagnosis: z.string().trim().min(1, "Diagnosis is required").max(5000),
	treatment: z.string().trim().max(5000).optional(),
	notes: z.string().trim().max(5000).optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

const procedureSchema = z.object({
	procedureId: z.string().uuid("Select a procedure"),
	toothNumber: z.string().trim().max(10).optional(),
	quadrant: z.string().trim().max(10).optional(),
	notes: z.string().trim().max(2000).optional(),
});

type ProcedureFormValues = z.infer<typeof procedureSchema>;

export function MedicalRecordsPage() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [createOpen, setCreateOpen] = useState(false);
	const [viewing, setViewing] = useState<MedicalRecord | null>(null);
	const [attachTarget, setAttachTarget] = useState<MedicalRecord | null>(null);
	const [editing, setEditing] = useState<MedicalRecord | null>(null);

	const { data, isLoading, error } = useQuery({
		queryKey: ["medical-records", page],
		queryFn: () =>
			api.get<Paginated<MedicalRecord>>("/medical-records", {
				page,
				pageSize: LIMIT,
			}),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["medical-records"] });

	const records = data?.items ?? [];
	const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

	const { sorted, key, dir, toggle } = useSort(records, "createdAt");

	const canCreate = hasPermission("medical_records.create");
	const canEdit = hasPermission("medical_records.create");

	return (
		<div className="space-y-5">
			<PageHeader
				title="Medical Records"
				subtitle="Clinical notes, diagnoses and treatment plans"
				actions={
					canCreate ? (
						<Button onClick={() => setCreateOpen(true)}>
							<Plus className="size-4" /> New record
						</Button>
					) : undefined
				}
			/>

			<Card>
				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error ? error.message : "Failed to load records"
						}
					/>
				) : null}

				{!isLoading && !error && records.length === 0 ? (
					<EmptyState
						title="No medical records yet"
						description="Records are written by doctors after a patient visit."
						action={
							canCreate ? (
								<Button onClick={() => setCreateOpen(true)}>
									<Plus className="size-4" /> New record
								</Button>
							) : undefined
						}
					/>
				) : null}

				{!isLoading && !error && records.length > 0 ? (
					<>
						<Table>
							<TableHead>
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
									field="chiefComplaint"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Chief Complaint
								</SortableTh>
								<SortableTh
									field="diagnosis"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Diagnosis
								</SortableTh>
								<SortableTh
									field="treatment"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Treatment
								</SortableTh>
								<SortableTh
									field="createdAt"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Created
								</SortableTh>
								<Th className="text-right">Actions</Th>
							</TableHead>
							<TableBody>
								{sorted.map((record) => (
									<TableRow key={record.id}>
										<Td className="font-medium text-slate-900">
											{record.patientName}
										</Td>
										<Td className="text-slate-600">
											{record.doctorName ?? "—"}
										</Td>
										<Td
											className="max-w-52 truncate text-slate-600"
											title={record.chiefComplaint ?? ""}
										>
											{record.chiefComplaint ?? "—"}
										</Td>
										<Td
											className="max-w-52 truncate text-slate-600"
											title={record.diagnosis ?? ""}
										>
											{record.diagnosis ?? "—"}
										</Td>
										<Td
											className="max-w-40 truncate text-slate-500"
											title={record.treatment ?? ""}
										>
											{record.treatment ?? "—"}
										</Td>
										<Td className="whitespace-nowrap text-slate-500">
											{formatDateTime(record.createdAt)}
										</Td>
										<Td className="text-right">
											<div className="inline-flex items-center gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setViewing(record)}
													aria-label="View record"
												>
													<Eye className="size-4" />
												</Button>
												{canEdit ? (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setEditing(record)}
														aria-label="Edit record"
													>
														<Pencil className="size-4" />
													</Button>
												) : null}
												{canEdit ? (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setAttachTarget(record)}
														aria-label="Attach procedure"
													>
														<Stethoscope className="size-4" />
													</Button>
												) : null}
											</div>
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

			<CreateRecordModal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onCreated={() => {
					setCreateOpen(false);
					invalidate();
				}}
			/>

			<ViewRecordModal record={viewing} onClose={() => setViewing(null)} />

			<EditRecordModal
				record={editing}
				onClose={() => setEditing(null)}
				onUpdated={() => {
					setEditing(null);
					invalidate();
				}}
			/>

			<AttachProcedureModal
				record={attachTarget}
				onClose={() => setAttachTarget(null)}
				onAttached={() => {
					setAttachTarget(null);
					invalidate();
				}}
			/>
		</div>
	);
}

function CreateRecordModal({
	open,
	onClose,
	onCreated,
}: {
	open: boolean;
	onClose: () => void;
	onCreated: () => void;
}) {
	const { data: patientsData } = useQuery({
		queryKey: ["patients", "options"],
		queryFn: () =>
			api.get<Paginated<Patient>>("/patients", { page: 1, pageSize: 100 }),
		enabled: open,
	});
	const { data: doctorsData } = useQuery({
		queryKey: ["doctors", "options"],
		queryFn: () =>
			api.get<Paginated<Doctor>>("/doctors", { page: 1, pageSize: 100 }),
		enabled: open,
	});

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<RecordFormValues>({ resolver: zodResolver(recordSchema) });

	const createMutation = useMutation({
		mutationFn: (values: RecordFormValues) =>
			api.post<MedicalRecord>("/medical-records", {
				...values,
				doctorId: values.doctorId || undefined,
				appointmentId: values.appointmentId || undefined,
				chiefComplaint: values.chiefComplaint || undefined,
				treatment: values.treatment || undefined,
				notes: values.notes || undefined,
			}),
		onSuccess: () => {
			toast.success("Medical record created");
			reset();
			onCreated();
		},
		onError: (err) =>
			toast.error(
				err instanceof Error ? err.message : "Failed to create record",
			),
	});

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="New medical record"
			subtitle="Clinical notes for a patient visit"
			size="lg"
		>
			<form
				onSubmit={handleSubmit((v) => createMutation.mutate(v))}
				className="grid grid-cols-1 gap-4 sm:grid-cols-2"
			>
				<Field label="Patient" error={errors.patientId?.message}>
					<Select {...register("patientId")}>
						<option value="">Select patient…</option>
						{(patientsData?.items ?? []).map((p) => (
							<option key={p.id} value={p.id}>
								{p.firstName} {p.lastName}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Doctor" error={errors.doctorId?.message}>
					<Select {...register("doctorId")}>
						<option value="">Select doctor…</option>
						{(doctorsData?.items ?? []).map((d) => (
							<option key={d.id} value={d.id}>
								{d.userName}
							</option>
						))}
					</Select>
				</Field>
				<Field
					label="Diagnosis"
					error={errors.diagnosis?.message}
					className="sm:col-span-2"
				>
					<Textarea
						placeholder="Primary diagnosis and clinical findings…"
						{...register("diagnosis")}
					/>
				</Field>
				<Field
					label="Chief complaint"
					error={errors.chiefComplaint?.message}
					className="sm:col-span-2"
				>
					<Textarea
						placeholder="Patient's primary complaint…"
						{...register("chiefComplaint")}
					/>
				</Field>
				<Field
					label="Treatment"
					error={errors.treatment?.message}
					className="sm:col-span-2"
				>
					<Textarea
						placeholder="Treatment provided or planned…"
						{...register("treatment")}
					/>
				</Field>
				<Field
					label="Notes"
					error={errors.notes?.message}
					className="sm:col-span-2"
				>
					<Textarea
						placeholder="Additional clinical notes…"
						{...register("notes")}
					/>
				</Field>
				<div className="flex items-center justify-end gap-2 pt-2 sm:col-span-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={createMutation.isPending}>
						{null} Save record
					</Button>
				</div>
			</form>
		</Modal>
	);
}

function ViewRecordModal({
	record,
	onClose,
}: {
	record: MedicalRecord | null;
	onClose: () => void;
}) {
	return (
		<Modal
			open={record !== null}
			onClose={onClose}
			title="Medical record"
			subtitle={
				record
					? `${record.patientName}${record.doctorName ? ` · ${record.doctorName}` : ""}`
					: undefined
			}
			size="lg"
		>
			{record ? (
				<div className="space-y-4">
					<Section label="Diagnosis" value={record.diagnosis} />
					<Section label="Chief complaint" value={record.chiefComplaint} />
					<Section label="Treatment" value={record.treatment} />
					<Section label="Notes" value={record.notes} />
				</div>
			) : null}
		</Modal>
	);
}

function Section({ label, value }: { label: string; value: string | null }) {
	return (
		<div>
			<p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
				{label}
			</p>
			<p className="mt-1 text-sm whitespace-pre-wrap text-slate-800">
				{value && value.length > 0 ? value : "—"}
			</p>
		</div>
	);
}

function EditRecordModal({
	record,
	onClose,
	onUpdated,
}: {
	record: MedicalRecord | null;
	onClose: () => void;
	onUpdated: () => void;
}) {
	const { data: doctorsData } = useQuery({
		queryKey: ["doctors", "options"],
		queryFn: () =>
			api.get<Paginated<Doctor>>("/doctors", { page: 1, pageSize: 100 }),
		enabled: record !== null,
	});

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

	useEffect(() => {
		if (record) {
			reset({
				doctorId: record.doctorId ?? undefined,
				diagnosis: record.diagnosis ?? "",
				chiefComplaint: record.chiefComplaint ?? "",
				treatment: record.treatment ?? "",
				notes: record.notes ?? "",
			});
		}
	}, [record, reset]);

	const updateMutation = useMutation({
		mutationFn: (values: EditFormValues) => {
			if (!record) throw new Error("Missing record");
			return api.patch<MedicalRecord>(`/medical-records/${record.id}`, {
				...values,
				doctorId: values.doctorId || undefined,
				chiefComplaint: values.chiefComplaint || undefined,
				treatment: values.treatment || undefined,
				notes: values.notes || undefined,
			});
		},
		onSuccess: () => {
			toast.success("Medical record updated");
			onUpdated();
		},
		onError: (err) =>
			toast.error(
				err instanceof Error ? err.message : "Failed to update record",
			),
	});

	const close = () => {
		reset();
		onClose();
	};

	return (
		<Modal
			open={record !== null}
			onClose={close}
			title="Edit medical record"
			subtitle={
				record
					? `${record.patientName}${record.doctorName ? ` · ${record.doctorName}` : ""}`
					: undefined
			}
			size="lg"
		>
			<form
				onSubmit={handleSubmit((v) => updateMutation.mutate(v))}
				className="space-y-4"
			>
				<Field label="Doctor" error={errors.doctorId?.message}>
					<Select {...register("doctorId")}>
						<option value="">Select doctor…</option>
						{(doctorsData?.items ?? []).map((d) => (
							<option key={d.id} value={d.id}>
								{d.userName}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Diagnosis" error={errors.diagnosis?.message}>
					<Textarea
						placeholder="Primary diagnosis and clinical findings…"
						{...register("diagnosis")}
					/>
				</Field>
				<Field label="Chief complaint" error={errors.chiefComplaint?.message}>
					<Textarea
						placeholder="Patient's primary complaint…"
						{...register("chiefComplaint")}
					/>
				</Field>
				<Field label="Treatment" error={errors.treatment?.message}>
					<Textarea
						placeholder="Treatment provided or planned…"
						{...register("treatment")}
					/>
				</Field>
				<Field label="Notes" error={errors.notes?.message}>
					<Textarea
						placeholder="Additional clinical notes…"
						{...register("notes")}
					/>
				</Field>
				<div className="flex items-center justify-end gap-2">
					<Button type="button" variant="secondary" onClick={close}>
						Cancel
					</Button>
					<Button type="submit" loading={updateMutation.isPending}>
						Save changes
					</Button>
				</div>
			</form>
		</Modal>
	);
}

function AttachProcedureModal({
	record,
	onClose,
	onAttached,
}: {
	record: MedicalRecord | null;
	onClose: () => void;
	onAttached: () => void;
}) {
	const { data: proceduresData } = useQuery({
		queryKey: ["procedures", "options"],
		queryFn: () =>
			api.get<Paginated<Procedure>>("/procedures", { page: 1, pageSize: 100 }),
		enabled: record !== null,
	});

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ProcedureFormValues>({ resolver: zodResolver(procedureSchema) });

	const attachMutation = useMutation({
		mutationFn: (values: ProcedureFormValues) => {
			if (!record) throw new Error("Missing record");
			return api.post<{ id: string }>(
				`/medical-records/${record.id}/procedures`,
				{
					...values,
					toothNumber: values.toothNumber || undefined,
					quadrant: values.quadrant || undefined,
					notes: values.notes || undefined,
				},
			);
		},
		onSuccess: () => {
			toast.success("Procedure attached");
			reset();
			onAttached();
		},
		onError: (err) =>
			toast.error(
				err instanceof Error ? err.message : "Failed to attach procedure",
			),
	});

	const close = () => {
		reset();
		onClose();
	};

	return (
		<Modal
			open={record !== null}
			onClose={close}
			title="Attach procedure"
			subtitle={record ? `For record of ${record.patientName}` : undefined}
		>
			<form
				onSubmit={handleSubmit((v) => attachMutation.mutate(v))}
				className="space-y-4"
			>
				<Field label="Procedure" error={errors.procedureId?.message}>
					<Select {...register("procedureId")}>
						<option value="">Select procedure…</option>
						{(proceduresData?.items ?? []).map((proc) => (
							<option key={proc.id} value={proc.id}>
								{proc.name}
							</option>
						))}
					</Select>
				</Field>
				<div className="grid grid-cols-2 gap-4">
					<Field label="Tooth number" error={errors.toothNumber?.message}>
						<Input placeholder="e.g. 14" {...register("toothNumber")} />
					</Field>
					<Field label="Quadrant" error={errors.quadrant?.message}>
						<Input placeholder="e.g. UL" {...register("quadrant")} />
					</Field>
				</div>
				<Field label="Notes" error={errors.notes?.message}>
					<Textarea placeholder="Additional notes…" {...register("notes")} />
				</Field>
				<div className="flex items-center justify-end gap-2">
					<Button type="button" variant="secondary" onClick={close}>
						Cancel
					</Button>
					<Button type="submit" loading={attachMutation.isPending}>
						Attach procedure
					</Button>
				</div>
			</form>
		</Modal>
	);
}
