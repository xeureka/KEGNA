import { createFileRoute } from "@tanstack/react-router";

import { IssueLoadoutPage } from "@/features/issues/components/issue-loadout-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/issues/new")({
	beforeLoad: () => requireRoles(["admin", "storekeeper"]),
	component: IssueLoadoutPage,
});
