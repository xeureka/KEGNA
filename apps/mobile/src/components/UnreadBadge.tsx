import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../constants/colors";
import { Text } from "./Text";

export function UnreadBadge({ count }: { count: number }) {
	if (!count) return null;
	return (
		<View style={styles.badge}>
			<Text bold size={11} style={styles.label}>
				{count > 99 ? "99+" : count}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	badge: {
		minWidth: 20,
		height: 20,
		borderRadius: radius.pill,
		backgroundColor: colors.primary,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.xs,
	},
	label: { color: colors.onPrimary },
});
