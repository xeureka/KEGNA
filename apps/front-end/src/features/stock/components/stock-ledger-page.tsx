import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
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
import { MOVEMENT_TYPE_TONE } from "@/lib/status";
import type { MovementType, Product, StockMovement } from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/utils";

const PAGE_SIZE = 50;
const TYPES: MovementType[] = [
	"receive",
	"issue",
	"return",
	"damage",
	"adjustment",
];

function isoStart(date: string) {
	return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function isoEnd(date: string) {
	return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
}

function Delta({ value }: { value: number }) {
	if (value === 0) return <span className="text-slate-400">0</span>;
	return (
		<span className={value > 0 ? "text-emerald-600" : "text-rose-600"}>
			{value > 0 ? "+" : ""}
			{value}
		</span>
	);
}

export function StockLedgerPage() {
	const [productId, setProductId] = useState("");
	const [type, setType] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [page, setPage] = useState(1);

	const productsQuery = useQuery({
		queryKey: ["products"],
		queryFn: () => api.get<Product[]>("/products"),
	});

	const movementsQuery = useQuery({
		queryKey: ["stock", "movements", productId, type, from, to, page],
		queryFn: () =>
			api.get<StockMovement[]>("/stock/movements", {
				product_id: productId || undefined,
				type: type || undefined,
				from: isoStart(from),
				to: isoEnd(to),
				limit: PAGE_SIZE,
				offset: (page - 1) * PAGE_SIZE,
			}),
	});

	const products = productsQuery.data ?? [];
	const productsById = new Map(products.map((product) => [product.id, product]));
	const movements = movementsQuery.data ?? [];
	const hasFilters = Boolean(productId || type || from || to);

	const resetPage = () => setPage(1);

	const clearFilters = () => {
		setProductId("");
		setType("");
		setFrom("");
		setTo("");
		setPage(1);
	};

	const error = productsQuery.error ?? movementsQuery.error;

	return (
		<div className="space-y-5">
			<PageHeader
				title="Stock Ledger"
				subtitle="Append-only record of every warehouse and holder movement"
			/>

			<Card>
				<div className="grid grid-cols-1 gap-3 border-b border-slate-200 px-4 py-4 sm:grid-cols-2 lg:grid-cols-5">
					<Field label="Product">
						<Select
							value={productId}
							onChange={(event) => {
								setProductId(event.target.value);
								resetPage();
							}}
						>
							<option value="">All products</option>
							{products.map((product) => (
								<option key={product.id} value={product.id}>
									{product.name}
								</option>
							))}
						</Select>
					</Field>
					<Field label="Type">
						<Select
							value={type}
							onChange={(event) => {
								setType(event.target.value);
								resetPage();
							}}
						>
							<option value="">All types</option>
							{TYPES.map((movementType) => (
								<option key={movementType} value={movementType}>
									{titleCase(movementType)}
								</option>
							))}
						</Select>
					</Field>
					<Field label="From">
						<Input
							type="date"
							value={from}
							onChange={(event) => {
								setFrom(event.target.value);
								resetPage();
							}}
						/>
					</Field>
					<Field label="To">
						<Input
							type="date"
							value={to}
							onChange={(event) => {
								setTo(event.target.value);
								resetPage();
							}}
						/>
					</Field>
					<div className="flex items-end">
						<Button
							variant="secondary"
							onClick={clearFilters}
							disabled={!hasFilters}
						>
							<X className="size-4" /> Clear
						</Button>
					</div>
				</div>

				{error ? (
					<InlineError
						message={
							error instanceof Error ? error.message : "Failed to load ledger"
						}
					/>
				) : null}
				{movementsQuery.isLoading ? <Spinner /> : null}

				{!movementsQuery.isLoading &&
				!movementsQuery.error &&
				movements.length === 0 ? (
					<EmptyState
						title="No movements found"
						description="Receive stock or issue a load-out to populate the ledger."
					/>
				) : null}

				{!movementsQuery.isLoading &&
				!movementsQuery.error &&
				movements.length > 0 ? (
					<>
						<Table>
							<TableHead>
								<Th>When</Th>
								<Th>Product</Th>
								<Th>Type</Th>
								<Th className="text-right">Warehouse</Th>
								<Th className="text-right">Holder</Th>
								<Th>Batch / reference</Th>
								<Th>Note</Th>
							</TableHead>
							<TableBody>
								{movements.map((movement) => {
									const product = productsById.get(movement.productId);
									return (
										<TableRow key={movement.id}>
											<Td className="whitespace-nowrap text-slate-500">
												{formatDateTime(movement.createdAt)}
											</Td>
											<Td className="font-medium whitespace-nowrap text-slate-900">
												{product?.name ?? "Unknown product"}
											</Td>
											<Td>
												<Badge
													tone={
														MOVEMENT_TYPE_TONE[movement.type] ?? "neutral"
													}
												>
													{titleCase(movement.type)}
												</Badge>
											</Td>
											<Td className="text-right font-semibold">
												<Delta value={movement.warehouseDelta} />
											</Td>
											<Td className="text-right font-semibold">
												<Delta value={movement.holderDelta} />
											</Td>
											<Td className="text-slate-600">
												{movement.batchNo ?? movement.reference ?? "—"}
											</Td>
											<Td className="max-w-56 text-slate-500">
												{movement.note ?? "—"}
												{movement.issueId ? (
													<Link
														to="/issues/$issueId"
														params={{ issueId: movement.issueId }}
														className="ml-2 text-xs font-medium text-primary-700 hover:underline"
													>
														Issue
													</Link>
												) : null}
											</Td>
										</TableRow>
									);
								})}
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
									disabled={movements.length < PAGE_SIZE}
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
