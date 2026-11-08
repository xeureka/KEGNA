import { createFileRoute } from "@tanstack/react-router";

import { StockLedgerPage } from "@/features/stock/components/stock-ledger-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/stock/ledger")({
	beforeLoad: () => requireRoles(["admin", "storekeeper"]),
	component: StockLedgerPage,
});
