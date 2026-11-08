import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PlatformDashboard } from "@/features/dashboard/components/dashboard-page";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import type { PlatformTenant } from "@/lib/types";

// oxlint-disable-next-line react/only-export-components
function PlatformDashboardRoute() {
	const query = useQuery({
		queryKey: ["platform-tenants"],
		queryFn: () => api.get<PlatformTenant[]>("/super-admin/tenants"),
	});
	return <PlatformDashboard query={query} />;
}

export const Route = createFileRoute("/_authenticated/platform-dashboard")({
	beforeLoad: () => {
		if (!getSession()?.user?.isSuperAdmin)
			throw redirect({ to: "/dashboard", replace: true });
	},
	component: PlatformDashboardRoute,
});
