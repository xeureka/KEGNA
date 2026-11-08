/**
 * Build-time tenant configuration. Branding and clinic metadata are refreshed
 * from the backend at startup; only genuine build-time values belong here.
 */
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";

export const tenantConfig = {
	identity: {
		id:
			process.env.EXPO_PUBLIC_TENANT_ID ??
			"0ef815bd-15c3-4aff-b434-095ba4e5ad1a",
		slug: process.env.EXPO_PUBLIC_TENANT_SLUG ?? "ahadu-dental",
		displayName: process.env.EXPO_PUBLIC_TENANT_NAME ?? "Ahadu Dental",
		appName: process.env.EXPO_PUBLIC_TENANT_NAME ?? "Ahadu Dental",
	},
	branding: {
		colors: {
			background: "#fbf9f4",
			surface: "#ffffff",
			ink: "#1b1c19",
			muted: "#71716d",
			primary: "#006044",
			bright: "#1e7a5a",
			mint: "#e8f5ee",
			linen: "#efeee9",
			border: "#e6e5e0",
			sand: "#e5dfd1",
			danger: "#c85332",
			onPrimary: "#d8f7e7",
			accent: "#ffc908",
		},
		logo: "./assets/icon.png",
		icon: "./assets/icon.png",
		splash: "./assets/splash-icon.png",
	},
	clinic: {
		address: "Addis Ababa",
		phone: "+251 11 123 4567",
		supportPhone: "+251 11 123 4567",
		supportEmail: "support@example.invalid",
		workingHours: "Mon–Sat · 8:00 AM–6:00 PM",
		supportResponseTime: "Usually replies in 10 min",
	},
	content: {
		defaultAppointment: {
			title: "Routine Dental Cleaning & Checkup",
			description:
				"Remove plaque and surface stains for a fresher, healthier smile.",
			duration: "45 mins",
			price: "1,200 ETB",
		},
		homeTipTitle: "Protect your smile",
		homeTip:
			"Brush gently for two minutes, twice daily. Your next checkup is a great time to ask about sensitivity.",
		about:
			"helps you manage your dental care, appointments, records, and payments.",
	},
	features: { onlineBooking: true, payments: true, dentalHistory: true },
	apiBaseUrl,
	scheme: `nexa-${process.env.EXPO_PUBLIC_TENANT_SLUG ?? "ahadu-dental"}`,
	build: {
		bundleIdentifier: `com.nexa.${(process.env.EXPO_PUBLIC_TENANT_SLUG ?? "ahadu-dental").replaceAll("-", "")}`,
		version: "1.0.0",
		easProjectId: "807a1e65-5dc1-4f2b-ab1c-251964fb4d30",
	},
} as const;

export type TenantConfig = typeof tenantConfig;

export function assertTenantConfig() {
	if (!/^[0-9a-f-]{36}$/i.test(tenantConfig.identity.id)) {
		throw new Error(
			"Set EXPO_PUBLIC_TENANT_ID to the UUID returned by provisioning.",
		);
	}
	if (!tenantConfig.identity.slug)
		throw new Error("Mobile tenant slug is not configured.");
}
