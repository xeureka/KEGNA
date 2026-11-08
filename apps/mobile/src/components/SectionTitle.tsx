import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { styles } from "../styles/commonStyles";

export const SectionTitle = ({
	title,
	action,
	onAction,
}: {
	title: string;
	action?: string;
	onAction?: () => void;
}) => (
	<View style={styles.sectionTitle}>
		<Text style={styles.sectionHeading}>{title}</Text>
		{action && (
			<Pressable onPress={onAction}>
				<Text style={styles.link}>{action} 〉</Text>
			</Pressable>
		)}
	</View>
);

export default SectionTitle;
