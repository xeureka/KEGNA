import { appConfig } from "../../config/app";

export const colors = appConfig.colors;

export const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
} as const;

export const radius = {
	sm: 8,
	md: 12,
	lg: 18,
	pill: 999,
} as const;
