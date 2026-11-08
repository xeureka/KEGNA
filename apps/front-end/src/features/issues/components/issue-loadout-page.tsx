import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { api } from "@/lib/api";
import type {
	Issue,
	Product,
	SalesUser,
	StockBalance,
} from "@/lib/types";

const itemSchema = z.object({
	product_id: z.string().min(1, "Choose a product"),
	quantity: z.coerce
		.number()
		.int("Whole racks only")
		.positive("Must be greater than zero"),
});

const schema = z.object({
	sales_user_id: z.string().min(1, "Choose a salesperson"),
	note: z.string().trim().max(500).optional(),
	items: z.array(itemSchema).min(1, "Add at least one product"),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function IssueLoadoutPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const salesQuery = useQuery({
		queryKey: ["users", "sales"],
		queryFn: () => api.get<SalesUser[]>("/users/sales"),
	});
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
		control,
		handleSubmit,
		watch,
		formState: { errors },
	} = useForm<FormInput, unknown, FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			sales_user_id: "",
			note: "",
			items: [{ product_id: "", quantity: 1 }],
		},
	});

	const { fields, append, remove } = useFieldArray({ control, name: "items" });
	// oxlint-disable-next-line react/incompatible-library
	const items = watch("items");

	const products = productsQuery.data ?? [];
	const activeProducts = products.filter((product) => product.isActive);
	const productsById = new Map(products.map((product) => [product.id, product]));
	const balances = balancesQuery.data ?? [];
	const balanceByProduct = new Map(
		balances.map((row) => [row.product.id, Number(row.warehouseBalance)]),
	);
	const totalRacks = items.reduce(
		(total, item) => total + (Number(item.quantity) || 0),
		0,
	);

	const mutation = useMutation({
		mutationFn: (values: FormValues) =>
			api.post<Issue>("/issues", {
				sales_user_id: values.sales_user_id,
				note: values.note?.trim() || undefined,
				items: values.items.map((item) => ({
					product_id: item.product_id,
					quantity: item.quantity,
				})),
			}),
		onSuccess: (issue) => {
			toast.success(`${issue.issueNo} created`);
			void queryClient.invalidateQueries({ queryKey: ["issues"] });
			void queryClient.invalidateQueries({ queryKey: ["stock"] });
			void queryClient.invalidateQueries({
				queryKey: ["dashboard", "summary"],
			});
			navigate({
				to: "/issues/$issueId",
				params: { issueId: issue.id },
			});
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to create load-out",
			),
	});

	const onSubmit = (values: FormValues) => {
		const seen = new Set<string>();
		for (const item of values.items) {
			if (seen.has(item.product_id)) {
				toast.error("Each product may appear only once");
				return;
			}
			seen.add(item.product_id);
			const available = balanceByProduct.get(item.product_id) ?? 0;
			if (item.quantity > available) {
				const product = productsById.get(item.product_id);
				toast.error(
					`Only ${available} racks of ${product?.sku ?? "this product"} are available`,
				);
				return;
			}
		}
		mutation.mutate(values);
	};

	const salesUsers = salesQuery.data ?? [];
	const error =
		salesQuery.error ?? productsQuery.error ?? balancesQuery.error;
	const loading =
		salesQuery.isLoading || productsQuery.isLoading || balancesQuery.isLoading;

	return (
		<div className="space-y-5">
			<PageHeader
				title="Issue Load-out"
				subtitle="Issue racks from the warehouse to a salesperson"
			/>

			{error ? (
				<InlineError
					message={
						error instanceof Error ? error.message : "Failed to load form data"
					}
				/>
			) : null}
			{!salesQuery.isLoading && salesUsers.length === 0 ? (
				<InlineError message="No active salespeople. Ask an administrator to create a sales user first." />
			) : null}

			<Card>
				<CardHeader title="Load-out details" />
				<CardContent>
					{loading ? <Spinner /> : null}
					{!loading ? (
						<form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<Field
									label="Salesperson"
									error={errors.sales_user_id?.message}
								>
									<Select {...register("sales_user_id")}>
										<option value="">Choose a salesperson…</option>
										{salesUsers.map((salesUser) => (
											<option key={salesUser.id} value={salesUser.id}>
												{salesUser.name} ({salesUser.email})
											</option>
										))}
									</Select>
								</Field>
								<Field label="Total racks">
									<div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
										{totalRacks}
									</div>
								</Field>
							</div>

							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<p className="text-sm font-medium text-slate-700">Products</p>
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={() =>
											append({ product_id: "", quantity: 1 })
										}
									>
										<Plus className="size-4" /> Add product
									</Button>
								</div>
								{errors.items?.message ? (
									<p className="text-xs font-medium text-rose-600">
										{errors.items.message}
									</p>
								) : null}

								{fields.map((field, index) => {
									const selected = items[index]?.product_id ?? "";
									const available = balanceByProduct.get(selected) ?? 0;
									const product = productsById.get(selected);
									return (
										<div
											key={field.id}
											className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12"
										>
											<div className="sm:col-span-6">
												<Field
													label="Product"
													error={errors.items?.[index]?.product_id?.message}
												>
													<Select {...register(`items.${index}.product_id`)}>
														<option value="">Choose a product…</option>
														{activeProducts.map((option) => (
															<option key={option.id} value={option.id}>
																{option.name} ({option.sku})
															</option>
														))}
													</Select>
												</Field>
											</div>
											<div className="sm:col-span-3">
												<Field
													label="Racks"
													error={errors.items?.[index]?.quantity?.message}
												>
													<Input
														type="number"
														min={1}
														{...register(`items.${index}.quantity`)}
													/>
												</Field>
											</div>
											<div className="flex items-end justify-between gap-2 sm:col-span-3">
												<div className="pb-2 text-xs text-slate-500">
													{selected ? (
														<>
															Available:{" "}
															<span className="font-medium text-slate-700">
																{available}
															</span>
															{product ? (
																<span className="ml-2 font-mono">
																	{product.sku}
																</span>
															) : null}
														</>
													) : (
														"Choose a product"
													)}
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													title="Remove product"
													disabled={fields.length === 1}
													onClick={() => remove(index)}
												>
													<Trash2 className="size-4" />
												</Button>
											</div>
										</div>
									);
								})}
							</div>

							<Field label="Note" error={errors.note?.message}>
								<Textarea
									placeholder="Optional note for this load-out"
									{...register("note")}
								/>
							</Field>

							<div className="flex items-center justify-end gap-2">
								<Button
									type="submit"
									loading={mutation.isPending}
									disabled={salesUsers.length === 0}
								>
									Create load-out
								</Button>
							</div>
						</form>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
