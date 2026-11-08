import React from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { styles } from "../styles/commonStyles";

export function Action({
	icon,
	label,
	onPress,
}: {
	icon: React.ReactNode;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [styles.action, pressed && styles.pressed]}
		>
			<View style={styles.actionIconWrap}>{icon}</View>
			<Text style={styles.actionLabel}>{label}</Text>
		</Pressable>
	);
}

export default Action;
