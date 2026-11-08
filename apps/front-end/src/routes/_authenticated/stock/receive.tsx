import { createFileRoute } from "@tanstack/react-router";

import { ReceiveStockPage } from "@/features/stock/components/receive-stock-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/stock/receive")({
	beforeLoad: () => requireRoles(["admin", "storekeeper"]),
	component: ReceiveStockPage,
});
