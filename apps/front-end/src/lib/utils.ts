export function cn(
	...classes: Array<string | false | null | undefined>
): string {
	return classes.filter(Boolean).join(" ");
}

export function formatCurrency(value: string | number): string {
	const amount = typeof value === "string" ? Number(value) : value;
	return new Intl.NumberFormat("en-ET", {
		style: "currency",
		currency: "ETB",
	}).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(date: string | null | undefined): string {
	if (!date) return "—";
	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return date;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatDateTime(date: string | null | undefined): string {
	if (!date) return "—";
	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return date;
	return d.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/** Backend sends "HH:MM:SS" (or "HH:MM") — trim to "HH:MM" for display. */
export function formatTime(time: string | null | undefined): string {
	if (!time) return "—";
	return time.length > 5 ? time.slice(0, 5) : time;
}

export function initials(name: string | null | undefined): string {
	if (!name) return "?";
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
}

export function titleCase(value: string | null | undefined): string {
	if (!value) return "—";
	return value
		.toLowerCase()
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
