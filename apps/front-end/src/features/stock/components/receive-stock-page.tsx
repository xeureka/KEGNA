import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { api } from "@/lib/api";
import type { Product, StockBalance, StockMovement } from "@/lib/types";

const receiveSchema = z.object({
	product_id: z.string().min(1, "Choose a product"),
	racks: z.coerce
		.number()
		.int("Whole racks only")
		.positive("Must be greater than zero"),
	batch_no: z.string().trim().max(120).optional(),
	expiry_date: z.string().optional(),
	reference: z.string().trim().max(200).optional(),
});
type ReceiveInput = z.input<typeof receiveSchema>;
type ReceiveValues = z.output<typeof receiveSchema>;

export function ReceiveStockPage() {
	const queryClient = useQueryClient();

	const productsQuery = useQuery({
		queryKey: ["products"],
		queryFn: () => api.get<Product[]>("/products"),
	});
	const balancesQuery = useQuery({
		queryKey: ["stock", "balances"],
		queryFn: () => api.get<StockBalance[]>("/stock/balances"),
	});

	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<ReceiveInput, unknown, ReceiveValues>({
		resolver: zodResolver(receiveSchema),
		defaultValues: {
			product_id: "",
			racks: 1,
			batch_no: "",
			expiry_date: "",
			reference: "",
		},
	});

	// oxlint-disable-next-line react/incompatible-library
	const selectedProductId = watch("product_id");
	const selectedBalance = (balancesQuery.data ?? []).find(
		(row) => row.product.id === selectedProductId,
	);

	const mutation = useMutation({
		mutationFn: (values: ReceiveValues) =>
			api.post<StockMovement>("/stock/receive", {
				product_id: values.product_id,
				racks: values.racks,
				batch_no: values.batch_no?.trim() || undefined,
				expiry_date: values.expiry_date || undefined,
				reference: values.reference?.trim() || undefined,
			}),
		onSuccess: () => {
			toast.success("Stock received");
			reset({
				product_id: "",
				racks: 1,
				batch_no: "",
				expiry_date: "",
				reference: "",
			});
			void queryClient.invalidateQueries({ queryKey: ["stock"] });
			void queryClient.invalidateQueries({
				queryKey: ["dashboard", "summary"],
			});
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to receive stock",
			),
	});

	const products = productsQuery.data ?? [];
	const error = productsQuery.error ?? balancesQuery.error;

	return (
		<div className="space-y-5">
			<PageHeader
				title="Receive Stock"
				subtitle="Record a delivery into the warehouse ledger"
			/>

			{error ? (
				<InlineError
					message={
						error instanceof Error ? error.message : "Failed to load products"
					}
				/>
			) : null}

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader title="Delivery details" />
					<CardContent>
						{productsQuery.isLoading ? <Spinner /> : null}
						{!productsQuery.isLoading ? (
							<form
								onSubmit={handleSubmit((values) =>
									mutation.mutate(values),
								)}
								className="grid grid-cols-1 gap-4 sm:grid-cols-2"
							>
								<Field
									label="Product"
									error={errors.product_id?.message}
									className="sm:col-span-2"
								>
									<Select {...register("product_id")}>
										<option value="">Choose a product…</option>
										{products.map((product) => (
											<option key={product.id} value={product.id}>
												{product.name} ({product.sku})
											</option>
										))}
									</Select>
								</Field>
								<Field label="Racks received" error={errors.racks?.message}>
									<Input type="number" min={1} {...register("racks")} />
								</Field>
								<Field label="Batch number" error={errors.batch_no?.message}>
									<Input placeholder="Optional" {...register("batch_no")} />
								</Field>
								<Field label="Expiry date" error={errors.expiry_date?.message}>
									<Input type="date" {...register("expiry_date")} />
								</Field>
								<Field label="Reference" error={errors.reference?.message}>
									<Input
										placeholder="Delivery note or supplier doc"
										{...register("reference")}
									/>
								</Field>
								<div className="flex items-center justify-end gap-2 sm:col-span-2">
									<Button type="submit" loading={mutation.isPending}>
										<ArrowDownToLine className="size-4" /> Receive stock
									</Button>
								</div>
							</form>
						) : null}
					</CardContent>
				</Card>

				<Card className="h-fit">
					<CardHeader title="Current balance" />
					<CardContent>
						{selectedProductId ? (
							selectedBalance ? (
								<>
									<p className="text-sm font-medium text-slate-900">
										{selectedBalance.product.name}
									</p>
									<p className="mt-1 text-xs text-slate-500">
										{selectedBalance.product.sku}
									</p>
									<p className="mt-4 text-3xl font-semibold text-slate-900">
										{Number(selectedBalance.warehouseBalance)}
									</p>
									<p className="text-xs text-slate-500">
										racks in warehouse right now
									</p>
								</>
							) : (
								<p className="text-sm text-slate-500">
									Loading the selected balance…
								</p>
							)
						) : (
							<p className="text-sm text-slate-500">
								Choose a product to see its current warehouse balance.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
