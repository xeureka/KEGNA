import { createFileRoute } from "@tanstack/react-router";

import { UsersPage } from "@/features/users/components/users-page";
import { requireRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/users")({
	beforeLoad: () => requireRoles(["admin"]),
	component: UsersPage,
});
