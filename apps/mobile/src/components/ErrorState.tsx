import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../constants/colors";
import { Button } from "./Button";
import { Text } from "./Text";
import { ArrowClockwise, WarningCircle } from "phosphor-react-native";

export function ErrorState({
	message,
	onRetry,
}: {
	message: string;
	onRetry?: () => void;
}) {
	return (
		<View style={styles.base}>
			<WarningCircle color={colors.danger} size={30} />
			<Text bold size={16} style={{ color: colors.danger }}>
				Something went wrong
			</Text>
			<Text muted style={styles.message}>
				{message}
			</Text>
			{onRetry ? (
				<Button
					label="Try again"
					icon={<ArrowClockwise color={colors.primary} size={18} />}
					variant="secondary"
					onPress={onRetry}
					style={styles.button}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	base: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.xl,
	},
	message: {
		marginTop: spacing.sm,
		textAlign: "center",
		lineHeight: 20,
	},
	button: { marginTop: spacing.lg, minWidth: 140 },
});
