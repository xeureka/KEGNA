import { useCallback, useEffect, useState } from "react";
import { listReports } from "../api/client";
import type { ReportListRow } from "../types";
import { errorMessage } from "../utils/errors";

export function useMobileReports(status?: string) {
	const [rows, setRows] = useState<ReportListRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const reload = useCallback(async () => {
		setError(null);
		try { setRows(await listReports(status ? { status } : {})); } catch (cause) { setError(errorMessage(cause, "Could not load reports")); }
		finally { setLoading(false); }
	}, [status]);
	useEffect(() => { void reload(); }, [reload]);
	return { rows, loading, error, reload };
}
