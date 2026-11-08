import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";

import { appConfig } from "../../config/app";
import { getApiBaseUrl } from "../config/runtime";
import { mobileStorage } from "./storage";

export const authClient = createAuthClient({
	baseURL: `${getApiBaseUrl()}/api/auth`,
	plugins: [
		expoClient({
			scheme: appConfig.scheme,
			storagePrefix: `${appConfig.slug}-better-auth`,
			storage: mobileStorage,
		}),
	],
});
