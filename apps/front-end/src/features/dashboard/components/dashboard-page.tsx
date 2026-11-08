import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	Boxes,
	Package,
	PackagePlus,
	ArrowDownToLine,
	ClipboardList,
	Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
	EmptyState,
	InlineError,
	PageHeader,
	Spinner,
} from "@/components/ui/page";
import { StatCard } from "@/components/ui/stat-card";
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
	Th,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { ISSUE_STATUS_TONE } from "@/lib/status";
import type {
	DashboardSummary,
	IssueListRow,
	Product,
} from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["open", "reported", "returns_confirmed"]);

export function DashboardPage() {
	const { data: session } = useSession();
	const role = session?.role ?? "storekeeper";

	const summaryQuery = useQuery({
		queryKey: ["dashboard", "summary"],
		queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
		refetchInterval: 15_000,
	});

	const productsQuery = useQuery({
		queryKey: ["products"],
		queryFn: () => api.get<Product[]>("/products"),
	});

	const issuesQuery = useQuery({
		queryKey: ["issues", "recent"],
		queryFn: () => api.get<IssueListRow[]>("/issues", { limit: 8 }),
	});

	const summary = summaryQuery.data;
	const products = productsQuery.data ?? [];
	const productsById = new Map(products.map((product) => [product.id, product]));
	const balances = summary?.balances ?? [];
	const inProgress = (summary?.issuesByStatus ?? [])
		.filter((row) => ACTIVE_STATUSES.has(row.status))
		.reduce((total, row) => total + Number(row.count), 0);
	const flagged = Number(summary?.flagged ?? 0);
	const warehouseRacks = balances.reduce(
		(total, row) => total + Number(row.warehouse),
		0,
	);
	const heldRacks = Number(summary?.racksWithSalespeople ?? 0);
	const activeIssues = (issuesQuery.data ?? []).filter((row) =>
		ACTIVE_STATUSES.has(row.issue.status),
	);

	const error = summaryQuery.error ?? issuesQuery.error;
	const isLoading = summaryQuery.isLoading || issuesQuery.isLoading;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Overview"
				subtitle="Warehouse balances and active load-outs"
				actions={
					role === "admin" ? (
						<div className="flex items-center gap-2">
							<Link to="/products">
								<Button variant="secondary" size="sm">
									<Package className="size-4" /> Products
								</Button>
							</Link>
							<Link to="/users">
								<Button variant="secondary" size="sm">
									<Users className="size-4" /> Users
								</Button>
							</Link>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<Link to="/stock/receive">
								<Button variant="secondary" size="sm">
									<ArrowDownToLine className="size-4" /> Receive
								</Button>
							</Link>
							<Link to="/issues/new">
								<Button size="sm">
									<PackagePlus className="size-4" /> New load-out
								</Button>
							</Link>
						</div>
					)
				}
			/>

			{error ? (
				<InlineError
					message={
						error instanceof Error ? error.message : "Failed to load overview"
					}
				/>
			) : null}

			{isLoading ? <Spinner label="Loading overview" /> : null}

			{summary ? (
				<>
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
						<StatCard
							label="Products"
							value={products.length}
							icon={Package}
						/>
						<StatCard
							label="Racks in warehouse"
							value={warehouseRacks}
							icon={Boxes}
						/>
						<StatCard
							label="Held by salespeople"
							value={heldRacks}
							icon={Users}
						/>
						<StatCard
							label="Issues in progress"
							value={inProgress}
							icon={ClipboardList}
						/>
						<StatCard
							label="Flagged reports"
							value={flagged}
							icon={AlertTriangle}
						/>
					</div>

					<Card>
						<CardHeader
							title="Warehouse balances"
							subtitle="Racks currently in the warehouse and with salespeople"
						/>
						{balances.length === 0 ? (
							<EmptyState
								title="No products yet"
								description="Add products before receiving stock."
							/>
						) : (
							<Table>
								<TableHead>
									<Th>Product</Th>
									<Th>SKU</Th>
									<Th className="text-right">Bottles / rack</Th>
									<Th className="text-right">Warehouse</Th>
									<Th className="text-right">With salespeople</Th>
								</TableHead>
								<TableBody>
									{balances.map((row) => {
										const product = productsById.get(row.productId);
										return (
											<TableRow key={row.productId}>
												<Td className="font-medium text-slate-900">
													{product?.name ?? "Unknown product"}
												</Td>
												<Td className="text-slate-500">{product?.sku ?? "—"}</Td>
												<Td className="text-right text-slate-600">
													{product?.bottlesPerRack ?? "—"}
												</Td>
												<Td className="text-right font-semibold text-slate-900">
													{Number(row.warehouse)}
												</Td>
												<Td className="text-right text-slate-600">
													{Number(row.held)}
												</Td>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</Card>

					<Card>
						<CardHeader
							title="Active issues"
							subtitle="Load-outs waiting on a report, returns or verification"
							actions={
								<Link to="/issues">
									<Button variant="ghost" size="sm">
										View all
									</Button>
								</Link>
							}
						/>
						{issuesQuery.isLoading ? <Spinner /> : null}
						{!issuesQuery.isLoading && activeIssues.length === 0 ? (
							<EmptyState
								title="No active issues"
								description="New load-outs will appear here until they are verified."
								action={
									<Link to="/issues/new">
										<Button size="sm">
											<PackagePlus className="size-4" /> New load-out
										</Button>
									</Link>
								}
							/>
						) : null}
						{!issuesQuery.isLoading && activeIssues.length > 0 ? (
							<Table>
								<TableHead>
									<Th>Issue</Th>
									<Th>Salesperson</Th>
									<Th>Status</Th>
									<Th>Issued</Th>
								</TableHead>
								<TableBody>
									{activeIssues.map(({ issue, salesperson }) => (
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
											<Td className="text-slate-700">{salesperson.name}</Td>
											<Td>
												<Badge tone={ISSUE_STATUS_TONE[issue.status] ?? "neutral"}>
													{titleCase(issue.status)}
												</Badge>
											</Td>
											<Td className="whitespace-nowrap text-slate-500">
												{formatDateTime(issue.issuedAt)}
											</Td>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : null}
					</Card>
				</>
			) : null}
		</div>
	);
}
