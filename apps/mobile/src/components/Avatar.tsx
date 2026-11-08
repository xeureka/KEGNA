import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius } from "../constants/colors";
import { initials } from "../utils/initials";
import { Text } from "./Text";

export function Avatar({
	name,
	size = 48,
}: {
	name: string;
	size?: number;
}) {
	return (
		<View
			style={[
				styles.base,
				{ width: size, height: size, borderRadius: radius.pill },
			]}
		>
			<Text bold size={Math.max(13, size * 0.34)} style={styles.label}>
				{initials(name)}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	base: {
		backgroundColor: colors.mint,
		alignItems: "center",
		justifyContent: "center",
	},
	label: { color: colors.primary },
});
