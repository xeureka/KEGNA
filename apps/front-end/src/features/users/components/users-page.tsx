import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Ban,
	CheckCircle2,
	KeyRound,
	Plus,
	UserCog,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { useSession } from "@/lib/auth";
import { ROLE_TONE } from "@/lib/status";
import type { RoleName, User } from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/utils";

const ROLES: RoleName[] = ["admin", "storekeeper", "sales", "accountant"];

const createSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(200),
	email: z.string().trim().toLowerCase().email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
	role: z.enum(["admin", "storekeeper", "sales", "accountant"]),
});
type CreateValues = z.infer<typeof createSchema>;

const passwordSchema = z.object({
	password: z.string().min(8, "At least 8 characters"),
});
type PasswordValues = z.infer<typeof passwordSchema>;

export function UsersPage() {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const [roleFilter, setRoleFilter] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [resetTarget, setResetTarget] = useState<User | null>(null);

	const usersQuery = useQuery({
		queryKey: ["users"],
		queryFn: () => api.get<User[]>("/users"),
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ["users"] });
		void queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
	};

	const roleMutation = useMutation({
		mutationFn: ({ id, role }: { id: string; role: RoleName }) =>
			api.patch<User>(`/users/${id}/role`, { role }),
		onSuccess: () => {
			toast.success("Role updated");
			invalidate();
		},
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Role update failed"),
	});

	const activeMutation = useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			api.post<User>(`/users/${id}/${active ? "activate" : "deactivate"}`),
		onSuccess: (_data, variables) => {
			toast.success(variables.active ? "User activated" : "User deactivated");
			invalidate();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Status update failed",
			),
	});

	const users = usersQuery.data ?? [];
	const filtered = roleFilter
		? users.filter((user) => user.role === roleFilter)
		: users;
	const { sorted, key, dir, toggle } = useSort(filtered, "name");

	return (
		<div className="space-y-5">
			<PageHeader
				title="Users"
				subtitle="Administrators, storekeepers, salespeople and accountants"
				actions={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className="size-4" /> New user
					</Button>
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
						onChange={(event) => setRoleFilter(event.target.value)}
						className="w-44"
					>
						<option value="">All roles</option>
						{ROLES.map((role) => (
							<option key={role} value={role}>
								{titleCase(role)}
							</option>
						))}
					</Select>
				</div>

				{usersQuery.isLoading ? <Spinner /> : null}
				{usersQuery.error ? (
					<InlineError
						message={
							usersQuery.error instanceof Error
								? usersQuery.error.message
								: "Failed to load users"
						}
					/>
				) : null}

				{!usersQuery.isLoading && !usersQuery.error && filtered.length === 0 ? (
					<EmptyState
						title="No users found"
						description="Create accounts for the warehouse team and assign roles."
						action={
							<Button onClick={() => setCreateOpen(true)}>
								<Plus className="size-4" /> New user
							</Button>
						}
					/>
				) : null}

				{!usersQuery.isLoading && !usersQuery.error && filtered.length > 0 ? (
					<Table>
						<TableHead>
							<SortableTh field="name" sortKey={key} sortDir={dir} onSort={toggle}>
								Name
							</SortableTh>
							<SortableTh field="role" sortKey={key} sortDir={dir} onSort={toggle}>
								Role
							</SortableTh>
							<SortableTh
								field="banned"
								sortKey={key}
								sortDir={dir}
								onSort={toggle}
							>
								Status
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
							{sorted.map((user) => {
								const isSelf = user.id === session?.user.id;
								return (
									<TableRow key={user.id}>
										<Td>
											<p className="font-medium text-slate-900">
												{user.name}
												{isSelf ? (
													<span className="ml-2 text-xs font-normal text-slate-400">
														You
													</span>
												) : null}
											</p>
											<p className="text-xs text-slate-500">{user.email}</p>
										</Td>
										<Td>
											<div className="flex items-center gap-2">
												<Badge tone={ROLE_TONE[user.role] ?? "neutral"}>
													{titleCase(user.role)}
												</Badge>
												<Select
													value={user.role}
													disabled={isSelf || roleMutation.isPending}
													onChange={(event) =>
														roleMutation.mutate({
															id: user.id,
															role: event.target.value as RoleName,
														})
													}
													className="w-32 py-1.5 text-xs"
													aria-label={`Change role for ${user.name}`}
												>
													{ROLES.map((role) => (
														<option key={role} value={role}>
															{titleCase(role)}
														</option>
													))}
												</Select>
											</div>
										</Td>
										<Td>
											<Badge tone={user.banned ? "danger" : "success"}>
												{user.banned ? "Inactive" : "Active"}
											</Badge>
										</Td>
										<Td className="whitespace-nowrap text-slate-500">
											{formatDateTime(user.createdAt)}
										</Td>
										<Td className="text-right">
											<div className="inline-flex items-center gap-1">
												<Button
													variant="ghost"
													size="sm"
													title="Reset password"
													onClick={() => setResetTarget(user)}
												>
													<KeyRound className="size-4" />
												</Button>
												{user.banned ? (
													<Button
														variant="ghost"
														size="sm"
														title="Activate"
														disabled={isSelf || activeMutation.isPending}
														className="hover:bg-emerald-50 hover:text-emerald-600"
														onClick={() =>
															activeMutation.mutate({ id: user.id, active: true })
														}
													>
														<CheckCircle2 className="size-4" />
													</Button>
												) : (
													<Button
														variant="ghost"
														size="sm"
														title="Deactivate"
														disabled={isSelf || activeMutation.isPending}
														className="hover:bg-rose-50 hover:text-rose-600"
														onClick={() =>
															activeMutation.mutate({ id: user.id, active: false })
														}
													>
														<Ban className="size-4" />
													</Button>
												)}
											</div>
										</Td>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
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

			<ResetPasswordModal
				user={resetTarget}
				onClose={() => setResetTarget(null)}
			/>
		</div>
	);
}

function CreateUserModal({
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
		formState: { errors },
	} = useForm<CreateValues>({
		resolver: zodResolver(createSchema),
		defaultValues: { name: "", email: "", password: "", role: "storekeeper" },
	});

	useEffect(() => {
		if (open)
			reset({ name: "", email: "", password: "", role: "storekeeper" });
	}, [open, reset]);

	const mutation = useMutation({
		mutationFn: (values: CreateValues) =>
			api.post<User>("/users", {
				name: values.name.trim(),
				email: values.email.trim(),
				password: values.password,
				role: values.role,
			}),
		onSuccess: () => {
			toast.success("User created — share the initial password securely");
			onCreated();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to create user",
			),
	});

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Create user"
				subtitle="Provision a WAI account and assign its role."
		>
			<form
				onSubmit={handleSubmit((values) => mutation.mutate(values))}
				className="grid grid-cols-1 gap-4 sm:grid-cols-2"
			>
				<Field label="Full name" error={errors.name?.message}>
					<Input placeholder="Jane Doe" {...register("name")} />
				</Field>
				<Field label="Email" error={errors.email?.message}>
					<Input
						type="email"
						placeholder="jane@zola.local"
						{...register("email")}
					/>
				</Field>
				<Field
					label="Initial password"
					error={errors.password?.message}
					hint="At least 8 characters. Share it privately; the user can keep it."
					className="sm:col-span-2"
				>
					<Input
						type="password"
						autoComplete="new-password"
						placeholder="••••••••"
						{...register("password")}
					/>
				</Field>
				<Field label="Role" error={errors.role?.message}>
					<Select {...register("role")}>
						{ROLES.map((role) => (
							<option key={role} value={role}>
								{titleCase(role)}
							</option>
						))}
					</Select>
				</Field>
				<div className="flex items-center justify-end gap-2 pt-2 sm:col-span-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={mutation.isPending}>
						<UserCog className="size-4" /> Create user
					</Button>
				</div>
			</form>
		</Modal>
	);
}

function ResetPasswordModal({
	user,
	onClose,
}: {
	user: User | null;
	onClose: () => void;
}) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<PasswordValues>({
		resolver: zodResolver(passwordSchema),
		defaultValues: { password: "" },
	});

	useEffect(() => {
		if (user) reset({ password: "" });
	}, [user, reset]);

	const mutation = useMutation({
		mutationFn: (values: PasswordValues) =>
			api.post(`/users/${user?.id}/reset-password`, {
				password: values.password,
			}),
		onSuccess: () => {
			toast.success("Password reset — share the new password securely");
			onClose();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Password reset failed",
			),
	});

	return (
		<Modal
			open={user !== null}
			onClose={onClose}
			title="Reset password"
			subtitle={user ? `${user.name} · ${user.email}` : undefined}
		>
			<form
				onSubmit={handleSubmit((values) => mutation.mutate(values))}
				className="space-y-4"
			>
				<Field
					label="New password"
					error={errors.password?.message}
					hint="At least 8 characters."
				>
					<Input
						type="password"
						autoComplete="new-password"
						placeholder="••••••••"
						{...register("password")}
					/>
				</Field>
				<div className="flex items-center justify-end gap-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={mutation.isPending}>
						Set password
					</Button>
				</div>
			</form>
		</Modal>
	);
}
