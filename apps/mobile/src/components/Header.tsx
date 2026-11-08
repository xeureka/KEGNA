import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { Icon, Bell1, icons } from "./Icons";
import { LanguageToggle } from "./LanguageToggle";
import { useNotifications } from "../context/NotificationContext";
import { colors } from "../constants/colors";
import { styles } from "../styles/commonStyles";
import { useTenantConfig } from "../context/TenantConfigContext";

export const Header = ({
	title,
	onBack,
	onNotifications,
}: {
	title?: string;
	onBack?: () => void;
	onNotifications: () => void;
}) => {
	const { hasUnread } = useNotifications();
	const config = useTenantConfig();
	return (
		<View style={styles.header}>
			<Pressable onPress={onBack} style={styles.headerIcon}>
				{onBack ? <Icon>‹</Icon> : icons.tooth(20, colors.primary)}
			</Pressable>
			<View style={styles.headerTitleWrap}>
				<Text style={styles.brand}>{title || config.identity.displayName}</Text>
				{title && <Text style={styles.headerSub}>ጤና ጥርስ</Text>}
			</View>
			<View style={styles.row}>
				<LanguageToggle />
				<Pressable onPress={onNotifications} style={styles.headerIcon}>
					<Bell1 />
					{hasUnread && (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>1</Text>
						</View>
					)}
				</Pressable>
			</View>
		</View>
	);
};

export default Header;
