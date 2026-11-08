import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Receipt } from "lucide-react";
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
import { BILL_STATUS_TONE } from "@/lib/status";
import type { Bill, Paginated } from "@/lib/types";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/utils";

const LIMIT = 10;

const paySchema = z
	.object({
		amount: z
			.string()
			.regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
			.min(1, "Amount is required"),
		method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"]),
	})
	.refine((v) => Number(v.amount) > 0, {
		message: "Amount must be greater than zero",
		path: ["amount"],
	});

type PayFormValues = z.infer<typeof paySchema>;

const PAYMENT_METHODS = [
	"CASH",
	"CARD",
	"BANK_TRANSFER",
	"MOBILE_MONEY",
	"OTHER",
];

export function BillsPage() {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState("");
	const [payTarget, setPayTarget] = useState<Bill | null>(null);

	const { data, isLoading, error } = useQuery({
		queryKey: ["bills", page, status],
		queryFn: () =>
			api.get<Paginated<Bill>>("/bills", {
				page,
				pageSize: LIMIT,
				status: status || undefined,
			}),
		refetchInterval: 10_000,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["bills"] });
		queryClient.invalidateQueries({ queryKey: ["dashboard"] });
	};

	const bills = data?.items ?? [];
	const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

	const { sorted, key, dir, toggle } = useSort(bills, "createdAt");

	const canPay =
		hasPermission("bills.update") || session?.role?.name === "RECEPTIONIST";

	return (
		<div className="space-y-5">
			<PageHeader title="Bills" subtitle="Invoices and payment records" />

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
						onChange={(e) => {
							setPage(1);
							setStatus(e.target.value);
						}}
						className="w-44"
					>
						<option value="">All statuses</option>
						<option value="PENDING">Pending</option>
						<option value="PARTIALLY_PAID">Partially paid</option>
						<option value="PAID">Paid</option>
						<option value="CANCELLED">Cancelled</option>
						<option value="VOID">Void</option>
					</Select>
				</div>

				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error ? error.message : "Failed to load bills"
						}
					/>
				) : null}

				{!isLoading && !error && bills.length === 0 ? (
					<EmptyState
						title="No bills found"
						description="Bills are generated automatically when an appointment is completed."
					/>
				) : null}

				{!isLoading && !error && bills.length > 0 ? (
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
									field="createdAt"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Issued
								</SortableTh>
								<SortableTh
									field="totalAmount"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Total
								</SortableTh>
								<SortableTh
									field="amountPaid"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Paid
								</SortableTh>
								<SortableTh
									field="status"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Balance
								</SortableTh>
								<SortableTh
									field="status"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Status
								</SortableTh>
								<Th className="text-right">Actions</Th>
							</TableHead>
							<TableBody>
								{sorted.map((bill) => {
									const balance =
										Number(bill.totalAmount) - Number(bill.amountPaid);
									return (
										<TableRow key={bill.id}>
											<Td className="font-medium text-slate-900">
												{bill.patientName}
											</Td>
											<Td className="whitespace-nowrap text-slate-500">
												{formatDateTime(bill.createdAt)}
											</Td>
											<Td className="font-medium text-slate-900">
												{formatCurrency(bill.totalAmount)}
											</Td>
											<Td className="text-slate-600">
												{formatCurrency(bill.amountPaid)}
											</Td>
											<Td
												className={
													balance > 0
														? "font-medium text-rose-700"
														: "text-slate-600"
												}
											>
												{formatCurrency(balance)}
											</Td>
											<Td>
												<Badge tone={BILL_STATUS_TONE[bill.status]}>
													{titleCase(bill.status)}
												</Badge>
											</Td>
											<Td className="text-right">
												{canPay &&
												(bill.status === "PENDING" ||
													bill.status === "PARTIALLY_PAID") ? (
													<Button size="sm" onClick={() => setPayTarget(bill)}>
														<Banknote className="size-4" /> Record payment
													</Button>
												) : (
													<span className="text-xs text-slate-400">—</span>
												)}
											</Td>
										</TableRow>
									);
								})}
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

			<PayBillModal
				bill={payTarget}
				onClose={() => setPayTarget(null)}
				onPaid={() => {
					setPayTarget(null);
					invalidate();
				}}
			/>
		</div>
	);
}

function PayBillModal({
	bill,
	onClose,
	onPaid,
}: {
	bill: Bill | null;
	onClose: () => void;
	onPaid: () => void;
}) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<PayFormValues>({
		resolver: zodResolver(paySchema),
		defaultValues: { method: "CASH" },
	});

	const payMutation = useMutation({
		mutationFn: (values: PayFormValues) => {
			if (!bill) throw new Error("Missing bill");
			return api.post<{ id: string; status: string }>(
				`/bills/${bill.id}/payments`,
				values,
			);
		},
		onSuccess: () => {
			toast.success("Payment recorded");
			reset();
			onPaid();
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Payment failed"),
	});

	if (!bill) return null;
	const balance = Math.max(
		Number(bill.totalAmount) - Number(bill.amountPaid),
		0,
	);

	return (
		<Modal
			open={bill !== null}
			onClose={onClose}
			title="Record payment"
			subtitle={`${bill.patientName} · ${formatCurrency(bill.totalAmount)} total`}
		>
			<div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
				<div className="flex items-center justify-between text-sm">
					<span className="text-slate-500">Outstanding balance</span>
					<span className="text-base font-bold text-slate-900">
						{formatCurrency(balance)}
					</span>
				</div>
			</div>

			<form
				onSubmit={handleSubmit((v) => payMutation.mutate(v))}
				className="space-y-4"
			>
				<Field label="Amount" error={errors.amount?.message}>
					<Input
						type="number"
						step="0.01"
						min="0"
						placeholder={`Up to ${balance.toFixed(2)}`}
						{...register("amount")}
					/>
				</Field>
				<Field label="Payment method" error={errors.method?.message}>
					<Select {...register("method")}>
						{PAYMENT_METHODS.map((method) => (
							<option key={method} value={method}>
								{titleCase(method)}
							</option>
						))}
					</Select>
				</Field>
				<div className="flex items-center justify-end gap-2 pt-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={payMutation.isPending}>
						<Receipt className="size-4" /> Record payment
					</Button>
				</div>
			</form>
		</Modal>
	);
}
