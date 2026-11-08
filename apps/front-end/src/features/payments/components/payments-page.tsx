import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
	Th,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { hasPermission, useSession } from "@/lib/auth";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_TONE } from "@/lib/status";
import type { Paginated } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type PaymentRow = {
	id: string;
	txRef: string | null;
	purpose: string;
	baseAmount: string;
	serviceCharge: string;
	totalAmount: string;
	currency: string;
	method: string;
	status: string;
	transferReference: string | null;
	createdAt: string;
	paidAt: string | null;
	patientName: string | null;
	patientPhone: string | null;
	recordedByName: string | null;
};

type QueueRow = PaymentRow & {
	expiresAt: string | null;
	holdExpired: boolean;
	appointmentStartAt: string | null;
	appointmentStatus: string | null;
	checkoutUrl: string | null;
};

type PaymentSummary = {
	totalRevenue: string;
	serviceChargesCollected: string;
	grossCollected: string;
	pendingCount: number;
	failedCount: number;
	expiredCount: number;
	cancelledCount: number;
	visitCount: number;
	cardCount: number;
	balanceCount: number;
	cash: string;
	transfer: string;
	chapa: string;
	today: string;
	week: string;
	month: string;
};

const PAGE_SIZE = 20;
const PURPOSES = ["visit", "card", "balance"] as const;
const STATUS_TONE: Record<
	string,
	"success" | "warning" | "danger" | "neutral"
> = {
	SUCCESS: "success",
	COMPLETED: "success",
	PENDING_PAYMENT: "warning",
	PENDING: "warning",
	FAILED: "danger",
	CANCELLED: "neutral",
	EXPIRED: "neutral",
	REFUNDED: "neutral",
};

function formatETB(value: string | number) {
	const amount = typeof value === "string" ? Number(value) : value;
	return new Intl.NumberFormat("en-ET", {
		style: "currency",
		currency: "ETB",
	}).format(Number.isFinite(amount) ? amount : 0);
}

function methodLabel(method: string) {
	return PAYMENT_METHOD_LABEL[method] ?? method;
}

function methodTone(method: string) {
	return PAYMENT_METHOD_TONE[method] ?? "neutral";
}

