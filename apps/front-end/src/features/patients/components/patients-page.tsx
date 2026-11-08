import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Pencil, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { hasPermission } from "@/lib/auth";
import type { Paginated, Patient } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils";

const patientSchema = z.object({
	patientNumber: z.string().trim().min(1, "Patient number is required").max(40),
	firstName: z.string().trim().min(1, "First name is required").max(100),
	lastName: z.string().trim().min(1, "Last name is required").max(100),
	dateOfBirth: z.string().min(1, "Date of birth is required"),
	gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]),
	phone: z.string().trim().min(1, "Contact number is required").max(20),
	email: z.string().email("Invalid email").or(z.literal("")).optional(),
	address: z.string().trim().max(500).optional(),
	emergencyContactName: z.string().trim().max(100).optional(),
	emergencyContactPhone: z.string().trim().max(20).optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

const LIMIT = 10;

export function PatientsPage() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { search: urlSearch = "" } = useSearch({
		from: "/_authenticated/patients",
	});
	const [page, setPage] = useState(1);
	const [searchInput, setSearchInput] = useState(urlSearch);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Patient | null>(null);
	const canCreate = hasPermission("patients.create");
	const canEdit = hasPermission("patients.update");

	useEffect(() => {
		// oxlint-disable-next-line react/set-state-in-effect
		setSearchInput(urlSearch);
		// oxlint-disable-next-line react/set-state-in-effect
		setPage(1);
	}, [urlSearch]);

	const applySearch = (term: string) => {
		navigate({
			to: "/patients",
			search: { search: term || undefined },
			replace: true,
		});
	};

	const dataQuery = useQuery({
		queryKey: ["patients", page, urlSearch],
		queryFn: () =>
			api.get<Paginated<Patient>>("/patients", {
				page,
				pageSize: LIMIT,
				search: urlSearch || undefined,
			}),
	});

	const data = dataQuery.data;
	const isLoading = dataQuery.isLoading;
	const error = dataQuery.error;

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["patients"] });

	const saveMutation = useMutation({
		mutationFn: (values: PatientFormValues) => {
			const payload = {
				patientNumber: values.patientNumber,
				firstName: values.firstName,
				lastName: values.lastName,
				dateOfBirth: values.dateOfBirth,
				gender: values.gender,
				phone: values.phone,
				email: values.email || null,
				address: values.address || null,
				emergencyContactName: values.emergencyContactName || null,
				emergencyContactPhone: values.emergencyContactPhone || null,
			};
			return editing
				? api.patch<Patient>(`/patients/${editing.id}`, payload)
				: api.post<Patient>("/patients", payload);
		},
		onSuccess: () => {
			toast.success(editing ? "Patient updated" : "Patient created");
			setModalOpen(false);
			setEditing(null);
			invalidate();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Save failed"),
	});

	const patients = data?.items ?? [];
	const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

	const { sorted, key, dir, toggle } = useSort(patients, "lastName");

	return (
		<div className="space-y-5">
			<PageHeader
				title="Patients"
				subtitle="Registered patient records"
				actions={
					canCreate ? (
						<Button
							onClick={() => {
								setEditing(null);
								setModalOpen(true);
							}}
						>
							<Plus className="size-4" /> New patient
						</Button>
					) : null
				}
			/>

			<Card>
				<div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
					<div className="relative w-full max-w-sm">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
						<input
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									applySearch(searchInput.trim());
								}
							}}
							placeholder="Search by name, email or phone…"
							className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
						/>
					</div>
				</div>

				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error ? error.message : "Failed to load patients"
						}
					/>
				) : null}

				{!isLoading && !error && patients.length === 0 ? (
					<EmptyState
						title="No patients found"
						description="Add a patient to start scheduling appointments."
						action={
							canCreate ? (
								<Button
									onClick={() => {
										setEditing(null);
										setModalOpen(true);
									}}
								>
									<Plus className="size-4" /> New patient
								</Button>
							) : null
						}
					/>
				) : null}

				{!isLoading && !error && patients.length > 0 ? (
					<>
						<Table>
							<TableHead>
								<SortableTh
									field="lastName"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Name
								</SortableTh>
								<SortableTh
									field="dateOfBirth"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Date of birth
								</SortableTh>
								<SortableTh
									field="gender"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Gender
								</SortableTh>
								<SortableTh
									field="phone"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Contact
								</SortableTh>
								<SortableTh
									field="createdAt"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Registered
								</SortableTh>
								<Th className="text-right">Actions</Th>
							</TableHead>
							<TableBody>
								{sorted.map((patient) => (
									<TableRow key={patient.id}>
										<Td>
											<p className="font-medium text-slate-900">
												{patient.firstName} {patient.lastName}
											</p>
											{patient.membershipTier ? (
												<Badge tone="accent" className="mt-1">
													{titleCase(patient.membershipTier)} member
												</Badge>
											) : null}
											{patient.email ? (
												<p className="text-xs text-slate-500">
													{patient.email}
												</p>
											) : null}
										</Td>
										<Td className="text-slate-600">
											{formatDate(patient.dateOfBirth)}
										</Td>
										<Td className="text-slate-600">
											{titleCase(patient.gender)}
										</Td>
										<Td className="text-slate-600">{patient.phone}</Td>
										<Td className="text-slate-600">
											{formatDate(patient.createdAt)}
										</Td>
										<Td className="text-right">
											<div className="inline-flex items-center gap-1">
												{canEdit ? (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => {
															setEditing(patient);
															setModalOpen(true);
														}}
														aria-label={`Edit ${patient.firstName}`}
													>
														<Pencil className="size-4" />
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

			<PatientFormModal
				open={modalOpen}
				patient={editing}
				onClose={() => {
					setModalOpen(false);
					setEditing(null);
				}}
				onSubmit={(values) => saveMutation.mutate(values)}
				submitting={saveMutation.isPending}
			/>
		</div>
	);
}

function PatientFormModal({
	open,
	patient,
	onClose,
	onSubmit,
	submitting,
}: {
	open: boolean;
	patient: Patient | null;
	onClose: () => void;
	onSubmit: (values: PatientFormValues) => void;
	submitting: boolean;
}) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<PatientFormValues>({
		resolver: zodResolver(patientSchema),
		defaultValues: patient
			? {
					patientNumber: patient.patientNumber,
					firstName: patient.firstName,
					lastName: patient.lastName,
					dateOfBirth: patient.dateOfBirth ?? "",
					gender:
						(patient.gender as PatientFormValues["gender"]) ?? "UNDISCLOSED",
					phone: patient.phone ?? "",
					email: patient.email ?? "",
					address: patient.address ?? "",
					emergencyContactName: patient.emergencyContactName ?? "",
					emergencyContactPhone: patient.emergencyContactPhone ?? "",
				}
			: undefined,
	});

	const close = () => {
		reset();
		onClose();
	};

	return (
		<Modal
			open={open}
			onClose={close}
			title={patient ? "Edit patient" : "New patient"}
			subtitle={
				patient
					? `${patient.firstName} ${patient.lastName}`
					: "Register a new patient record"
			}
			size="lg"
		>
			<form
				onSubmit={handleSubmit(onSubmit)}
				className="grid grid-cols-1 gap-4 sm:grid-cols-2"
			>
				<Field
					label="Patient number"
					error={errors.patientNumber?.message}
					className="sm:col-span-2"
				>
					<Input placeholder="PT-0001" {...register("patientNumber")} />
				</Field>
				<Field label="First name" error={errors.firstName?.message}>
					<Input placeholder="Jane" {...register("firstName")} />
				</Field>
				<Field label="Last name" error={errors.lastName?.message}>
					<Input placeholder="Doe" {...register("lastName")} />
				</Field>
				<Field label="Date of birth" error={errors.dateOfBirth?.message}>
					<Input type="date" {...register("dateOfBirth")} />
				</Field>
				<Field label="Gender" error={errors.gender?.message}>
					<Select {...register("gender")}>
						<option value="MALE">Male</option>
						<option value="FEMALE">Female</option>
						<option value="OTHER">Other</option>
						<option value="UNDISCLOSED">Undisclosed</option>
					</Select>
				</Field>
				<Field label="Phone" error={errors.phone?.message}>
					<Input placeholder="+1-555-0100" {...register("phone")} />
				</Field>
				<Field label="Email" error={errors.email?.message}>
					<Input
						type="email"
						placeholder="jane@example.com"
						{...register("email")}
					/>
				</Field>
				<Field
					label="Address"
					error={errors.address?.message}
					className="sm:col-span-2"
				>
					<Input placeholder="123 Main St" {...register("address")} />
				</Field>
				<Field
					label="Emergency contact name"
					error={errors.emergencyContactName?.message}
				>
					<Input placeholder="Alex Doe" {...register("emergencyContactName")} />
				</Field>
				<Field
					label="Emergency contact phone"
					error={errors.emergencyContactPhone?.message}
				>
					<Input
						placeholder="+1-555-0199"
						{...register("emergencyContactPhone")}
					/>
				</Field>
				<div className="flex items-center justify-end gap-2 pt-2 sm:col-span-2">
					<Button type="button" variant="secondary" onClick={close}>
						Cancel
					</Button>
					<Button type="submit" loading={submitting}>
						{patient ? "Save changes" : "Create patient"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
