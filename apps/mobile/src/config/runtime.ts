import Constants from "expo-constants";
import { tenantConfig } from "../../config/tenant.config";

function hostFromExpo() {
	const hostUri =
		Constants.expoConfig?.hostUri ??
		(
			Constants.manifest2 as {
				extra?: { expoGo?: { debuggerHost?: string } };
			} | null
		)?.extra?.expoGo?.debuggerHost;
	if (!hostUri) return null;
	const host = hostUri
		.replace(/^exp:\/\//, "")
		.replace(/^https?:\/\//, "")
		.replace(/^\[|\]$/g, "")
		.split(":")[0]
		.split("/")[0];
	return host || null;
}

function hostFromWeb() {
	// React Native can expose `window` without providing browser location.
	// Never let diagnostics crash an API request on Android/iOS.
	const location = typeof window !== "undefined" ? window.location : undefined;
	return location?.hostname || null;
}

/**
 * Production/EAS and tunnel builds must provide EXPO_PUBLIC_API_URL.
 * In normal Metro development, Expo tells us which machine served the bundle;
 * the API is on that same machine, using the back-end service's port 3001.
 */
export function getApiBaseUrl() {
	const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
	if (explicit) return explicit.replace(/\/$/, "");

	if (__DEV__) {
		const host = hostFromExpo() ?? hostFromWeb();
		if (host) return `http://${host}:3001`;
		// Better Auth is created during module loading. Keep development startup
		// alive if Expo has not exposed its host yet; the request will surface a
		// normal connectivity error instead of crashing the whole app.
		return "http://localhost:3001";
	}

	throw new Error(
		"CRM API URL is unavailable. Set EXPO_PUBLIC_API_URL for a production build or tunnel development.",
	);
}

export function getApiHostDiagnostics() {
	return {
		explicitOverride: Boolean(process.env.EXPO_PUBLIC_API_URL?.trim()),
		expoHostUri: Constants.expoConfig?.hostUri ?? null,
		derivedHost: hostFromExpo(),
		webHost: hostFromWeb(),
		apiBaseUrl: (() => {
			try {
				return getApiBaseUrl();
			} catch {
				return null;
			}
		})(),
	};
}

export function getTenantRuntimeConfig() {
	return { ...tenantConfig, apiBaseUrl: getApiBaseUrl() };
}
