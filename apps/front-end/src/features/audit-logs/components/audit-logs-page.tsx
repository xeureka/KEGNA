import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
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
} from "@/components/ui/table";
import { useSort } from "@/hooks/use-sort";
import { api } from "@/lib/api";
import { AUDIT_ACTION_TONE } from "@/lib/status";
import type { AuditLog, Paginated } from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/utils";

const PAGE_SIZE = 20;

export function AuditLogsPage() {
	const [page, setPage] = useState(1);
	const [action, setAction] = useState("");

	const { data, isLoading, error } = useQuery({
		queryKey: ["audit-logs", page, action],
		queryFn: () =>
			api.get<Paginated<AuditLog>>("/audit-logs", {
				page,
				pageSize: PAGE_SIZE,
				action: action || undefined,
			}),
	});

	const logs = data?.items ?? [];
	const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

	const { sorted, key, dir, toggle } = useSort(logs, "createdAt");

	return (
		<div className="space-y-5">
			<PageHeader
				title="Audit Logs"
				subtitle="A record of every create, update and delete across the system"
			/>

			<Card>
				<div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
					<label
						htmlFor="action-filter"
						className="text-sm font-medium text-slate-600"
					>
						Action
					</label>
					<Select
						id="action-filter"
						value={action}
						onChange={(e) => {
							setPage(1);
							setAction(e.target.value);
						}}
						className="w-40"
					>
						<option value="">All actions</option>
						<option value="CREATE">Create</option>
						<option value="UPDATE">Update</option>
						<option value="DELETE">Delete</option>
					</Select>
				</div>

				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error
								? error.message
								: "Failed to load audit logs"
						}
					/>
				) : null}

				{!isLoading && !error && logs.length === 0 ? (
					<EmptyState
						title="No audit events yet"
						description="Actions taken on records will appear here."
					/>
				) : null}

				{!isLoading && !error && logs.length > 0 ? (
					<>
						<Table>
							<TableHead>
								<SortableTh
									field="createdAt"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									When
								</SortableTh>
								<SortableTh
									field="actorUserId"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Actor
								</SortableTh>
								<SortableTh
									field="action"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Action
								</SortableTh>
								<SortableTh
									field="entityType"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Table
								</SortableTh>
								<SortableTh
									field="entityId"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Record
								</SortableTh>
								<SortableTh
									field="ipAddress"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									IP address
								</SortableTh>
							</TableHead>
							<TableBody>
								{sorted.map((log) => (
									<TableRow key={log.id}>
										<Td className="whitespace-nowrap text-slate-500">
											{formatDateTime(log.createdAt)}
										</Td>
										<Td>
											<p className="font-medium text-slate-900">
												{log.actorUserId ?? "System"}
											</p>
										</Td>
										<Td>
											<Badge tone={AUDIT_ACTION_TONE[log.action]}>
												{log.action}
											</Badge>
										</Td>
										<Td className="text-slate-600">
											{titleCase(log.entityType)}
										</Td>
										<Td className="text-xs text-slate-500">
											{log.entityId ? `${log.entityId.slice(0, 8)}…` : "—"}
										</Td>
										<Td className="text-slate-500">{log.ipAddress ?? "—"}</Td>
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
		</div>
	);
}
