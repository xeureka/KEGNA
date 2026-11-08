import { createFileRoute, Navigate } from "@tanstack/react-router";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/")({
	component: () => (
		<Navigate
			to={
				getSession()?.user?.isSuperAdmin ? "/platform-dashboard" : "/dashboard"
			}
			replace
		/>
	),
});
