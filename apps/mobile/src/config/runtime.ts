import Constants from "expo-constants";

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
	const location = typeof window !== "undefined" ? window.location : undefined;
	return location?.hostname || null;
}

/**
 * Production/EAS builds must provide EXPO_PUBLIC_API_URL. In normal Metro
 * development Expo tells us which machine served the bundle; the API listens
 * on that same machine on port 3001.
 */
export function getApiBaseUrl() {
	const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
	if (explicit) return normalizeApiOrigin(explicit);

	if (__DEV__) {
		const host = hostFromExpo() ?? hostFromWeb();
		if (host) return `http://${host}:3001`;
		return "http://localhost:3001";
	}

	throw new Error(
		"ZOLA API URL is unavailable. Set EXPO_PUBLIC_API_URL for a production build or tunnel development.",
	);
}

/** The mobile clients use one origin and add `/api` at their endpoint boundary. */
export function normalizeApiOrigin(value: string) {
	return value.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
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
