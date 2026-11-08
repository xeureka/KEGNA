import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { authClient } from "../api/auth-client";
import {
	getSession,
	logoutApi,
	setMobileAccessToken,
	setUnauthorizedHandler,
} from "../api/client";
import type { SessionData } from "../types";

type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
	status: AuthStatus;
	session: SessionData | null;
	signIn: (email: string, password: string) => Promise<SessionData>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [status, setStatus] = useState<AuthStatus>("loading");
	const [session, setSession] = useState<SessionData | null>(null);

	const clearSession = useCallback(() => {
		setMobileAccessToken(null);
		setSession(null);
		setStatus("signedOut");
	}, []);

	useEffect(() => {
		setUnauthorizedHandler(clearSession);
		return () => setUnauthorizedHandler(null);
	}, [clearSession]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const next = await getSession();
				if (cancelled) return;
				setMobileAccessToken(next.sessionToken);
				setSession(next);
				setStatus("signedIn");
			} catch {
				if (!cancelled) clearSession();
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [clearSession]);

	const signIn = useCallback(async (email: string, password: string) => {
		const result = await authClient.signIn.email({
			email: email.trim(),
			password,
		});
		if (result.error) {
			throw new Error(result.error.message ?? "Sign-in failed");
		}
		const token = result.data?.token;
		if (token) setMobileAccessToken(token);
		const next = await getSession();
		setMobileAccessToken(next.sessionToken);
		setSession(next);
		setStatus("signedIn");
		return next;
	}, []);

	const signOut = useCallback(async () => {
		try {
			await logoutApi();
		} catch {
			// The local session is cleared even when the server is unreachable.
		}
		try {
			await authClient.signOut();
		} catch {
			// Better Auth clears its local cache on the next request.
		}
		clearSession();
	}, [clearSession]);

	const value = useMemo(
		() => ({ status, session, signIn, signOut }),
		[status, session, signIn, signOut],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const value = useContext(AuthContext);
	if (!value) throw new Error("useAuth must be used inside AuthProvider");
	return value;
}
