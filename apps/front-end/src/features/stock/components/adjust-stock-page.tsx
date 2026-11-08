import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { api } from "@/lib/api";
import type { Product, StockBalance, StockMovement } from "@/lib/types";

const adjustSchema = z.object({
	product_id: z.string().min(1, "Choose a product"),
	racks: z.coerce
		.number()
		.int("Whole racks only")
		.refine((value) => value !== 0, "Use a non-zero adjustment"),
	note: z.string().trim().min(1, "A note is required").max(500),
});
type AdjustInput = z.input<typeof adjustSchema>;
type AdjustValues = z.output<typeof adjustSchema>;

export function AdjustStockPage() {
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
	} = useForm<AdjustInput, unknown, AdjustValues>({
		resolver: zodResolver(adjustSchema),
		defaultValues: { product_id: "", racks: 1, note: "" },
	});

	// oxlint-disable-next-line react/incompatible-library
	const selectedProductId = watch("product_id");
	const selectedBalance = (balancesQuery.data ?? []).find(
		(row) => row.product.id === selectedProductId,
	);

	const mutation = useMutation({
		mutationFn: (values: AdjustValues) =>
			api.post<StockMovement>("/stock/adjust", {
				product_id: values.product_id,
				racks: values.racks,
				note: values.note.trim(),
			}),
		onSuccess: () => {
			toast.success("Stock adjusted");
			reset({ product_id: "", racks: 1, note: "" });
			void queryClient.invalidateQueries({ queryKey: ["stock"] });
			void queryClient.invalidateQueries({
				queryKey: ["dashboard", "summary"],
			});
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to adjust stock",
			),
	});

	const products = productsQuery.data ?? [];
	const error = productsQuery.error ?? balancesQuery.error;

	return (
		<div className="space-y-5">
			<PageHeader
				title="Stock Adjustments"
				subtitle="Correct a warehouse balance with a mandatory reason"
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
					<CardHeader title="Adjustment" />
					<CardContent>
						{productsQuery.isLoading ? <Spinner /> : null}
						{!productsQuery.isLoading ? (
							<form
								onSubmit={handleSubmit((values) =>
									mutation.mutate(values),
								)}
								className="space-y-4"
							>
								<Field label="Product" error={errors.product_id?.message}>
									<Select {...register("product_id")}>
										<option value="">Choose a product…</option>
										{products.map((product) => (
											<option key={product.id} value={product.id}>
												{product.name} ({product.sku})
											</option>
										))}
									</Select>
								</Field>
								<Field
									label="Racks (+ / −)"
									error={errors.racks?.message}
									hint="Positive adds stock; negative removes stock."
								>
									<Input type="number" {...register("racks")} />
								</Field>
								<Field label="Reason" error={errors.note?.message}>
									<Textarea
										placeholder="e.g. Broken bottles written off after count"
										{...register("note")}
									/>
								</Field>
								<div className="flex items-center justify-end gap-2">
									<Button type="submit" loading={mutation.isPending}>
										<Settings2 className="size-4" /> Apply adjustment
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
