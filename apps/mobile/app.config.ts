import type { ExpoConfig } from "expo/config";
import { tenantConfig } from "./config/tenant.config.ts";

const config: ExpoConfig = {
	name: "ZOLA",
	slug: "zola",
	scheme: tenantConfig.scheme,
	version: tenantConfig.build.version,
	icon: tenantConfig.branding.icon,
	splash: {
		image: tenantConfig.branding.splash,
		resizeMode: "contain",
		backgroundColor: tenantConfig.branding.colors.background,
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: tenantConfig.build.bundleIdentifier,
	},
	android: {
		package: tenantConfig.build.bundleIdentifier,
		adaptiveIcon: {
			backgroundColor: tenantConfig.branding.colors.background,
			foregroundImage: tenantConfig.branding.icon,
		},
	},
	web: { favicon: tenantConfig.branding.icon },
	plugins: ["expo-sharing", "expo-web-browser"],
	extra: {
		apiBaseUrl: tenantConfig.apiBaseUrl,
		eas: { projectId: tenantConfig.build.easProjectId },
	},
};

export default config;
