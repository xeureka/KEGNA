import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import { tenantConfig } from "../config/tenant";
import { mobileStorage } from "./storage";
import { getApiBaseUrl } from "../config/runtime";

/** Official Better Auth Expo client. Cookies/session cache are persisted in SecureStore. */
export const authClient = createAuthClient({
	baseURL: `${getApiBaseUrl()}/api/auth`,
	plugins: [
		expoClient({
			scheme: tenantConfig.scheme,
			storagePrefix: `${tenantConfig.slug}-better-auth`,
			storage: mobileStorage,
		}),
		phoneNumberClient(),
	],
	fetchOptions: {
		headers: {
			"X-Nexa-Tenant-Id": tenantConfig.id,
			"X-Nexa-Tenant-Slug": tenantConfig.slug,
		},
	},
});
