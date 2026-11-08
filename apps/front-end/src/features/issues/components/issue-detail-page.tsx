import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
	EmptyState,
	InlineError,
	PageHeader,
	Spinner,
} from "@/components/ui/page";
import { SummaryRow } from "@/components/ui/stat-card";
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
	Th,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import {
	ISSUE_STATUS_TONE,
	VERIFICATION_TONE,
} from "@/lib/status";
import type { IssueDetail } from "@/lib/types";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/utils";

export function IssueDetailPage() {
	const { issueId } = useParams({
		from: "/_authenticated/issues/$issueId",
	});
	const queryClient = useQueryClient();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const issueQuery = useQuery({
		queryKey: ["issue", issueId],
		queryFn: () => api.get<IssueDetail>(`/issues/${issueId}`),
	});

	const issue = issueQuery.data;
	const itemTotal = (issue?.items ?? []).reduce(
		(total, row) => total + row.item.quantity * Number(row.item.unitPrice),
		0,
	);

	return (
		<div className="space-y-5">
			<PageHeader
				title={issue ? issue.issueNo : "Issue detail"}
				subtitle={
					issue
						? `${issue.salesperson.name} · issued ${formatDateTime(issue.issuedAt)}`
						: undefined
				}
				actions={
					<div className="flex items-center gap-2">
						{issue ? (
							<Badge tone={ISSUE_STATUS_TONE[issue.status] ?? "neutral"}>
								{titleCase(issue.status)}
							</Badge>
						) : null}
						<Link to="/issues">
							<Button variant="secondary" size="sm">
								<ArrowLeft className="size-4" /> Issues
							</Button>
						</Link>
					</div>
				}
			/>

			{issueQuery.isLoading ? <Spinner label="Loading issue" /> : null}
			{issueQuery.error ? (
				<InlineError
					message={
						issueQuery.error instanceof Error
							? issueQuery.error.message
							: "Failed to load issue"
					}
				/>
			) : null}

			{issue ? (
				<>
					<Card>
						<CardHeader title="Summary" />
						<CardContent>
							<dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
								<SummaryRow
									label="Salesperson"
									value={
										<span>
											{issue.salesperson.name}
											<span className="ml-2 text-xs font-normal text-slate-500">
												{issue.salesperson.email}
											</span>
										</span>
									}
								/>
								<SummaryRow
									label="Status"
									value={
										<Badge
											tone={ISSUE_STATUS_TONE[issue.status] ?? "neutral"}
										>
											{titleCase(issue.status)}
										</Badge>
									}
								/>
								<SummaryRow
									label="Issued at"
									value={formatDateTime(issue.issuedAt)}
								/>
								<SummaryRow
									label="Closed at"
									value={
										issue.closedAt ? formatDateTime(issue.closedAt) : "—"
									}
								/>
								<SummaryRow
									label="Issued by"
									value={
										<span className="font-mono text-xs text-slate-500">
											{issue.issuedBy.slice(0, 8)}…
										</span>
									}
								/>
								<SummaryRow label="Note" value={issue.note ?? "—"} />
							</dl>
						</CardContent>
					</Card>

					<Card>
						<CardHeader
							title="Issued racks"
							subtitle={`${issue.items.length} product${issue.items.length === 1 ? "" : "s"} · ${formatCurrency(itemTotal)}`}
						/>
						<Table>
							<TableHead>
								<Th>Product</Th>
								<Th>SKU</Th>
								<Th className="text-right">Racks</Th>
								<Th className="text-right">Unit price</Th>
								<Th className="text-right">Line total</Th>
							</TableHead>
							<TableBody>
								{issue.items.map(({ item, product }) => (
									<TableRow key={item.id}>
										<Td className="font-medium text-slate-900">
											{product.name}
										</Td>
										<Td className="font-mono text-xs text-slate-500">
											{product.sku}
										</Td>
										<Td className="text-right text-slate-700">
											{item.quantity}
										</Td>
										<Td className="text-right text-slate-600">
											{formatCurrency(item.unitPrice)}
										</Td>
										<Td className="text-right font-medium text-slate-900">
											{formatCurrency(
												item.quantity * Number(item.unitPrice),
											)}
										</Td>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Card>

					<Card>
						<CardHeader
							title="Reconciliation"
							subtitle="Expected sales, declared sales and bank deposits"
						/>
						<CardContent>
							<dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
								<SummaryRow
									label="Expected sold"
									value={issue.reconciliation.expected_sold}
								/>
								<SummaryRow
									label="Declared sold"
									value={issue.reconciliation.declared_sold}
								/>
								<SummaryRow
									label="Racks variance"
									value={
										<Variance value={issue.reconciliation.racks_variance} />
									}
								/>
								<SummaryRow
									label="Returns confirmed"
									value={
										issue.reconciliation.returns_confirmed ? "Yes" : "No"
									}
								/>
								<SummaryRow
									label="Expected cash"
									value={formatCurrency(issue.reconciliation.expected_cash)}
								/>
								<SummaryRow
									label="Deposited cash"
									value={formatCurrency(issue.reconciliation.deposited_cash)}
								/>
								<SummaryRow
									label="Cash variance"
									value={
										<Variance
											value={Number(issue.reconciliation.cash_variance)}
											money
										/>
									}
								/>
							</dl>
						</CardContent>
					</Card>

					<Card>
						<CardHeader
							title="Sales report"
							subtitle="Declared quantities and bank deposits"
						/>
						{issue.report ? (
							<>
								<CardContent>
									<dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
										<SummaryRow
											label="Report status"
											value={titleCase(issue.report.status)}
										/>
										<SummaryRow
											label="Submitted at"
											value={formatDateTime(issue.report.submittedAt)}
										/>
									</dl>
								</CardContent>
								<Table>
									<TableHead>
										<Th>Product</Th>
										<Th className="text-right">Sold</Th>
										<Th className="text-right">Returned</Th>
										<Th className="text-right">Damaged</Th>
									</TableHead>
									<TableBody>
										{issue.report.items.map(({ item, product }) => (
											<TableRow key={item.id}>
												<Td className="font-medium text-slate-900">
													{product.name}
												</Td>
												<Td className="text-right text-slate-700">
													{item.sold}
												</Td>
												<Td className="text-right text-slate-700">
													{item.returned}
												</Td>
												<Td className="text-right text-slate-700">
													{item.damaged}
												</Td>
											</TableRow>
										))}
									</TableBody>
								</Table>
								<div className="border-t border-slate-200 px-5 py-4">
									<p className="mb-2 text-sm font-medium text-slate-700">
										Deposits
									</p>
									{issue.report.deposits.length === 0 ? (
										<p className="text-sm text-slate-500">
											No deposits recorded.
										</p>
									) : (
										<Table>
											<TableHead>
												<Th>Amount</Th>
												<Th>Bank</Th>
												<Th>Reference</Th>
												<Th>Deposited</Th>
												<Th>Slip</Th>
											</TableHead>
											<TableBody>
												{issue.report.deposits.map((deposit) => (
													<TableRow key={deposit.id}>
														<Td className="font-medium text-slate-900">
															{formatCurrency(deposit.amount)}
														</Td>
														<Td className="text-slate-600">
															{deposit.bankName}
														</Td>
														<Td className="font-mono text-xs text-slate-500">
															{deposit.referenceNo}
														</Td>
														<Td className="whitespace-nowrap text-slate-500">
															{formatDateTime(deposit.depositedAt)}
														</Td>
														<Td>
															<div className="flex items-center gap-2">
																<span className="max-w-40 truncate font-mono text-xs text-slate-500">
																	{deposit.slipFileKey}
																</span>
																<CopyButton
																	value={deposit.slipFileKey}
																	label="slip file key"
																/>
															</div>
														</Td>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</div>
							</>
						) : (
							<EmptyState
								title="No report yet"
								description="The salesperson submits the report from the mobile app."
							/>
						)}
					</Card>

					<Card>
						<CardHeader
							title="Return confirmation"
							subtitle="Racks physically returned or damaged in custody"
							actions={
								issue.status === "reported" &&
								!issue.return_confirmation ? (
									<Button size="sm" onClick={() => setConfirmOpen(true)}>
										<CheckCircle2 className="size-4" /> Confirm returns
									</Button>
								) : null
							}
						/>
						{issue.return_confirmation ? (
							<>
								<CardContent>
									<dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
										<SummaryRow
											label="Confirmed at"
											value={formatDateTime(
												issue.return_confirmation.confirmedAt,
											)}
										/>
										<SummaryRow
											label="Note"
											value={issue.return_confirmation.note ?? "—"}
										/>
									</dl>
								</CardContent>
								<Table>
									<TableHead>
										<Th>Product</Th>
										<Th className="text-right">Returned</Th>
										<Th className="text-right">Damaged</Th>
									</TableHead>
									<TableBody>
										{issue.return_confirmation.items.map(({ item, product }) => (
											<TableRow key={item.id}>
												<Td className="font-medium text-slate-900">
													{product.name}
												</Td>
												<Td className="text-right text-slate-700">
													{item.returned}
												</Td>
												<Td className="text-right text-slate-700">
													{item.damaged}
												</Td>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</>
						) : (
							<div className="px-5 py-10 text-center text-sm text-slate-500">
								{issue.status === "open"
									? "Waiting for the salesperson to submit a report."
									: issue.status === "reported"
										? "No returns confirmed yet."
										: "No return confirmation recorded."}
							</div>
						)}
					</Card>

					{issue.verification ? (
						<Card>
							<CardHeader
								title="Verification"
								subtitle="Accountant decision recorded in the mobile app"
								actions={
									<Badge
										tone={
											VERIFICATION_TONE[issue.verification.decision] ??
											"neutral"
										}
									>
										{titleCase(issue.verification.decision)}
									</Badge>
								}
							/>
							<CardContent>
								<dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
									<SummaryRow
										label="Expected cash"
										value={formatCurrency(issue.verification.expectedCash)}
									/>
									<SummaryRow
										label="Deposited cash"
										value={formatCurrency(issue.verification.depositedCash)}
									/>
									<SummaryRow
										label="Cash variance"
										value={
											<Variance
												value={Number(issue.verification.cashVariance)}
												money
											/>
										}
									/>
									<SummaryRow
										label="Racks variance"
										value={<Variance value={issue.verification.racksVariance} />}
									/>
									<SummaryRow
										label="Decided at"
										value={formatDateTime(issue.verification.decidedAt)}
									/>
									<SummaryRow
										label="Note"
										value={issue.verification.note ?? "—"}
									/>
								</dl>
							</CardContent>
						</Card>
					) : null}

					<ConfirmReturnsModal
						issue={issue}
						open={confirmOpen}
						onClose={() => setConfirmOpen(false)}
						onConfirmed={() => {
							setConfirmOpen(false);
							void queryClient.invalidateQueries({
								queryKey: ["issue", issueId],
							});
							void queryClient.invalidateQueries({ queryKey: ["issues"] });
							void queryClient.invalidateQueries({ queryKey: ["stock"] });
							void queryClient.invalidateQueries({
								queryKey: ["dashboard", "summary"],
							});
						}}
					/>
				</>
			) : null}
		</div>
	);
}

function Variance({ value, money = false }: { value: number; money?: boolean }) {
	if (value === 0)
		return <span className="text-emerald-600">{money ? formatCurrency(0) : "0"}</span>;
	const text = money ? formatCurrency(value) : `${value > 0 ? "+" : ""}${value}`;
	return (
		<span className="inline-flex items-center gap-1 text-amber-700">
			<AlertTriangle className="size-3.5" />
			{text}
		</span>
	);
}

function ConfirmReturnsModal({
	issue,
	open,
	onClose,
	onConfirmed,
}: {
	issue: IssueDetail;
	open: boolean;
	onClose: () => void;
	onConfirmed: () => void;
}) {
	if (!open) return null;
	return (
		<ConfirmReturnsDialog
			issue={issue}
			onClose={onClose}
			onConfirmed={onConfirmed}
		/>
	);
}

function ConfirmReturnsDialog({
	issue,
	onClose,
	onConfirmed,
}: {
	issue: IssueDetail;
	onClose: () => void;
	onConfirmed: () => void;
}) {
	const [rows, setRows] = useState<
		Record<string, { returned: number; damaged: number }>
	>(() =>
		Object.fromEntries(
			issue.items.map(({ item }) => [
				item.productId,
				{ returned: 0, damaged: 0 },
			]),
		),
	);
	const [note, setNote] = useState("");

	const invalid = issue.items.some(({ item }) => {
		const row = rows[item.productId] ?? { returned: 0, damaged: 0 };
		return (
			!Number.isInteger(row.returned) ||
			!Number.isInteger(row.damaged) ||
			row.returned < 0 ||
			row.damaged < 0 ||
			row.returned + row.damaged > item.quantity
		);
	});

	const mutation = useMutation({
		mutationFn: () =>
			api.post(`/issues/${issue.id}/confirm-returns`, {
				items: issue.items.map(({ item }) => ({
					product_id: item.productId,
					returned: rows[item.productId]?.returned ?? 0,
					damaged: rows[item.productId]?.damaged ?? 0,
				})),
				note: note.trim() || undefined,
			}),
		onSuccess: () => {
			toast.success("Returns confirmed");
			onConfirmed();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to confirm returns",
			),
	});

	const update = (
		productId: string,
		field: "returned" | "damaged",
		value: number,
	) => {
		setRows((current) => ({
			...current,
			[productId]: {
				returned: current[productId]?.returned ?? 0,
				damaged: current[productId]?.damaged ?? 0,
				[field]: value,
			},
		}));
	};

	return (
		<Modal
			open
			onClose={onClose}
			title="Confirm returns"
			subtitle={`${issue.issueNo} · ${issue.salesperson.name}`}
			size="lg"
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (invalid) {
						toast.error("Returned plus damaged cannot exceed the issued racks");
						return;
					}
					mutation.mutate();
				}}
				className="space-y-4"
			>
				<div className="space-y-3">
					{issue.items.map(({ item, product }) => {
						const row = rows[item.productId] ?? {
							returned: 0,
							damaged: 0,
						};
						const remaining = item.quantity - row.returned - row.damaged;
						return (
							<div
								key={item.id}
								className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12"
							>
								<div className="sm:col-span-5">
									<p className="text-sm font-medium text-slate-900">
										{product.name}
									</p>
									<p className="text-xs text-slate-500">
										Issued: {item.quantity} racks ·{" "}
										<span className="font-mono">{product.sku}</span>
									</p>
								</div>
								<div className="sm:col-span-3">
									<Field label="Returned">
										<Input
											type="number"
											min={0}
											max={item.quantity}
											value={row.returned}
											onChange={(event) =>
												update(
													item.productId,
													"returned",
													Number(event.target.value),
												)
											}
										/>
									</Field>
								</div>
								<div className="sm:col-span-3">
									<Field label="Damaged">
										<Input
											type="number"
											min={0}
											max={item.quantity}
											value={row.damaged}
											onChange={(event) =>
												update(
													item.productId,
													"damaged",
													Number(event.target.value),
												)
											}
										/>
									</Field>
								</div>
								<div className="flex items-end pb-2 text-xs sm:col-span-1">
									<span
										className={
											remaining < 0
												? "font-medium text-rose-600"
												: "text-slate-500"
										}
									>
										{remaining}
									</span>
								</div>
							</div>
						);
					})}
				</div>
				<p className="text-xs text-slate-500">
					The remaining racks are treated as sold during reconciliation.
				</p>
				<Field label="Note">
					<Textarea
						placeholder="Optional note about the returns"
						value={note}
						onChange={(event) => setNote(event.target.value)}
					/>
				</Field>
				<div className="flex items-center justify-end gap-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={mutation.isPending} disabled={invalid}>
						Confirm returns
					</Button>
				</div>
			</form>
		</Modal>
	);
}
