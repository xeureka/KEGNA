import { createFileRoute } from "@tanstack/react-router";

import { BillsPage } from "@/features/billing/components/bills-page";

export const Route = createFileRoute("/_authenticated/bills")({
	component: BillsPage,
});
