import { useCallback, useEffect, useState } from "react";
import { getDashboardSummary } from "../api/client";
import type { AccountantSummary, SalesSummary } from "../types";
import { errorMessage } from "../utils/errors";

export function useMobileSummary() {
	const [data, setData] = useState<SalesSummary | AccountantSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const reload = useCallback(async () => {
		setError(null);
		try { setData(await getDashboardSummary()); } catch (cause) { setError(errorMessage(cause, "Could not load summary")); }
		finally { setLoading(false); }
	}, []);
	useEffect(() => { void reload(); }, [reload]);
	return { data, loading, error, reload };
}
