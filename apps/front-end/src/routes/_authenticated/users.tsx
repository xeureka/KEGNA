import { createFileRoute, redirect } from "@tanstack/react-router";

import { UsersPage } from "@/features/staff/components/users-page";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/users")({
	beforeLoad: () => {
		if (getSession()?.role.name !== "OWNER")
			throw redirect({ to: "/dashboard", replace: true });
	},
	component: UsersPage,
});
