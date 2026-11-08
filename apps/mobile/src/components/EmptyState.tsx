import React from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../constants/colors";
import { Text } from "./Text";
import { Package } from "phosphor-react-native";
import { colors } from "../constants/colors";

export function EmptyState({
	title,
	message,
}: {
	title: string;
	message: string;
}) {
	return (
		<View style={styles.base}>
			<Package color={colors.muted} size={32} />
			<Text bold size={17}>
				{title}
			</Text>
			<Text muted style={styles.message}>
				{message}
			</Text>
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
	message: { marginTop: spacing.sm, textAlign: "center", lineHeight: 20 },
});
