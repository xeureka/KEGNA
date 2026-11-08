import { createFileRoute, redirect } from "@tanstack/react-router";

import { ReportsPage } from "@/features/reports/components/reports-page";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/reports")({
	beforeLoad: () => {
		const session = getSession();
		const role = session?.role?.name;
		if (
			session?.user?.isSuperAdmin ||
			(role !== "OWNER" && role !== "ACCOUNTANT" && role !== "RECEPTIONIST")
		) {
			throw redirect({ to: "/dashboard", replace: true });
		}
	},
	component: ReportsPage,
});
