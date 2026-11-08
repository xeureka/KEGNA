import React from "react";
import { View, Pressable, Image } from "react-native";
import { Text } from "./Text";
import { Icon } from "./Icons";
import { LanguageToggle } from "./LanguageToggle";
import { styles } from "../styles/commonStyles";
import { useTenantConfig } from "../context/TenantConfigContext";

export const AuthHeader = ({
	onBack,
	lang: _lang,
	setLang: _setLang,
}: {
	onBack?: () => void;
	lang?: string;
	setLang?: (value: string) => void;
}) => {
	const config = useTenantConfig();
	return (
		<View style={styles.authHeader}>
			<Pressable onPress={onBack} style={styles.headerIcon}>
				{onBack ? (
					<Icon>‹</Icon>
				) : config.server.logoUrl ? (
					<Image
						source={{ uri: config.server.logoUrl }}
						style={{ width: 24, height: 24 }}
					/>
				) : (
					<Text style={{ fontSize: 20 }}>👩🏼‍⚕️</Text>
				)}
			</Pressable>
			<Text style={styles.brand}>{config.identity.displayName}</Text>
			<LanguageToggle />
		</View>
	);
};

export default AuthHeader;
