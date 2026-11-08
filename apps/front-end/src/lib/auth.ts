import { redirect } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import { api, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query";
import type { RoleName, SessionContext, SessionUser } from "@/lib/types";

export class BackendUnavailableError extends Error {
	constructor(
		message = "The WAI backend is unavailable. Start the back-end service and try again.",
	) {
		super(message);
		this.name = "BackendUnavailableError";
	}
}

const STORAGE_KEY = "zola.session.v1";
const WEB_ROLES: RoleName[] = ["admin", "storekeeper", "warehouse_manager"];
const VALID_ROLES: RoleName[] = [
	"admin",
	"storekeeper",
	"sales",
	"accountant",
	"warehouse_manager",
	"finance",
];

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: SessionContext | null = null;
let refreshInFlight: Promise<SessionContext | null> | null = null;

function normalizeRole(value: string | null | undefined): RoleName {
	return VALID_ROLES.includes(value as RoleName)
		? (value as RoleName)
		: "sales";
}

function read(): SessionContext | null {
	if (cached) return cached;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SessionContext;
		if (!parsed?.token || !parsed?.user?.id) return null;
		cached = {
			...parsed,
			user: { ...parsed.user, role: normalizeRole(parsed.user.role) },
			role: normalizeRole(parsed.role),
		};
	} catch {
		cached = null;
	}
	return cached;
}

function write(session: SessionContext | null) {
	const previousUserId = cached?.user.id;
	cached = session;
	if (previousUserId !== session?.user.id) queryClient.clear();
	try {
		if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		// storage unavailable — in-memory fallback only
	}
	listeners.forEach((listener) => listener());
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

export function getRole(): RoleName | null {
	return read()?.role ?? null;
}

export function hasPermission(permission: string): boolean {
	return read()?.permissions.includes(permission) ?? false;
}

export function useSession(): { data: SessionContext | null } {
	const session = useSyncExternalStore(subscribe, read, read);
	return { data: session };
}

export function isWebRole(role: RoleName | null | undefined): boolean {
	return role === "admin" || role === "storekeeper" || role === "warehouse_manager";
}

export function requireRoles(roles: RoleName[]): void {
	const session = getSession();
	if (!session || !roles.includes(session.role)) {
		throw redirect({ to: "/dashboard", replace: true });
	}
}

interface AuthResponse {
	user: SessionUser & { role?: string | null };
	sessionToken: string;
	permissions?: string[];
}

function toSession(data: AuthResponse, token: string): SessionContext {
	const role = normalizeRole(data.user.role);
	return {
		user: {
			id: data.user.id,
			name: data.user.name,
			email: data.user.email,
			role,
		},
		role,
		permissions: data.permissions ?? [],
		token,
	};
}

export async function login(
	email: string,
	password: string,
): Promise<SessionContext> {
	const data = await api.post<AuthResponse>("/auth/login", {
		email,
		password,
	});
	const session = toSession(data, data.sessionToken);

	if (!WEB_ROLES.includes(session.role)) {
		throw new Error(
			"This web dashboard is for administrators and storekeepers. Sales and accountants should use the WAI mobile app.",
		);
	}

	write(session);
	return session;
}

export async function logout(): Promise<void> {
	try {
		await api.post("/auth/logout");
	} catch {
		// ignore — session is cleared regardless
	}
	write(null);
}

async function refreshSessionOnce(): Promise<SessionContext | null> {
	const current = read();
	if (!current?.token) return null;
	try {
		const data = await api.get<AuthResponse>("/auth/me");
		const session = toSession(data, data.sessionToken || current.token);
		if (JSON.stringify(current) !== JSON.stringify(session)) write(session);
		return session;
	} catch (error) {
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

export function refreshSession(): Promise<SessionContext | null> {
	if (!refreshInFlight) {
		refreshInFlight = refreshSessionOnce().finally(() => {
			refreshInFlight = null;
		});
	}
	return refreshInFlight;
}