export function PaymentsPage() {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const [page, setPage] = useState(1);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [method, setMethod] = useState("");
	const [purpose, setPurpose] = useState("");
	const [recordedBy, setRecordedBy] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [sort, setSort] = useState<"asc" | "desc">("desc");
	const [manualOpen, setManualOpen] = useState(false);
	const [patientSearch, setPatientSearch] = useState("");
	const [patient, setPatient] = useState<Record<string, unknown> | null>(null);
	const [amount, setAmount] = useState("");
	const [manualPurpose, setManualPurpose] = useState<
		"balance" | "visit" | "card"
	>("balance");
	const [manualMethod, setManualMethod] = useState<"CASH" | "MOBILE_TRANSFER">(
		"CASH",
	);
	const [transferReference, setTransferReference] = useState("");
	const [note, setNote] = useState("");
	const [referenceId, setReferenceId] = useState("");
	const canRecord =
		hasPermission("bills.create") &&
		["RECEPTIONIST", "ADMIN", "OWNER"].includes(session?.role?.name ?? "");
	const canQueue =
		["RECEPTIONIST", "ADMIN", "OWNER", "ACCOUNTANT"].includes(
			session?.role?.name ?? "",
		) && hasPermission("payments.read");

	const paymentsQuery = useQuery({
		queryKey: [
			"payments",
			page,
			search,
			status,
			method,
			purpose,
			recordedBy,
			from,
			to,
			sort,
		],
		queryFn: () =>
			api.get<Paginated<PaymentRow>>("/payments", {
				page,
				pageSize: PAGE_SIZE,
				search: search || undefined,
				status: status || undefined,
				method: method || undefined,
				purpose: purpose || undefined,
				recordedBy: recordedBy || undefined,
				from: from || undefined,
				to: to || undefined,
				sort,
			}),
		refetchInterval: 15_000,
		refetchOnWindowFocus: true,
	});
	const summaryQuery = useQuery({
		queryKey: ["payments-summary"],
		queryFn: () => api.get<PaymentSummary>("/payments/summary"),
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
	});
	const queueQuery = useQuery({
		queryKey: ["payments-queue"],
		queryFn: () =>
			api.get<Paginated<QueueRow>>("/payments/queue", {
				page: 1,
				pageSize: 25,
			}),
		enabled: canQueue,
		refetchInterval: 15_000,
		refetchOnWindowFocus: true,
	});
	const recordersQuery = useQuery({
		queryKey: ["payment-recorders"],
		queryFn: () =>
			api.get<Array<{ id: string; name: string }>>("/payments/recorders"),
	});
	const patientQuery = useQuery({
		queryKey: ["payment-patient-search", patientSearch],
		queryFn: () =>
			api.get<Paginated<Record<string, unknown>>>("/patients", {
				page: 1,
				pageSize: 8,
				search: patientSearch,
			}),
		enabled: manualOpen && !patient && patientSearch.trim().length >= 2,
	});
	const visitQuery = useQuery({
		queryKey: ["payment-visit-search", patient?.id],
		queryFn: () =>
			api.get<Paginated<Record<string, unknown>>>("/appointments", {
				page: 1,
				pageSize: 25,
				patientId: String(patient?.id),
				status: "PENDING_PAYMENT",
			}),
		enabled: manualOpen && manualPurpose === "visit" && Boolean(patient?.id),
	});
	const cardQuery = useQuery({
		queryKey: ["payment-card-plans"],
		queryFn: () =>
			api.get<Array<{ id: string; name: string; price: string; rank: number }>>(
				"/cards",
			),
		enabled: manualOpen && manualPurpose === "card",
	});

	const resetManualForm = () => {
		setPatient(null);
		setPatientSearch("");
		setAmount("");
		setManualPurpose("balance");
		setManualMethod("CASH");
		setTransferReference("");
		setNote("");
		setReferenceId("");
	};

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ["payments"] });
		void queryClient.invalidateQueries({ queryKey: ["payments-summary"] });
		void queryClient.invalidateQueries({ queryKey: ["payments-queue"] });
		void queryClient.invalidateQueries({ queryKey: ["bills"] });
		void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
	};
	const manualMutation = useMutation({
		mutationFn: () => {
			if (!patient) throw new Error("Select a patient first");
			if (manualPurpose === "visit" && !referenceId)
				throw new Error("Select the pending appointment this payment settles");
			if (manualPurpose === "card" && !referenceId)
				throw new Error("Select the membership card plan being purchased");
			if (!amount.trim()) throw new Error("Enter an amount");
			if (manualMethod === "MOBILE_TRANSFER" && !transferReference.trim())
				throw new Error("Transfer reference is required");
			return api.post<{ id: string }>("/payments/manual", {
				patientId: String(patient.id),
				purpose: manualPurpose,
				referenceId: referenceId || undefined,
				amount: amount.trim(),
				method: manualMethod,
				transferReference: transferReference.trim() || undefined,
				note: note.trim() || undefined,
			});
		},
		onSuccess: () => {
			toast.success("Payment recorded");
			setManualOpen(false);
			resetManualForm();
			invalidate();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: "Payment could not be recorded",
			),
	});

	const startChapa = async () => {
		if (!patient) {
			toast.error("Select a patient first");
			return;
		}
		const popup = window.open("about:blank", "_blank");
		if (!popup) {
			toast.error("Allow pop-ups to open Chapa checkout");
			return;
		}
		popup.opener = null;
		try {
			const checkout = await api.post<{ checkout_url: string; tx_ref: string }>(
				"/payments/chapa-for-patient",
				{
					patientId: String(patient.id),
					purpose: manualPurpose,
					referenceId: referenceId || undefined,
					amount: amount.trim() || undefined,
				},
			);
			popup.location.href = checkout.checkout_url;
			toast.success(
				"Chapa checkout opened. The payment log will update after provider verification.",
			);
		} catch (error) {
			popup.close();
			toast.error(
				error instanceof Error
					? error.message
					: "Could not start Chapa checkout",
			);
		}
	};

	const summary = summaryQuery.data;
	const items = paymentsQuery.data?.items ?? [];
	const totalPages = Math.ceil((paymentsQuery.data?.total ?? 0) / PAGE_SIZE);
	const setFilter = (setter: (value: string) => void, value: string) => {
		setPage(1);
		setter(value);
	};

	return (
		<div className="space-y-5">
			<PageHeader
				title="Payments"
				subtitle="Tenant payment ledger, manual receipts and Chapa settlements"
				actions={
					canRecord ? (
						<Button onClick={() => setManualOpen(true)}>Record payment</Button>
					) : null
				}
			/>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{[
					["Collected today", summary?.today],
					["Collected this week", summary?.week],
					["Collected this month", summary?.month],
					["Total collected", summary?.grossCollected],
				].map(([label, value]) => (
					<Card key={label} className="p-4">
						<p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
							{label}
						</p>
						<p className="mt-1 text-xl font-bold text-slate-900">
							{formatETB(value ?? 0)}
						</p>
					</Card>
				))}
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{[
					["Clinic revenue", summary?.totalRevenue],
					["Service charges", summary?.serviceChargesCollected],
					["Chapa", summary?.chapa],
					[
						"Cash / transfer",
						Number(summary?.cash ?? 0) + Number(summary?.transfer ?? 0),
					],
				].map(([label, value]) => (
					<Card key={label} className="p-4">
						<p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
							{label}
						</p>
						<p className="mt-1 text-lg font-semibold text-slate-900">
							{formatETB(value ?? 0)}
						</p>
					</Card>
				))}
			</div>
			<p className="text-xs text-slate-500">
				{summary?.pendingCount ?? 0} pending · {summary?.failedCount ?? 0}{" "}
				failed · {summary?.expiredCount ?? 0} expired ·{" "}
				{summary?.visitCount ?? 0} visits · {summary?.cardCount ?? 0} cards ·{" "}
				{summary?.balanceCount ?? 0} balance payments
			</p>

			{canQueue ? (
				<Card>
					<div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
						<div>
							<h2 className="text-sm font-semibold text-slate-900">
								Payment queue
							</h2>
							<p className="text-xs text-slate-500">
								Chapa checkouts still pending, failed or expired. A lapsed hold
								can no longer be confirmed by the gateway.
							</p>
						</div>
					</div>
					{queueQuery.isLoading ? <Spinner /> : null}
					{queueQuery.error ? (
						<InlineError
							message={
								queueQuery.error instanceof Error
									? queueQuery.error.message
									: "Failed to load the payment queue"
							}
						/>
					) : null}
					{!queueQuery.isLoading &&
					!queueQuery.error &&
					(queueQuery.data?.items ?? []).length === 0 ? (
						<EmptyState
							title="Queue is clear"
							description="No pending, failed or expired Chapa checkouts right now."
							icon={<CreditCard className="size-5" />}
						/>
					) : null}
					{!queueQuery.isLoading &&
					!queueQuery.error &&
					(queueQuery.data?.items ?? []).length > 0 ? (
						<Table>
							<TableHead>
								{[
									"Created",
									"Patient",
									"Purpose",
									"Method",
									"Total",
									"Expires",
									"Status",
									"Tx ref",
								].map((label) => (
									<Th key={label}>{label}</Th>
								))}
							</TableHead>
							<TableBody>
								{(queueQuery.data?.items ?? []).map((row) => (
									<TableRow key={row.id}>
										<Td className="whitespace-nowrap text-slate-500">
											{formatDateTime(row.createdAt)}
										</Td>
										<Td>
											<p className="font-medium text-slate-90">
												{row.patientName ?? "—"}
											</p>
											<p className="text-xs text-slate-500">
												{row.patientPhone ?? ""}
											</p>
										</Td>
										<Td className="capitalize">{row.purpose}</Td>
										<Td>
											<Badge tone={methodTone(row.method)}>
												{methodLabel(row.method)}
											</Badge>
										</Td>
										<Td className="font-semibold">
											{formatETB(row.totalAmount)}
										</Td>
										<Td className="whitespace-nowrap text-slate-500">
											{row.expiresAt ? formatDateTime(row.expiresAt) : "—"}
										</Td>
										<Td>
											<Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
												{row.holdExpired ? "HOLD EXPIRED" : row.status}
											</Badge>
										</Td>
										<Td className="font-mono text-xs text-slate-500">
											{row.txRef ?? "—"}
										</Td>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : null}
				</Card>
			) : null}

			<Card>
				<div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-3 xl:grid-cols-4">
					<label className="relative md:col-span-2">
						<span className="sr-only">Search payments</span>
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
						<Input
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter")
									setFilter(setSearch, searchInput.trim());
							}}
							placeholder="Patient, phone, tx_ref or transfer reference"
							className="pl-9"
						/>
					</label>
					<Select
						aria-label="Payment status"
						value={status}
						onChange={(event) => setFilter(setStatus, event.target.value)}
					>
						<option value="">All statuses</option>
						{[
							"PENDING",
							"SUCCESS",
							"COMPLETED",
							"FAILED",
							"CANCELLED",
							"EXPIRED",
							"REFUNDED",
						].map((value) => (
							<option key={value}>{value}</option>
						))}
					</Select>
					<Select
						aria-label="Payment method"
						value={method}
						onChange={(event) => setFilter(setMethod, event.target.value)}
					>
						<option value="">All methods</option>
						<option value="CHAPA">Chapa</option>
						<option value="CASH">Cash</option>
						<option value="MOBILE_TRANSFER">Transfer</option>
					</Select>
					<Select
						aria-label="Payment purpose"
						value={purpose}
						onChange={(event) => setFilter(setPurpose, event.target.value)}
					>
						<option value="">All purposes</option>
						{PURPOSES.map((value) => (
							<option key={value}>{value}</option>
						))}
					</Select>
					<Select
						aria-label="Recorded by staff"
						value={recordedBy}
						onChange={(event) => setFilter(setRecordedBy, event.target.value)}
					>
						<option value="">All staff</option>
						{(recordersQuery.data ?? []).map((recorder) => (
							<option key={recorder.id} value={recorder.id}>
								{recorder.name}
							</option>
						))}
					</Select>
					<Field label="From">
						<Input
							type="date"
							value={from}
							onChange={(event) => setFilter(setFrom, event.target.value)}
						/>
					</Field>
					<Field label="To">
						<Input
							type="date"
							value={to}
							onChange={(event) => setFilter(setTo, event.target.value)}
						/>
					</Field>
					<Select
						aria-label="Sort by date"
						value={sort}
						onChange={(event) => setSort(event.target.value as "asc" | "desc")}
					>
						<option value="desc">Newest first</option>
						<option value="asc">Oldest first</option>
					</Select>
					<div className="flex items-center">
						<Button
							variant="secondary"
							onClick={() => {
								setSearchInput("");
								setSearch("");
								setStatus("");
								setMethod("");
								setPurpose("");
								setRecordedBy("");
								setFrom("");
								setTo("");
								setPage(1);
							}}
						>
							Clear filters
						</Button>
					</div>
				</div>
				{paymentsQuery.isLoading ? <Spinner /> : null}
				{paymentsQuery.error ? (
					<InlineError
						message={
							paymentsQuery.error instanceof Error
								? paymentsQuery.error.message
								: "Failed to load payments"
						}
					/>
				) : null}
				{!paymentsQuery.isLoading &&
				!paymentsQuery.error &&
				items.length === 0 ? (
					<EmptyState
						title="No payments found"
						description="Payments recorded by reception and Chapa settlements will appear here."
						icon={<CreditCard className="size-5" />}
					/>
				) : null}
				{!paymentsQuery.isLoading &&
				!paymentsQuery.error &&
				items.length > 0 ? (
					<>
						<Table>
							<TableHead>
								{[
									"Date",
									"Patient",
									"Purpose",
									"Method",
									"Base",
									"Service charge",
									"Total",
									"Status",
									"Tx ref",
									"Recorded by",
								].map((label) => (
									<Th key={label}>{label}</Th>
								))}
							</TableHead>
							<TableBody>
								{items.map((payment) => (
									<TableRow key={payment.id}>
										<Td className="whitespace-nowrap text-slate-500">
											{formatDateTime(payment.paidAt ?? payment.createdAt)}
										</Td>
										<Td>
											<p className="font-medium text-slate-900">
												{payment.patientName ?? "—"}
											</p>
											<p className="text-xs text-slate-500">
												{payment.patientPhone ?? ""}
											</p>
										</Td>
										<Td className="capitalize">{payment.purpose}</Td>
										<Td>
											<Badge tone={methodTone(payment.method)}>
												{methodLabel(payment.method)}
											</Badge>
										</Td>
										<Td>{formatETB(payment.baseAmount)}</Td>
										<Td>{formatETB(payment.serviceCharge)}</Td>
										<Td className="font-semibold">
											{formatETB(payment.totalAmount)}
										</Td>
										<Td>
											<Badge tone={STATUS_TONE[payment.status] ?? "neutral"}>
												{payment.status}
											</Badge>
										</Td>
										<Td>{payment.txRef ?? "—"}</Td>
										<Td>{payment.recordedByName ?? "Chapa / system"}</Td>
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

			<Modal
				open={manualOpen}
				onClose={() => setManualOpen(false)}
				title="Record patient payment"
				subtitle="Cash/transfer amounts are entered without a Chapa service charge."
			>
				<div className="space-y-4">
					{patient ? (
						<div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
							<div>
								<p className="font-medium">
									{String(patient.firstName ?? "")}{" "}
									{String(patient.lastName ?? "")}
								</p>
								<p className="text-xs text-slate-500">
									{String(patient.phone ?? "")}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setPatient(null)}
							>
								Change
							</Button>
						</div>
					) : (
						<Field label="Find patient by name or phone">
							<Input
								value={patientSearch}
								onChange={(event) => setPatientSearch(event.target.value)}
								placeholder="Type at least 2 characters"
							/>
							<div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
								{(patientQuery.data?.items ?? []).map((row) => (
									<button
										type="button"
										key={String(row.id)}
										onClick={() => setPatient(row)}
										className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
									>
										{String(row.firstName ?? "")} {String(row.lastName ?? "")} ·{" "}
										{String(row.phone ?? "")}
									</button>
								))}
							</div>
						</Field>
					)}
					<Field label="What is this payment for?">
						<Select
							value={manualPurpose}
							onChange={(event) => {
								setManualPurpose(
									event.target.value as "balance" | "visit" | "card",
								);
								setReferenceId("");
								setAmount("");
							}}
						>
							<option value="balance">Outstanding balance</option>
							<option value="visit">Visit / appointment</option>
							<option value="card">Membership card</option>
						</Select>
					</Field>
					{manualPurpose === "visit" ? (
						<Field
							label="Pending appointment"
							hint="Only unpaid (pending payment) appointments of this patient can be settled."
						>
							{visitQuery.isLoading ? <Spinner /> : null}
							{(visitQuery.data?.items ?? []).length === 0 &&
							!visitQuery.isLoading ? (
								<p className="text-sm text-slate-500">
									No pending appointments for this patient. Book the visit in
									the mobile app or appointments page first.
								</p>
							) : null}
							<div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
								{(visitQuery.data?.items ?? []).map((row) => (
									<button
										type="button"
										key={String(row.id)}
										onClick={() => {
											setReferenceId(String(row.id));
											setAmount("");
										}}
										className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
											referenceId === String(row.id) ? "bg-primary-50" : ""
										}`}
									>
										{formatDateTime(String(row.startAt ?? ""))} ·{" "}
										{String(row.reason ?? "Visit")}
									</button>
								))}
							</div>
						</Field>
					) : null}
					{manualPurpose === "card" ? (
						<Field
							label="Membership card plan"
							hint="The amount is locked to the plan's base price."
						>
							{(cardQuery.data ?? []).length === 0 && !cardQuery.isLoading ? (
								<p className="text-sm text-slate-500">
									No card plans are published for this clinic.
								</p>
							) : null}
							<div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
								{(cardQuery.data ?? []).map((plan) => (
									<button
										type="button"
										key={plan.id}
										onClick={() => {
											setReferenceId(plan.id);
											setAmount(plan.price);
										}}
										className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
											referenceId === plan.id ? "bg-primary-50" : ""
										}`}
									>
										{plan.name} · {plan.price} ETB
									</button>
								))}
							</div>
						</Field>
					) : null}
					{manualPurpose === "balance" ? (
						<Field
							label="Outstanding balance payment"
							hint="Applied to the oldest outstanding bills."
						>
							<Input value="Applied to oldest outstanding bills" disabled />
						</Field>
					) : null}
					<Field
						label="Amount (ETB)"
						hint={
							manualPurpose === "balance"
								? undefined
								: "Must match the selected item's price."
						}
					>
						<Input
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
							inputMode="decimal"
							placeholder="e.g. 250.00"
							disabled={manualPurpose === "card"}
						/>
					</Field>
					<Field label="Method">
						<Select
							value={manualMethod}
							onChange={(event) =>
								setManualMethod(
									event.target.value as "CASH" | "MOBILE_TRANSFER",
								)
							}
						>
							<option value="CASH">Cash</option>
							<option value="MOBILE_TRANSFER">Mobile transfer</option>
						</Select>
					</Field>
					{manualMethod === "MOBILE_TRANSFER" && (
						<Field label="Transfer reference">
							<Input
								value={transferReference}
								onChange={(event) => setTransferReference(event.target.value)}
								required
							/>
						</Field>
					)}
					<Field label="Note (optional)">
						<Input
							value={note}
							onChange={(event) => setNote(event.target.value)}
							maxLength={500}
						/>
					</Field>
					<div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
						<Button
							variant="secondary"
							onClick={() => void startChapa()}
							disabled={!patient}
						>
							<CreditCard className="size-4" /> Pay with Chapa
						</Button>
						<Button
							onClick={() => manualMutation.mutate()}
							loading={manualMutation.isPending}
						>
							<CreditCard className="size-4" /> Record payment
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
