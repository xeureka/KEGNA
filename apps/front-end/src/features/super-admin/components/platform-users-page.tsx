import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
	Th,
} from "@/components/ui/table";
import { api } from "@/lib/api";

type PlatformUser = {
	userId: string;
	userName: string;
	userEmail: string;
	userStatus: string;
	roleName: string;
	membershipStatus: string;
	tenantId: string;
	tenantName: string;
	tenantSlug: string;
};
type Tenant = { id: string; name: string; slug: string };

export function PlatformUsersPage() {
	const [name, setName] = useState("");
	const [tenantId, setTenantId] = useState("");
	const [role, setRole] = useState("");
	const [status, setStatus] = useState("");
	const tenants = useQuery({
		queryKey: ["platform-tenants"],
		queryFn: () => api.get<Tenant[]>("/super-admin/tenants"),
	});
	const users = useQuery({
		queryKey: ["platform-users", tenantId, name, role, status],
		queryFn: () =>
			api.get<PlatformUser[]>("/super-admin/users", {
				tenantId: tenantId || undefined,
				name: name || undefined,
				role: role || undefined,
				status: status || undefined,
			}),
	});

	return (
		<div className="space-y-6">
			<PageHeader
				title="Platform users"
				subtitle="Search users and memberships across every clinic."
			/>
			<Card>
				<CardHeader title="Filters" />
				<CardContent className="grid gap-3 md:grid-cols-4">
					<Input
						placeholder="Search name"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Select
						value={tenantId}
						onChange={(event) => setTenantId(event.target.value)}
					>
						<option value="">All clinics</option>
						{(tenants.data ?? []).map((tenant) => (
							<option key={tenant.id} value={tenant.id}>
								{tenant.name}
							</option>
						))}
					</Select>
					<Select
						value={role}
						onChange={(event) => setRole(event.target.value)}
					>
						<option value="">All roles</option>
						<option>OWNER</option>
						<option>RECEPTIONIST</option>
						<option>DOCTOR</option>
						<option>ACCOUNTANT</option>
					</Select>
					<Select
						value={status}
						onChange={(event) => setStatus(event.target.value)}
					>
						<option value="">All statuses</option>
						<option>ACTIVE</option>
						<option>INVITED</option>
						<option>SUSPENDED</option>
						<option>INACTIVE</option>
					</Select>
				</CardContent>
			</Card>
			{users.isLoading ? <Spinner label="Loading platform users" /> : null}
			{users.error ? (
				<InlineError
					message={
						users.error instanceof Error
							? users.error.message
							: "Unable to load platform users"
					}
				/>
			) : null}
			{users.data ? (
				<Card>
					<CardContent className="p-0">
						<Table>
							<TableHead>
								<Th>User</Th>
								<Th>Clinic</Th>
								<Th>Role</Th>
								<Th>Status</Th>
							</TableHead>
							<TableBody>
								{users.data.map((user) => (
									<TableRow key={`${user.userId}-${user.tenantId}`}>
										<Td>
											<p className="font-medium text-slate-900">
												{user.userName}
											</p>
											<p className="text-xs text-slate-500">{user.userEmail}</p>
										</Td>
										<Td>
											{user.tenantName}
											<p className="text-xs text-slate-500">
												{user.tenantSlug}
											</p>
										</Td>
										<Td>
											<Badge tone="neutral">{user.roleName}</Badge>
										</Td>
										<Td>
											<Badge
												tone={
													user.membershipStatus === "ACTIVE"
														? "success"
														: "danger"
												}
											>
												{user.membershipStatus}
											</Badge>
										</Td>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{users.data.length === 0 ? (
							<p className="p-6 text-center text-sm text-slate-500">
								No users match these filters.
							</p>
						) : null}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
