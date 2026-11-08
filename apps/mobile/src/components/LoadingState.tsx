import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors, spacing } from "../constants/colors";
import { Text } from "./Text";

export function LoadingState({ label = "Loading" }: { label?: string }) {
	return (
		<View style={styles.base}>
			<ActivityIndicator color={colors.primary} />
			<Text muted style={styles.label}>
				{label}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	base: { flex: 1, alignItems: "center", justifyContent: "center" },
	label: { marginTop: spacing.sm },
});
