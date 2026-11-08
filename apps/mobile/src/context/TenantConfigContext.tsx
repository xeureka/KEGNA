import React, { createContext, useContext, useEffect, useState } from "react";
import {
	tenantConfig as staticTenantConfig,
	type TenantConfig,
} from "../../config/tenant.config";
import { mobileStorage } from "../api/storage";
import { getApiBaseUrl } from "../config/runtime";

type BrandingPayload = {
	name?: string;
	logoUrl?: string | null;
	brandColor?: string;
};

export type ResolvedTenantConfig = TenantConfig & {
	server: { logoUrl: string | null; brandColor: string | null };
};

const cacheKey = `${staticTenantConfig.identity.slug}-tenant-branding`;
const initialConfig: ResolvedTenantConfig = {
	...staticTenantConfig,
	server: { logoUrl: null, brandColor: null },
};

const TenantConfigContext = createContext<ResolvedTenantConfig>(initialConfig);

function mergeBranding(base: ResolvedTenantConfig, branding: BrandingPayload) {
	return {
		...base,
		identity: {
			...base.identity,
			displayName: branding.name?.trim() || base.identity.displayName,
			appName: branding.name?.trim() || base.identity.appName,
		},
		server: {
			logoUrl: branding.logoUrl ?? base.server.logoUrl,
			brandColor: branding.brandColor ?? base.server.brandColor,
		},
	};
}

async function fetchBranding(): Promise<BrandingPayload | null> {
	const response = await fetch(
		`${getApiBaseUrl()}/api/v1/auth/branding?tenantSlug=${encodeURIComponent(staticTenantConfig.identity.slug)}`,
		{ headers: { "X-Nexa-Tenant-Id": staticTenantConfig.identity.id } },
	);
	if (!response.ok) return null;
	const body = (await response.json()) as {
		success?: boolean;
		data?: BrandingPayload;
	};
	return body.success && body.data ? body.data : null;
}

export function TenantConfigProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [config, setConfig] = useState(initialConfig);

	useEffect(() => {
		let active = true;
		void (async () => {
			const cached = await mobileStorage.getItemAsync(cacheKey);
			if (active && cached) {
				try {
					setConfig(
						mergeBranding(initialConfig, JSON.parse(cached) as BrandingPayload),
					);
				} catch {
					// Ignore an invalid cache and use the static branded config.
				}
			}
			try {
				const fresh = await fetchBranding();
				if (!fresh || !active) return;
				setConfig((current) => mergeBranding(current, fresh));
				await mobileStorage.setItemAsync(cacheKey, JSON.stringify(fresh));
			} catch {
				// Cached/static branding remains usable when the API is unavailable.
			}
		})();
		return () => {
			active = false;
		};
	}, []);

	return (
		<TenantConfigContext.Provider value={config}>
			{children}
		</TenantConfigContext.Provider>
	);
}

export function useTenantConfig() {
	return useContext(TenantConfigContext);
}
