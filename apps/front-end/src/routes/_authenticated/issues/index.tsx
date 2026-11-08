import { createFileRoute } from "@tanstack/react-router";

import { IssuesPage } from "@/features/issues/components/issues-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/issues/")({
	beforeLoad: () => requireRoles(["admin", "storekeeper"]),
	component: IssuesPage,
});
