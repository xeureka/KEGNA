import { createFileRoute } from "@tanstack/react-router";

import { IssueDetailPage } from "@/features/issues/components/issue-detail-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/issues/$issueId")({
	beforeLoad: () => requireRoles(["admin", "storekeeper"]),
	component: IssueDetailPage,
});
