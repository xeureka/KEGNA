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

export const APPOINTMENT_STATUS_TONE: Record<string, BadgeTone> = {
	SCHEDULED: "neutral",
	CONFIRMED: "accent",
	CHECKED_IN: "neutral",
	IN_PROGRESS: "accent",
	COMPLETED: "success",
	CANCELLED: "danger",
	NO_SHOW: "warning",
};

export const BILL_STATUS_TONE: Record<string, BadgeTone> = {
	DRAFT: "neutral",
	PENDING: "warning",
	PARTIALLY_PAID: "warning",
	PAID: "success",
	CANCELLED: "neutral",
	REFUNDED: "neutral",
	VOID: "neutral",
};

export const AUDIT_ACTION_TONE: Record<string, BadgeTone> = {
	CREATE: "success",
	UPDATE: "accent",
	DELETE: "danger",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
	CHAPA: "Chapa (mobile app)",
	CASH: "Cash",
	MOBILE_TRANSFER: "Mobile transfer",
};

export const PAYMENT_METHOD_TONE: Record<string, BadgeTone> = {
	CHAPA: "accent",
	CASH: "neutral",
	MOBILE_TRANSFER: "accent",
};
