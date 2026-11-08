/**
 * Static single-tenant ZOLA build configuration.
 *
 * Phase 5 replaces the remaining legacy dental screens. Until then this file
 * keeps the shape those screens expect while defining one fixed ZOLA identity.
 */
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";

export const tenantConfig = {
	identity: {
		id: "zola",
		slug: "zola",
		displayName: "ZOLA",
		appName: "ZOLA",
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
		about: "helps you manage your inventory, issues, reports, and deposits.",
	},
	features: { onlineBooking: true, payments: true, dentalHistory: true },
	apiBaseUrl,
	scheme: "zola",
	build: {
		bundleIdentifier: "com.zola.app",
		version: "1.0.0",
		easProjectId: "807a1e65-5dc1-4f2b-ab1c-251964fb4d30",
	},
} as const;

export type TenantConfig = typeof tenantConfig;

export function assertTenantConfig() {
	if (!tenantConfig.identity.slug)
		throw new Error("Mobile app identity is not configured.");
}
