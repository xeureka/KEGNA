import { useCallback, useEffect, useState } from "react";

import { getIssue } from "../api/client";
import type { IssueDetail } from "../types";
import { errorMessage } from "../utils/errors";
import { useAppPolling } from "./useAppPolling";

export function useIssue(issueId: string) {
	const [issue, setIssue] = useState<IssueDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(
		async (mode: "initial" | "poll") => {
			try {
				const next = await getIssue(issueId);
				setIssue(next);
				setError(null);
			} catch (nextError) {
				if (mode !== "poll")
					setError(errorMessage(nextError, "Could not load issue"));
			} finally {
				if (mode === "initial") setLoading(false);
			}
		},
		[issueId],
	);

	useEffect(() => {
		setLoading(true);
		setIssue(null);
		void load("initial");
	}, [load]);

	useAppPolling(() => load("poll"), 20_000);

	return { issue, loading, error, refresh: () => load("initial") };
}
