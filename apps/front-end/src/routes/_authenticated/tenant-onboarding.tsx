import { createFileRoute, redirect } from "@tanstack/react-router";
import { TenantOnboardingPage } from "@/features/super-admin/components/tenant-onboarding-page";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/tenant-onboarding")({
	beforeLoad: () => {
		if (!getSession()?.user?.isSuperAdmin)
			throw redirect({ to: "/dashboard", replace: true });
	},
	component: TenantOnboardingPage,
});
