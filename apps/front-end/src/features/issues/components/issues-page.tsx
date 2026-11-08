import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, PackagePlus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import {
	EmptyState,
	InlineError,
	PageHeader,
	Spinner,
} from "@/components/ui/page";
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
	Th,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { ISSUE_STATUS_TONE } from "@/lib/status";
import type { IssueListRow, IssueStatus } from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/utils";

const PAGE_SIZE = 50;
const STATUSES: IssueStatus[] = [
	"open",
	"reported",
	"returns_confirmed",
	"verified",
	"flagged",
];

export function IssuesPage() {
	const [status, setStatus] = useState("");
	const [page, setPage] = useState(1);

	const issuesQuery = useQuery({
		queryKey: ["issues", "list", status, page],
		queryFn: () =>
			api.get<IssueListRow[]>("/issues", {
				status: status || undefined,
				limit: PAGE_SIZE,
				offset: (page - 1) * PAGE_SIZE,
			}),
	});

	const rows = issuesQuery.data ?? [];

	return (
		<div className="space-y-5">
			<PageHeader
				title="Issues"
				subtitle="Load-outs and their progress through reporting, returns and verification"
				actions={
					<Link to="/issues/new">
						<Button>
							<PackagePlus className="size-4" /> New load-out
						</Button>
					</Link>
				}
			/>

			<Card>
				<div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
					<label
						htmlFor="status-filter"
						className="text-sm font-medium text-slate-600"
					>
						Status
					</label>
					<Select
						id="status-filter"
						value={status}
						onChange={(event) => {
							setStatus(event.target.value);
							setPage(1);
						}}
						className="w-48"
					>
						<option value="">All statuses</option>
						{STATUSES.map((issueStatus) => (
							<option key={issueStatus} value={issueStatus}>
								{titleCase(issueStatus)}
							</option>
						))}
					</Select>
				</div>

				{issuesQuery.isLoading ? <Spinner /> : null}
				{issuesQuery.error ? (
					<InlineError
						message={
							issuesQuery.error instanceof Error
								? issuesQuery.error.message
								: "Failed to load issues"
						}
					/>
				) : null}

				{!issuesQuery.isLoading &&
				!issuesQuery.error &&
				rows.length === 0 ? (
					<EmptyState
						title="No issues found"
						description="Create a load-out to issue racks to a salesperson."
						action={
							<Link to="/issues/new">
								<Button>
									<PackagePlus className="size-4" /> New load-out
								</Button>
							</Link>
						}
					/>
				) : null}

				{!issuesQuery.isLoading && !issuesQuery.error && rows.length > 0 ? (
					<>
						<Table>
							<TableHead>
								<Th>Issue</Th>
								<Th>Salesperson</Th>
								<Th>Status</Th>
								<Th>Issued</Th>
								<Th>Note</Th>
							</TableHead>
							<TableBody>
								{rows.map(({ issue, salesperson }) => (
									<TableRow key={issue.id}>
										<Td>
											<Link
												to="/issues/$issueId"
												params={{ issueId: issue.id }}
												className="font-medium text-primary-700 hover:underline"
											>
												{issue.issueNo}
											</Link>
										</Td>
										<Td>
											<p className="font-medium text-slate-900">
												{salesperson.name}
											</p>
											<p className="text-xs text-slate-500">
												{salesperson.email}
											</p>
										</Td>
										<Td>
											<Badge tone={ISSUE_STATUS_TONE[issue.status] ?? "neutral"}>
												{titleCase(issue.status)}
											</Badge>
										</Td>
										<Td className="whitespace-nowrap text-slate-500">
											{formatDateTime(issue.issuedAt)}
										</Td>
										<Td className="max-w-64 text-slate-500">
											{issue.note ?? "—"}
										</Td>
									</TableRow>
								))}
							</TableBody>
						</Table>
						<div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-3">
							<p className="text-xs text-slate-500">Page {page}</p>
							<div className="flex items-center gap-1">
								<Button
									variant="secondary"
									size="sm"
									disabled={page <= 1}
									onClick={() => setPage((current) => current - 1)}
									aria-label="Previous page"
								>
									<ChevronLeft className="size-4" />
								</Button>
								<Button
									variant="secondary"
									size="sm"
									disabled={rows.length < PAGE_SIZE}
									onClick={() => setPage((current) => current + 1)}
									aria-label="Next page"
								>
									<ChevronRight className="size-4" />
								</Button>
							</div>
						</div>
					</>
				) : null}
			</Card>
		</div>
	);
}
