import type { IssueStatus } from "../types";

export const issueStatusLabel: Record<IssueStatus, string> = {
	open: "Open load",
	reported: "Reported",
	returns_confirmed: "Returns confirmed",
	verified: "Verified",
	flagged: "Flagged",
};

export function statusLabel(status: string) {
	return issueStatusLabel[status as IssueStatus] ?? status.replace(/_/g, " ");
}

export const eventPreview: Record<string, string> = {
	issued: "Load issued",
	report_submitted: "Report submitted",
	deposit_added: "Deposit added",
	returns_confirmed: "Returns confirmed",
	verified: "Report approved",
	flagged: "Report flagged",
	comment: "Comment",
};
