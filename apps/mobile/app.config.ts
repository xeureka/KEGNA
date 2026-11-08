import type { ExpoConfig } from "expo/config";
import { tenantConfig } from "./config/tenant.config.ts";

export default (): ExpoConfig => {
	if (
		process.env.EAS_BUILD_PROFILE === "production" &&
		(!process.env.EXPO_PUBLIC_TENANT_ID || !process.env.EXPO_PUBLIC_TENANT_SLUG)
	) {
		throw new Error(
			"EXPO_PUBLIC_TENANT_ID and EXPO_PUBLIC_TENANT_SLUG are required for production white-label builds",
		);
	}
	if (
		process.env.EAS_BUILD_PROFILE === "production" &&
		!process.env.EXPO_PUBLIC_API_URL
	) {
		throw new Error(
			"EXPO_PUBLIC_API_URL is required for production white-label builds",
		);
	}
	const tenant = tenantConfig;
	const config = {
		name: tenant.identity.appName,
		slug: tenant.identity.slug,
		scheme: tenant.scheme,
		version: tenant.build.version,
		icon: tenant.branding.icon,
		splash: {
			image: tenant.branding.splash,
			resizeMode: "contain",
			backgroundColor: tenant.branding.colors.background,
		},
		ios: {
			supportsTablet: true,
			bundleIdentifier: tenant.build.bundleIdentifier,
		},
		android: {
			package: tenant.build.bundleIdentifier,
			adaptiveIcon: {
				backgroundColor: tenant.branding.colors.background,
				foregroundImage: tenant.branding.icon,
			},
		},
		web: { favicon: tenant.branding.icon },
		plugins: ["expo-sharing", "expo-web-browser"],
		extra: {
			clientId: tenant.identity.id,
			tenantId: tenant.identity.id,
			tenantSlug: tenant.identity.slug,
			apiBaseUrl: tenant.apiBaseUrl,
			eas: { projectId: tenant.build.easProjectId },
		},
	};
	return config as ExpoConfig;
};
