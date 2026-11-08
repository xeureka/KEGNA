export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export const badgeTones: Record<BadgeTone, { chip: string; dot: string }> = {
	neutral: {
		chip: "border-slate-200 bg-slate-50 text-slate-600",
		dot: "bg-slate-400",
	},
	accent: {
		chip: "border-primary-200 bg-primary-50 text-primary-700",
		dot: "bg-primary-500",
	},
	success: {
		chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
		dot: "bg-emerald-500",
	},
	warning: {
		chip: "border-amber-200 bg-amber-50 text-amber-700",
		dot: "bg-amber-500",
	},
	danger: {
		chip: "border-rose-200 bg-rose-50 text-rose-700",
		dot: "bg-rose-500",
	},
};

export const ISSUE_STATUS_TONE: Record<string, BadgeTone> = {
	open: "accent",
	reported: "warning",
	returns_confirmed: "accent",
	verified: "success",
	flagged: "danger",
};

export const MOVEMENT_TYPE_TONE: Record<string, BadgeTone> = {
	receive: "success",
	issue: "accent",
	return: "neutral",
	damage: "danger",
	adjustment: "warning",
};

export const VERIFICATION_TONE: Record<string, BadgeTone> = {
	approved: "success",
	flagged: "danger",
};

export const ROLE_TONE: Record<string, BadgeTone> = {
	admin: "accent",
	storekeeper: "neutral",
	sales: "neutral",
	accountant: "neutral",
};
