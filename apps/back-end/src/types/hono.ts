import type { auth } from "../lib/auth";
import type { Tenant, TenantMembership, Role } from "../db/schema";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

export interface AppVariables {
	user: AuthUser | null;
	session: AuthSession | null;
	tenant: Tenant | null;
	tenantId: string | null;
	membership: TenantMembership | null;
	role: Role | null;
	permissions: string[] | null;
	doctorId: string | null;
}

export type AppEnv = {
	Variables: AppVariables;
};
