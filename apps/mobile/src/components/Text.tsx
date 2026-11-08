import React from "react";
import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";

import { colors } from "../constants/colors";

export function Text({
	muted,
	bold,
	size = 14,
	style,
	...props
}: NativeTextProps & {
	muted?: boolean;
	bold?: boolean;
	size?: number;
}) {
	return (
		<NativeText
			{...props}
			style={[
				{
					color: muted ? colors.muted : colors.ink,
					fontSize: size,
					fontWeight: bold ? "600" : "400",
				},
				style,
			]}
		/>
	);
}
