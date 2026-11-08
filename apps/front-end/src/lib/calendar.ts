export function toISODate(d: Date): string {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function fromISODate(value: string): Date {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function addDays(d: Date, days: number): Date {
	const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	copy.setDate(copy.getDate() + days);
	return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** Monday as the first day of the week. */
export function startOfWeek(d: Date): Date {
	const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const day = copy.getDay();
	return addDays(copy, day === 0 ? -6 : 1 - day);
}

export function startOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isToday(d: Date): boolean {
	return isSameDay(d, new Date());
}

/** "HH:MM[:SS]" -> minutes since midnight. */
export function toMinutes(time: string): number {
	const [h, m] = time.slice(0, 5).split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToLabel(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	const hour = h % 12 === 0 ? 12 : h % 12;
	const ampm = h >= 12 ? "PM" : "AM";
	return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function minutesToTime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDayLabel(d: Date): string {
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

export function formatMonthLabel(d: Date): string {
	return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Calendar grid for a month (Monday-first), padded to whole weeks. */
export function buildMonthGrid(monthDate: Date): Date[] {
	const year = monthDate.getFullYear();
	const month = monthDate.getMonth();
	const first = new Date(year, month, 1);
	const lead = (first.getDay() + 6) % 7;
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const cells: Date[] = [];
	for (let i = lead; i > 0; i -= 1) cells.push(addDays(first, -i));
	for (let day = 1; day <= daysInMonth; day += 1)
		cells.push(new Date(year, month, day));
	while (cells.length % 7 !== 0) {
		const last = cells[cells.length - 1];
		if (!last) break;
		cells.push(addDays(last, 1));
	}
	return cells;
}
