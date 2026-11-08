import { createFileRoute, redirect } from "@tanstack/react-router";
import { PlatformUsersPage } from "@/features/super-admin/components/platform-users-page";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/platform-users")({
	beforeLoad: () => {
		if (!getSession()?.user?.isSuperAdmin)
			throw redirect({ to: "/dashboard", replace: true });
	},
	component: PlatformUsersPage,
});
