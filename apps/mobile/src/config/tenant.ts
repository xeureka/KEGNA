// Compatibility exports. The single source of tenant truth is
// apps/mobile/config/tenant.config.ts.
import {
	assertTenantConfig,
	tenantConfig as sourceTenantConfig,
	type TenantConfig as SourceTenantConfig,
} from "../../config/tenant.config";

export { assertTenantConfig };
export type TenantConfig = SourceTenantConfig;

// Legacy flat shape for modules being migrated; values still originate in the
// one root config file and are not another tenant configuration.
export const tenantConfig = {
	...sourceTenantConfig.identity,
	apiBaseUrl: sourceTenantConfig.apiBaseUrl,
	scheme: sourceTenantConfig.scheme,
	icon: sourceTenantConfig.branding.icon,
	splash: sourceTenantConfig.branding.splash,
	colors: { ...sourceTenantConfig.branding.colors } as Record<string, string>,
	branding: sourceTenantConfig.branding,
	clinic: sourceTenantConfig.clinic,
	content: sourceTenantConfig.content,
	features: sourceTenantConfig.features,
	support: {
		phone: sourceTenantConfig.clinic.supportPhone,
		email: sourceTenantConfig.clinic.supportEmail,
	},
	build: sourceTenantConfig.build,
};

export function getTenantConfig() {
	return tenantConfig;
}
