import React, { forwardRef } from "react";
import {
	StyleSheet,
	TextInput as NativeTextInput,
	type TextInputProps,
} from "react-native";

import { colors, radius, spacing } from "../constants/colors";

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(
	function TextInput({ style, ...props }, ref) {
		return (
			<NativeTextInput
				ref={ref}
				placeholderTextColor={colors.muted}
				style={[styles.input, style]}
				{...props}
			/>
		);
	},
);

const styles = StyleSheet.create({
	input: {
		minHeight: 44,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		backgroundColor: colors.surface,
		color: colors.ink,
		fontSize: 15,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
});
