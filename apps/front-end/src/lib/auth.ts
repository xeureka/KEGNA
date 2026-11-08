import { useSyncExternalStore } from "react";

import { api, ApiError } from "@/lib/api";
import type { SessionContext } from "@/lib/types";
import { queryClient } from "@/lib/query";

export class BackendUnavailableError extends Error {
	constructor(
		message = "The CRM backend is unavailable. Start the back-end service and try again.",
	) {
		super(message);
		this.name = "BackendUnavailableError";
	}
}

const STORAGE_KEY = "nexa.session.v1";

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: SessionContext | null = null;
let refreshInFlight: Promise<SessionContext | null> | null = null;

function read(): SessionContext | null {
	if (cached) return cached;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		cached = JSON.parse(raw) as SessionContext;
	} catch {
		cached = null;
	}
	return cached;
}

function write(session: SessionContext | null) {
	const previousTenantId = cached?.tenant.id;
	cached = session;
	if (previousTenantId !== session?.tenant.id) queryClient.clear();
	try {
		if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		// storage unavailable — in-memory fallback only
	}
	listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getSession(): SessionContext | null {
	return read();
}

export function getAccessToken(): string | null {
	return read()?.token ?? null;
}

export function getTenantId(): string | null {
	return read()?.tenant.id ?? null;
}

export function hasPermission(permission: string): boolean {
	return read()?.permissions.includes(permission) ?? false;
}

export function useSession(): { data: SessionContext | null } {
	const session = useSyncExternalStore(subscribe, read, read);
	return { data: session };
}

interface LoginResponse {
	user: SessionContext["user"];
	sessionToken: string;
	tenant?: SessionContext["tenant"];
	membership?: SessionContext["membership"];
	role?: SessionContext["role"];
	permissions?: string[];
}

export async function login(
	email: string,
	password: string,
): Promise<SessionContext> {
	const data = await api.post<LoginResponse>("/auth/login", {
		email,
		password,
	});

	const session: SessionContext = {
		user: data.user,
		tenant: data.tenant ?? { id: "", name: "", slug: "" },
		membership: data.membership ?? { id: "", status: "ACTIVE" },
		role: data.role ?? { name: "" },
		permissions: data.permissions ?? [],
		token: data.sessionToken,
	};

	write(session);
	return session;
}

export function setSession(session: SessionContext) {
	write(session);
}

export async function logout(): Promise<void> {
	try {
		await api.post("/auth/logout");
	} catch {
		// ignore — session is cleared regardless
	}
	write(null);
}

/**
 * Hydrates/validates the stored session against `/auth/me`. Returns the
 * session when valid, otherwise clears storage and returns null.
 */
async function refreshSessionOnce(): Promise<SessionContext | null> {
	const current = read();
	if (!current?.token) return null;
	try {
		const data = await api.get<SessionContext>("/auth/me");
		const session: SessionContext = { ...current, ...data };
		// `/auth/me` is also used by the authenticated route guard. Do not notify
		// every subscriber when the server returned the same session; that can
		// cause dev-mode route remounts and repeated session requests.
		if (JSON.stringify(current) !== JSON.stringify(session)) write(session);
		return session;
	} catch (error) {
		// A rejected network/API request must reach TanStack Router's error
		// boundary. Swallowing it here leaves the authenticated route pending
		// forever when the API is unavailable.
		if (error instanceof ApiError && error.status === 401) {
			write(null);
			return null;
		}
		if (
			error instanceof ApiError &&
			(error.code === "REQUEST_TIMEOUT" || error.status === 504)
		) {
			throw new BackendUnavailableError();
		}
		if (error instanceof TypeError) {
			throw new BackendUnavailableError();
		}
		throw error;
	}
}

/**
 * Route guards can run more than once during a dev navigation/HMR update.
 * Share one validation request so several route matches cannot stampede the
 * remote database with identical Better Auth session lookups.
 */
export function refreshSession(): Promise<SessionContext | null> {
	if (!refreshInFlight) {
		refreshInFlight = refreshSessionOnce().finally(() => {
			refreshInFlight = null;
		});
	}
	return refreshInFlight;
}
