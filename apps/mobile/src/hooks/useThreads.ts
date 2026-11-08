import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { listThreads } from "../api/client";
import type { ThreadRow } from "../types";
import { errorMessage } from "../utils/errors";
import { useAppPolling } from "./useAppPolling";

function sortByActivity(rows: ThreadRow[]) {
	return rows.toSorted((a, b) => {
		const first = new Date(a.lastEventAt ?? a.issue.issuedAt).getTime();
		const second = new Date(b.lastEventAt ?? b.issue.issuedAt).getTime();
		return second - first;
	});
}

export function useThreads() {
	const [rows, setRows] = useState<ThreadRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const mounted = useRef(true);
	const inFlight = useRef(false);
	const hasLoaded = useRef(false);
	useEffect(() => () => { mounted.current = false; }, []);

	const load = useCallback(async (mode: "initial" | "refresh" | "poll") => {
		if (inFlight.current) return;
		inFlight.current = true;
		if (mode === "refresh") setRefreshing(true);
		try {
			const next = await listThreads();
			if (!mounted.current) return;
			setRows(sortByActivity(next));
			hasLoaded.current = true;
			setError(null);
		} catch (nextError) {
			if (mode !== "poll")
				setError(errorMessage(nextError, "Could not load conversations"));
		} finally {
			if (mounted.current && mode === "initial") setLoading(false);
			if (mounted.current && mode === "refresh") setRefreshing(false);
			inFlight.current = false;
		}
	}, []);

	useFocusEffect(useCallback(() => {
		void load(hasLoaded.current ? "poll" : "initial");
		return undefined;
	}, [load]));

	useAppPolling(() => load("poll"), 20_000);

	return {
		rows,
		loading,
		refreshing,
		error,
		refresh: () => load("refresh"),
		reload: () => load("initial"),
	};
}
