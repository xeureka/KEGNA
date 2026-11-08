import type { ExpoConfig } from "expo/config";
import { appConfig } from "./config/app.ts";

const config: ExpoConfig = {
	name: appConfig.name,
	slug: appConfig.slug,
	scheme: appConfig.scheme,
	version: appConfig.version,
	icon: appConfig.assets.icon,
	ios: {
		supportsTablet: true,
		bundleIdentifier: appConfig.bundleIdentifier,
	},
	android: {
		package: appConfig.bundleIdentifier,
		adaptiveIcon: {
			backgroundColor: appConfig.colors.background,
			foregroundImage: appConfig.assets.icon,
		},
	},
	web: { favicon: appConfig.assets.icon },
	plugins: ["expo-image-picker"],
	extra: {
		eas: { projectId: appConfig.easProjectId },
	},
};

export default config;
