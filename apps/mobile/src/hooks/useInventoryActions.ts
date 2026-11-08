import { useCallback, useState } from "react";

import {
	addDeposit as addDepositRequest,
	submitReport as submitReportRequest,
	verifyReport as verifyReportRequest,
} from "../api/client";
import type { DepositInput, SubmitReportInput } from "../types";
import { errorMessage } from "../utils/errors";

function useAction<TInput, TResult>(
	action: (input: TInput) => Promise<TResult>,
	onSuccess: (result: TResult) => void | Promise<void>,
) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const run = useCallback(
		async (input: TInput) => {
			setBusy(true);
			setError(null);
			try {
				const result = await action(input);
				await onSuccess(result);
				return result;
			} catch (nextError) {
				setError(errorMessage(nextError, "The request failed"));
				return null;
			} finally {
				setBusy(false);
			}
		},
		[action, onSuccess],
	);

	return { run, busy, error, clearError: () => setError(null) };
}

export function useSubmitReport(
	issueId: string,
	onSuccess: () => void | Promise<void>,
) {
	const action = useCallback(
		(input: SubmitReportInput) => submitReportRequest(issueId, input),
		[issueId],
	);
	const { run, busy, error, clearError } = useAction(action, onSuccess);
	return { submit: run, busy, error, clearError };
}

export function useAddDeposit(
	reportId: string,
	onSuccess: () => void | Promise<void>,
) {
	const action = useCallback(
		(input: DepositInput) => addDepositRequest(reportId, input),
		[reportId],
	);
	const { run, busy, error, clearError } = useAction(action, onSuccess);
	return { addDeposit: run, busy, error, clearError };
}

export function useVerifyReport(
	reportId: string,
	onSuccess: () => void | Promise<void>,
) {
	const action = useCallback(
		(input: { decision: "approved" | "flagged"; note?: string }) =>
			verifyReportRequest(reportId, input.decision, input.note),
		[reportId],
	);
	const { run, busy, error, clearError } = useAction(action, onSuccess);
	return { verify: run, busy, error, clearError };
}
