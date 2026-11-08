import { createFileRoute, redirect } from "@tanstack/react-router";

import { TipsPage } from "@/features/tips/components/tips-page";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/tips")({
	beforeLoad: () => {
		const role = getSession()?.role.name;
		if (role !== "OWNER" && role !== "ADMIN")
			throw redirect({ to: "/dashboard", replace: true });
	},
	component: TipsPage,
});
