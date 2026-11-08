import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

function compareValues(a: unknown, b: unknown): number {
	if (a === null || a === undefined || a === "") return 1;
	if (b === null || b === undefined || b === "") return -1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	const av = String(a).toLowerCase();
	const bv = String(b).toLowerCase();
	return av < bv ? -1 : av > bv ? 1 : 0;
}

/** Client-side sorting for the current page of rows. */
export function useSort<T>(rows: T[], initialKey?: string) {
	const [key, setKey] = useState<string | null>(initialKey ?? null);
	const [dir, setDir] = useState<SortDir>("asc");

	const sorted = useMemo(() => {
		if (!key) return rows;
		const copy = [...rows];
		copy.sort((a, b) => {
			const av = (a as Record<string, unknown>)[key];
			const bv = (b as Record<string, unknown>)[key];
			return dir === "asc" ? compareValues(av, bv) : compareValues(bv, av);
		});
		return copy;
	}, [rows, key, dir]);

	const toggle = (nextKey: string) => {
		if (key === nextKey) {
			setDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setKey(nextKey);
			setDir("asc");
		}
	};

	return { sorted, key, dir, toggle };
}
