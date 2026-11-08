import React from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { styles } from "../styles/commonStyles";

export function Detail({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.detail}>
			<Text style={styles.muted}>{label}</Text>
			<Text style={styles.bodyStrong}>{value}</Text>
		</View>
	);
}

export default Detail;
