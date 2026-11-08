import { createFileRoute, redirect } from "@tanstack/react-router";

import { DashboardPage } from "@/features/dashboard/components/dashboard-page";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
	beforeLoad: () => {
		if (getSession()?.user?.isSuperAdmin)
			throw redirect({ to: "/platform-dashboard", replace: true });
	},
	component: DashboardPage,
});
