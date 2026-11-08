import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
	EmptyState,
	InlineError,
	PageHeader,
	Spinner,
} from "@/components/ui/page";
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
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const productSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(200),
	sku: z.string().trim().min(1, "SKU is required").max(80),
	bottlesPerRack: z.coerce
		.number()
		.int("Whole bottles only")
		.positive("Must be greater than zero"),
	pricePerRack: z
		.string()
		.trim()
		.regex(/^\d+(?:\.\d{1,2})?$/, "Use a positive amount with up to 2 decimals"),
	isActive: z.boolean(),
});

type ProductFormInput = z.input<typeof productSchema>;
type ProductFormValues = z.output<typeof productSchema>;

export function ProductsPage() {
	const queryClient = useQueryClient();
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<Product | null>(null);

	const productsQuery = useQuery({
		queryKey: ["products"],
		queryFn: () => api.get<Product[]>("/products"),
	});

	const products = productsQuery.data ?? [];
	const { sorted, key, dir, toggle } = useSort(products, "name");

	const openCreate = () => {
		setEditing(null);
		setFormOpen(true);
	};

	const openEdit = (product: Product) => {
		setEditing(product);
		setFormOpen(true);
	};

	return (
		<div className="space-y-5">
			<PageHeader
				title="Products"
				subtitle="Beer products, rack sizes and current prices"
				actions={
					<Button onClick={openCreate}>
						<Plus className="size-4" /> New product
					</Button>
				}
			/>

			<Card>
				{productsQuery.isLoading ? <Spinner /> : null}
				{productsQuery.error ? (
					<InlineError
						message={
							productsQuery.error instanceof Error
								? productsQuery.error.message
								: "Failed to load products"
						}
					/>
				) : null}

				{!productsQuery.isLoading && !productsQuery.error && products.length === 0 ? (
					<EmptyState
						title="No products yet"
						description="Create the products the warehouse receives and issues."
						action={
							<Button onClick={openCreate}>
								<Plus className="size-4" /> New product
							</Button>
						}
					/>
				) : null}

				{!productsQuery.isLoading &&
				!productsQuery.error &&
				products.length > 0 ? (
					<Table>
						<TableHead>
							<SortableTh field="name" sortKey={key} sortDir={dir} onSort={toggle}>
								Product
							</SortableTh>
							<SortableTh field="sku" sortKey={key} sortDir={dir} onSort={toggle}>
								SKU
							</SortableTh>
							<SortableTh
								field="bottlesPerRack"
								sortKey={key}
								sortDir={dir}
								onSort={toggle}
							>
								Bottles / rack
							</SortableTh>
							<SortableTh
								field="pricePerRack"
								sortKey={key}
								sortDir={dir}
								onSort={toggle}
							>
								Price / rack
							</SortableTh>
							<SortableTh
								field="isActive"
								sortKey={key}
								sortDir={dir}
								onSort={toggle}
							>
								Status
							</SortableTh>
							<Th className="text-right">Actions</Th>
						</TableHead>
						<TableBody>
							{sorted.map((product) => (
								<TableRow key={product.id}>
									<Td className="font-medium text-slate-900">
										{product.name}
									</Td>
									<Td className="font-mono text-xs text-slate-500">
										{product.sku}
									</Td>
									<Td className="text-slate-600">{product.bottlesPerRack}</Td>
									<Td className="text-slate-700">
										{formatCurrency(product.pricePerRack)}
									</Td>
									<Td>
										<Badge tone={product.isActive ? "success" : "neutral"}>
											{product.isActive ? "Active" : "Inactive"}
										</Badge>
									</Td>
									<Td className="text-right">
										<Button
											variant="secondary"
											size="sm"
											onClick={() => openEdit(product)}
										>
											<Pencil className="size-3.5" /> Edit
										</Button>
									</Td>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : null}
			</Card>

			<ProductFormModal
				open={formOpen}
				product={editing}
				onClose={() => setFormOpen(false)}
				onSaved={() => {
					setFormOpen(false);
					void queryClient.invalidateQueries({ queryKey: ["products"] });
					void queryClient.invalidateQueries({
						queryKey: ["dashboard", "summary"],
					});
				}}
			/>
		</div>
	);
}

function ProductFormModal({
	open,
	product,
	onClose,
	onSaved,
}: {
	open: boolean;
	product: Product | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ProductFormInput, unknown, ProductFormValues>({
		resolver: zodResolver(productSchema),
		defaultValues: {
			name: "",
			sku: "",
			bottlesPerRack: 24,
			pricePerRack: "0.00",
			isActive: true,
		},
	});

	useEffect(() => {
		if (!open) return;
		reset(
			product
				? {
						name: product.name,
						sku: product.sku,
						bottlesPerRack: product.bottlesPerRack,
						pricePerRack: product.pricePerRack,
						isActive: product.isActive,
					}
				: {
						name: "",
						sku: "",
						bottlesPerRack: 24,
						pricePerRack: "0.00",
						isActive: true,
					},
		);
	}, [open, product, reset]);

	const mutation = useMutation({
		mutationFn: (values: ProductFormValues) => {
			const body = {
				name: values.name.trim(),
				sku: values.sku.trim().toUpperCase(),
				bottles_per_rack: values.bottlesPerRack,
				price_per_rack: values.pricePerRack,
				is_active: values.isActive,
			};
			return product
				? api.patch<Product>(`/products/${product.id}`, body)
				: api.post<Product>("/products", body);
		},
		onSuccess: () => {
			toast.success(product ? "Product updated" : "Product created");
			onSaved();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to save product",
			),
	});

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={product ? "Edit product" : "New product"}
			subtitle="Rack sizes and prices are used on load-outs and reports."
		>
			<form
				onSubmit={handleSubmit((values) => mutation.mutate(values))}
				className="space-y-4"
			>
				<Field label="Name" error={errors.name?.message}>
					<Input placeholder="St. George Lager 330ml" {...register("name")} />
				</Field>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field label="SKU" error={errors.sku?.message}>
						<Input placeholder="STG-330" {...register("sku")} />
					</Field>
					<Field label="Bottles per rack" error={errors.bottlesPerRack?.message}>
						<Input type="number" min={1} {...register("bottlesPerRack")} />
					</Field>
				</div>
				<Field
					label="Price per rack (ETB)"
					error={errors.pricePerRack?.message}
				>
					<Input
						inputMode="decimal"
						placeholder="2100.00"
						{...register("pricePerRack")}
					/>
				</Field>
				<label className="flex cursor-pointer items-center gap-2 select-none">
					<input type="checkbox" className="size-4" {...register("isActive")} />
					<span className="text-sm text-slate-700">
						Active — available for new load-outs
					</span>
				</label>
				<div className="flex items-center justify-end gap-2 pt-1">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={mutation.isPending}>
						{product ? "Save changes" : "Create product"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
