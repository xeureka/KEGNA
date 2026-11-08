function toNumber(value: string | number | null | undefined) {
	const parsed = typeof value === "number" ? value : Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: string | number | null | undefined) {
	const amount = toNumber(value);
	const fixed = Math.abs(amount).toFixed(2);
	const [whole, fraction] = fixed.split(".");
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return `ETB ${amount < 0 ? "-" : ""}${grouped}.${fraction}`;
}

export function formatRacks(value: string | number | null | undefined) {
	return String(Math.trunc(toNumber(value)));
}

export function formatSignedRacks(value: number) {
	return value > 0 ? `+${value}` : String(value);
}

function dateValue(value: string | Date | null | undefined) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function sameCalendarDay(a: Date, b: Date) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatTime(value: string | Date | null | undefined) {
	const date = dateValue(value);
	if (!date) return "";
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value: string | Date | null | undefined) {
	const date = dateValue(value);
	if (!date) return "";
	return date.toLocaleDateString([], {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatDateTime(value: string | Date | null | undefined) {
	const date = dateValue(value);
	if (!date) return "";
	return `${formatDate(date)} · ${formatTime(date)}`;
}

export function formatChatTimestamp(value: string | Date | null | undefined) {
	const date = dateValue(value);
	if (!date) return "";
	const now = new Date();
	const sameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	return sameDay ? formatTime(date) : formatDate(date);
}

export function formatDayLabel(value: string | Date) {
	const date = dateValue(value);
	if (!date) return "";
	const now = new Date();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (sameCalendarDay(date, now)) return "Today";
	if (sameCalendarDay(date, yesterday)) return "Yesterday";
	return formatDate(date);
}

export function isSameDay(a: string | Date, b: string | Date) {
	const first = dateValue(a);
	const second = dateValue(b);
	if (!first || !second) return false;
	return (
		first.getFullYear() === second.getFullYear() &&
		first.getMonth() === second.getMonth() &&
		first.getDate() === second.getDate()
	);
}

export function formatDepositDate(value: string | Date | null | undefined) {
	const date = dateValue(value);
	if (!date) return "";
	return date.toISOString().slice(0, 10);
}
