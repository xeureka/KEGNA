import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Plus, UserCog } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { hasPermission, useSession } from "@/lib/auth";
import type { Member, MembershipStatus, RoleName } from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/utils";
import {
	userKeys,
	usersListQueryOptions,
} from "@/features/staff/api/user-query-options";

const PAGE_SIZE = 10;

const CREATE_ROLES: RoleName[] = ["DOCTOR", "RECEPTIONIST"];

const userSchema = z
	.object({
		name: z.string().trim().min(1, "Name is required").max(255),
		email: z.string().trim().toLowerCase().email("Enter a valid email"),
		password: z
			.string()
			.min(8, "At least 8 characters")
			.regex(/[A-Za-z]/, "Must contain a letter")
			.regex(/\d/, "Must contain a number"),
		role: z.enum(["OWNER", "DOCTOR", "RECEPTIONIST", "ACCOUNTANT"]),
		specialization: z
			.string()
			.trim()
			.min(1, "Specialization is required")
			.max(150)
			.optional(),
		licenseNumber: z.string().trim().max(100).optional(),
	})
	.refine((v) => v.role !== "DOCTOR" || v.specialization, {
		message: "Specialization is required for a doctor account",
		path: ["specialization"],
	});

type UserFormValues = z.infer<typeof userSchema>;

function statusTone(status: MembershipStatus) {
	switch (status) {
		case "ACTIVE":
			return "success" as const;
		case "SUSPENDED":
			return "danger" as const;
		default:
			return "neutral" as const;
	}
}

function statusLabel(status: MembershipStatus) {
	switch (status) {
		case "ACTIVE":
			return "Active";
		case "SUSPENDED":
			return "Suspended";
		case "INVITED":
			return "Invited";
		case "INACTIVE":
			return "Inactive";
	}
}

