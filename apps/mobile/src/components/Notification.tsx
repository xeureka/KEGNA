import React from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { Card } from "./Card";
import { colors } from "../constants/colors";
import { styles } from "../styles/commonStyles";

export function Notification({
	title,
	body,
	read = false,
}: {
	title: string;
	body: string;
	read?: boolean;
}) {
	return (
		<Card>
			<View style={styles.row}>
				<View
					style={[
						styles.notificationDot,
						read && { backgroundColor: colors.border },
					]}
				/>
				<View style={{ flex: 1 }}>
					<Text style={styles.bodyStrong}>{title}</Text>
					<Text style={styles.muted}>{body}</Text>
					<Text style={styles.notificationTime}>A few hours ago</Text>
				</View>
			</View>
		</Card>
	);
}

export default Notification;
