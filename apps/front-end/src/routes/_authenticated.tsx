import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { getSession, refreshSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		// Super Admin sessions are platform-scoped and intentionally have no
		// tenant header/membership. Preserve the authenticated login result so a
		// tenant-oriented session refresh cannot redirect the platform user away.
		if (getSession()?.user?.isSuperAdmin) return;
		const session = await refreshSession();
		if (!session) throw redirect({ to: "/login" });
	},
	component: AppShell,
});
