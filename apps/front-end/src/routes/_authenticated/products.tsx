import { createFileRoute } from "@tanstack/react-router";

import { ProductsPage } from "@/features/products/components/products-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/products")({
	beforeLoad: () => requireRoles(["admin"]),
	component: ProductsPage,
});
