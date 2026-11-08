import React from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	type ViewStyle,
} from "react-native";

import { colors, radius, spacing } from "../constants/colors";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
	label,
	onPress,
	busy,
	disabled,
	variant = "primary",
	style,
}: {
	label: string;
	onPress: () => void;
	busy?: boolean;
	disabled?: boolean;
	variant?: Variant;
	style?: ViewStyle;
}) {
	const inactive = disabled || busy;
	const background =
		variant === "primary"
			? colors.primary
			: variant === "danger"
				? colors.danger
				: variant === "secondary"
					? colors.mint
					: "transparent";
	const textColor =
		variant === "primary" || variant === "danger"
			? colors.onPrimary
			: colors.primary;
	return (
		<Pressable
			accessibilityRole="button"
			disabled={inactive}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				{ backgroundColor: background },
				variant === "ghost" ? styles.ghost : null,
				inactive ? styles.inactive : null,
				pressed && !inactive ? styles.pressed : null,
				style,
			]}
		>
			{busy ? (
				<ActivityIndicator color={textColor} />
			) : (
				<Text bold size={15} style={{ color: textColor }}>
					{label}
				</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		minHeight: 46,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.lg,
	},
	ghost: {
		borderWidth: 1,
		borderColor: colors.border,
	},
	inactive: { opacity: 0.5 },
	pressed: { opacity: 0.82 },
});
