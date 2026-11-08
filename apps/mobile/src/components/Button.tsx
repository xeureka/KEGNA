import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { Text } from "./Text";
import { styles } from "../styles/commonStyles";

export const Button = ({
	label,
	onPress,
	secondary = false,
	compact = false,
	busy = false,
	style,
}: {
	label: string;
	onPress: () => void;
	secondary?: boolean;
	compact?: boolean;
	busy?: boolean;
	style?: StyleProp<ViewStyle>;
}) => (
	<Pressable
		onPress={onPress}
		disabled={busy}
		style={({ pressed }) => [
			styles.button,
			secondary && styles.secondaryButton,
			compact && styles.compactButton,
			style,
			pressed && styles.pressed,
			busy && { opacity: 0.6 },
		]}
	>
		<Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>
			{busy ? `${label}…` : label}
		</Text>
	</Pressable>
);

export default Button;
