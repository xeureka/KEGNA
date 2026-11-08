import React from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { Alert } from "../utils/alert";
import { colors } from "../constants/colors";
import { styles } from "../styles/commonStyles";

export function MenuRow({
	icon,
	title,
	detail,
	onPress,
}: {
	icon: React.ReactNode;
	title: string;
	detail?: string;
	onPress?: () => void;
}) {
	const action =
		onPress ||
		(() => Alert.alert(title, detail || "This option is ready to configure."));
	return (
		<Pressable
			onPress={action}
			style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
		>
			<View style={styles.menuIcon}>
				{typeof icon === "string" ? (
					<Text
						style={{ color: colors.primary, fontSize: 20, fontWeight: "700" }}
					>
						{icon}
					</Text>
				) : (
					icon
				)}
			</View>
			<View style={{ flex: 1 }}>
				<Text style={styles.bodyStrong}>{title}</Text>
				{detail && <Text style={styles.muted}>{detail}</Text>}
			</View>
			<Text style={styles.link}>〉</Text>
		</Pressable>
	);
}

export default MenuRow;
