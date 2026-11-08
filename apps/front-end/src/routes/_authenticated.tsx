import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { refreshSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const session = await refreshSession();
		if (!session) throw redirect({ to: "/login" });
	},
	component: AppShell,
});
