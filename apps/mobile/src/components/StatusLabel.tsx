import React from "react";

import { colors } from "../constants/colors";
import type { IssueStatus } from "../types";
import { statusLabel } from "../utils/status";
import { Text } from "./Text";

export function StatusLabel({
	status,
	size = 12,
}: {
	status: IssueStatus | string;
	size?: number;
}) {
	const color =
		status === "flagged"
			? colors.danger
			: status === "verified"
				? colors.primary
				: colors.muted;
	return (
		<Text size={size} style={{ color }}>
			{statusLabel(status)}
		</Text>
	);
}
