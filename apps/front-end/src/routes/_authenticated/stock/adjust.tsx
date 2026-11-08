import { createFileRoute } from "@tanstack/react-router";

import { AdjustStockPage } from "@/features/stock/components/adjust-stock-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/stock/adjust")({
	beforeLoad: () => requireRoles(["admin", "storekeeper"]),
	component: AdjustStockPage,
});