export function UsersPage() {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const canManage = hasPermission("members.manage");
	const [page, setPage] = useState(1);
	const [roleFilter, setRoleFilter] = useState("");
	const [createOpen, setCreateOpen] = useState(false);

	const dataQuery = useQuery(usersListQueryOptions());

	const data = dataQuery.data;
	const isLoading = dataQuery.isLoading;
	const error = dataQuery.error;

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: userKeys.all });

	const changeRole = useMutation({
		mutationFn: ({ id, roleName }: { id: string; roleName: RoleName }) =>
			api.patch<Member>(`/members/${id}/role`, { roleName }),
		onSuccess: () => {
			toast.success("Role updated");
			invalidate();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Role update failed"),
	});

	const setStatus = useMutation({
		mutationFn: ({ id, status }: { id: string; status: MembershipStatus }) =>
			api.patch<Member>(`/members/${id}/status`, { status }),
		onSuccess: () => {
			toast.success("Membership status updated");
			invalidate();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Status update failed"),
	});

	const members = data ?? [];
	const filtered = roleFilter
		? members.filter((m) => m.roleName === roleFilter)
		: members;
	const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
	const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	const { sorted, key, dir, toggle } = useSort(pageRows, "userName");

	return (
		<div className="space-y-5">
			<PageHeader
				title="Users"
				subtitle="Staff accounts and access roles"
				actions={
					canManage ? (
						<Button onClick={() => setCreateOpen(true)}>
							<Plus className="size-4" /> New user
						</Button>
					) : null
				}
			/>

			<Card>
				<div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
					<label
						htmlFor="role-filter"
						className="text-sm font-medium text-slate-600"
					>
						Role
					</label>
					<Select
						id="role-filter"
						value={roleFilter}
						onChange={(e) => {
							setPage(1);
							setRoleFilter(e.target.value);
						}}
						className="w-44"
					>
						<option value="">All roles</option>
						{CREATE_ROLES.map((role) => (
							<option key={role} value={role}>
								{titleCase(role)}
							</option>
						))}
					</Select>
				</div>

				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error ? error.message : "Failed to load users"
						}
					/>
				) : null}

				{!isLoading && !error && filtered.length === 0 ? (
					<EmptyState
						title="No users found"
						description="Provision staff accounts to grant access to the system."
						action={
							canManage ? (
								<Button onClick={() => setCreateOpen(true)}>
									<Plus className="size-4" /> New user
								</Button>
							) : null
						}
					/>
				) : null}

				{!isLoading && !error && filtered.length > 0 ? (
					<>
						<Table>
							<TableHead>
								<SortableTh
									field="userName"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Name
								</SortableTh>
								<SortableTh
									field="roleName"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Role
								</SortableTh>
								<SortableTh
									field="status"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Status
								</SortableTh>
								<SortableTh
									field="joinedAt"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Joined
								</SortableTh>
								<Th className="text-right">Actions</Th>
							</TableHead>
							<TableBody>
								{sorted.map((user) => (
									<TableRow key={user.id}>
										<Td>
											<p className="font-medium text-slate-900">
												{user.userName}
											</p>
											<p className="text-xs text-slate-500">{user.userEmail}</p>
										</Td>
										<Td>
											<div className="flex items-center gap-2">
												<Badge
													tone={
														user.roleName === "OWNER" ? "accent" : "neutral"
													}
												>
													{titleCase(user.roleName)}
												</Badge>
											</div>
										</Td>
										<Td>
											<Badge tone={statusTone(user.status)}>
												{statusLabel(user.status)}
											</Badge>
										</Td>
										<Td className="whitespace-nowrap text-slate-500">
											{formatDateTime(user.joinedAt)}
										</Td>
										<Td className="text-right">
											<div className="inline-flex items-center gap-1">
												{canManage ? (
													<>
														<Select
															value={user.roleName}
															disabled={user.roleName === "OWNER"}
															onChange={(e) =>
																changeRole.mutate({
																	id: user.id,
																	roleName: e.target.value as RoleName,
																})
															}
															className="w-36 py-1.5 text-xs"
															aria-label={`Change role for ${user.userName}`}
														>
															{CREATE_ROLES.map((role) => (
																<option key={role} value={role}>
																	{titleCase(role)}
																</option>
															))}
														</Select>
														{user.roleName === "OWNER" &&
														user.userId === session?.user.id ? (
															<span className="text-xs text-slate-400">
																You
															</span>
														) : (
															<>
																{user.status === "ACTIVE" ? (
																	<Button
																		variant="ghost"
																		size="sm"
																		title="Suspend"
																		disabled={user.roleName === "OWNER"}
																		onClick={() =>
																			setStatus.mutate({
																				id: user.id,
																				status: "SUSPENDED",
																			})
																		}
																	>
																		<Ban className="size-4" />
																	</Button>
																) : (
																	<Button
																		variant="ghost"
																		size="sm"
																		title="Activate"
																		disabled={user.roleName === "OWNER"}
																		className="hover:bg-emerald-50 hover:text-emerald-600"
																		onClick={() =>
																			setStatus.mutate({
																				id: user.id,
																				status: "ACTIVE",
																			})
																		}
																	>
																		<CheckCircle2 className="size-4" />
																	</Button>
																)}
															</>
														)}
													</>
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

			<CreateUserModal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onCreated={() => {
					setCreateOpen(false);
					invalidate();
				}}
			/>
		</div>
	);
}

export function CreateUserModal({
	open,
	onClose,
	onCreated,
}: {
	open: boolean;
	onClose: () => void;
	onCreated: () => void;
}) {
	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<UserFormValues>({
		resolver: zodResolver(userSchema),
		defaultValues: { role: "RECEPTIONIST", password: "ChangeMe123!" },
	});

	// React Hook Form's watch API is intentionally used here for live role-dependent fields.
	// oxlint-disable-next-line react/incompatible-library
	const role = watch("role");

	const createMutation = useMutation({
		mutationFn: (values: UserFormValues) =>
			api.post<Member>("/members", {
				name: values.name,
				email: values.email,
				password: values.password,
				roleName: values.role,
				specialization: values.specialization || undefined,
				licenseNumber: values.licenseNumber || undefined,
			}),
		onSuccess: () => {
			toast.success("User created");
			reset({ role: "RECEPTIONIST", password: "ChangeMe123!" });
			onCreated();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed to create user"),
	});

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Create user"
			subtitle="Provision a new staff account"
			size="lg"
		>
			<form
				onSubmit={handleSubmit((v) => createMutation.mutate(v))}
				className="grid grid-cols-1 gap-4 sm:grid-cols-2"
			>
				<Field label="Full name" error={errors.name?.message}>
					<Input placeholder="Jane Doe" {...register("name")} />
				</Field>
				<Field label="Email" error={errors.email?.message}>
					<Input
						type="email"
						placeholder="jane@clinic.local"
						{...register("email")}
					/>
				</Field>
				<Field
					label="Temporary password"
					error={errors.password?.message}
					hint="Default: ChangeMe123! — give the user a private password after first login."
					className="sm:col-span-2"
				>
					<Input
						type="password"
						placeholder="••••••••"
						{...register("password")}
					/>
				</Field>
				<Field label="Role" error={errors.role?.message}>
					<Select {...register("role")}>
						{CREATE_ROLES.map((r) => (
							<option key={r} value={r}>
								{titleCase(r)}
							</option>
						))}
					</Select>
				</Field>

				{role === "DOCTOR" ? (
					<>
						<div className="border-t border-slate-200 pt-1 sm:col-span-2">
							<p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
								<UserCog className="size-4" /> Doctor profile
							</p>
						</div>
						<Field
							label="Specialization"
							error={errors.specialization?.message}
						>
							<Input placeholder="Cardiology" {...register("specialization")} />
						</Field>
						<Field label="License number" error={errors.licenseNumber?.message}>
							<Input
								placeholder="MED-LIC-2026-0001"
								{...register("licenseNumber")}
							/>
						</Field>
					</>
				) : null}

				<div className="flex items-center justify-end gap-2 pt-2 sm:col-span-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={createMutation.isPending}>
						<Plus className="size-4" /> Create user
					</Button>
				</div>
			</form>
		</Modal>
	);
}
