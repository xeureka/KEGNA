import { useCallback, useEffect, useRef, useState } from "react";

import { listThreadEvents } from "../api/client";
import type { ThreadEvent } from "../types";
import { errorMessage } from "../utils/errors";
import { useAppPolling } from "./useAppPolling";

const PAGE_SIZE = 100;

function mergeEvents(current: ThreadEvent[], incoming: ThreadEvent[]) {
	const byId = new Map(current.map((event) => [event.id, event]));
	for (const event of incoming) byId.set(event.id, event);
	// eslint-disable-next-line unicorn/no-array-sort -- Hermes compatibility requires sorting a copied array.
	return [...byId.values()].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);
}

export function useThreadEvents(issueId: string) {
	const [events, setEvents] = useState<ThreadEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const loadLatest = useCallback(
		async (mode: "initial" | "poll") => {
			try {
				const next = await listThreadEvents(issueId, undefined, PAGE_SIZE);
				if (!mounted.current) return;
				setEvents((current) => mergeEvents(current, next));
				setHasMore(next.length === PAGE_SIZE);
				setError(null);
			} catch (nextError) {
				if (mounted.current && mode !== "poll")
					setError(errorMessage(nextError, "Could not load messages"));
			} finally {
				if (mounted.current && mode === "initial") setLoading(false);
			}
		},
		[issueId],
	);

	useEffect(() => {
		setLoading(true);
		setEvents([]);
		setHasMore(false);
		void loadLatest("initial");
	}, [loadLatest]);

	useAppPolling(() => loadLatest("poll"), 6_000);

	const loadOlder = useCallback(async () => {
		const oldest = events[0];
		if (!oldest || loadingOlder) return;
		setLoadingOlder(true);
		try {
			const next = await listThreadEvents(
				issueId,
				oldest.createdAt,
				PAGE_SIZE,
			);
			if (!mounted.current) return;
			setEvents((current) => mergeEvents(current, next));
			setHasMore(next.length === PAGE_SIZE);
		} catch (nextError) {
			if (mounted.current)
				setError(errorMessage(nextError, "Could not load older messages"));
		} finally {
			if (mounted.current) setLoadingOlder(false);
		}
	}, [events, issueId, loadingOlder]);

	const appendOptimistic = useCallback((event: ThreadEvent) => {
		setEvents((current) => mergeEvents(current, [event]));
	}, []);

	const removeEvent = useCallback((eventId: string) => {
		setEvents((current) => current.filter((event) => event.id !== eventId));
	}, []);

	return {
		events,
		loading,
		loadingOlder,
		hasMore,
		error,
		refresh: () => loadLatest("initial"),
		loadOlder,
		appendOptimistic,
		removeEvent,
	};
}
