import type { auth } from "@/lib/auth";

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;

export interface AppVariables {
	user: AuthUser | null;
	session: AuthSession | null;
}

export type AppEnv = { Variables: AppVariables };
