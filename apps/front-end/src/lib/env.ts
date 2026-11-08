/** Backend origin, injected at build time from `VITE_API_URL`. */
const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

/** Trailing slash stripped so `${API_BASE_URL}${path}` never double-slashes. */
const API_ORIGIN = RAW_API_URL.trim().replace(/\/+$/, "");

function isNativePlatform(): boolean {
	if (typeof window === "undefined") return false;
	const capacitor = (
		window as unknown as {
			Capacitor?: { isNativePlatform?: () => boolean };
		}
	).Capacitor;
	return typeof capacitor?.isNativePlatform === "function"
		? capacitor.isNativePlatform()
		: false;
}

/** API origin; empty means same-origin (web dev, where Vite proxies `/api`). */
export const API_BASE_URL: string = API_ORIGIN;

/**
 * Absolute origin Better Auth posts to. When left empty Better Auth falls back
 * to `window.location.origin`, which sends sign-in/sign-up/session requests to
 * the frontend instead of the API — so only fall back to the same origin in web
 * dev, where the Vite proxy forwards `/api` to the backend.
 */
export const AUTH_BASE_URL: string =
	API_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");

if (!API_ORIGIN && (import.meta.env.PROD || isNativePlatform())) {
	console.error(
		"VITE_API_URL is not set — auth and API requests will be sent to this app's own origin instead of the backend.",
	);
}

/** Resolves backend-relative paths (e.g. `/uploads/...`) to absolute URLs. */
export function absoluteApiUrl(path: string | null | undefined): string {
	if (!path) return "";
	if (/^https?:\/\//.test(path)) return path;
	return `${API_BASE_URL}${path}`;
}
