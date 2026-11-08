import React, { useState } from "react";
import { View, Image } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { AuthHeader } from "../../components/AuthHeader";
import { icons } from "../../components/Icons";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import { useTenantConfig } from "../../context/TenantConfigContext";
import type { Screen } from "../../types";

export function Splash({ go }: { go: (screen: Screen) => void }) {
	const [lang, setLang] = useState("EN");
	const config = useTenantConfig();
	return (
		<View style={styles.authPage}>
			<AuthHeader lang={lang} setLang={setLang} />
			<View style={styles.authCenter}>
				<View style={styles.logoTile}>
					{config.server.logoUrl ? (
						<Image
							source={{ uri: config.server.logoUrl }}
							style={{ width: 56, height: 56 }}
						/>
					) : (
						icons.tooth(56, colors.primary)
					)}
				</View>
				<Text style={styles.authTitle}>
					Care from {config.identity.displayName},
				</Text>
				<Text style={[styles.authTitle, { color: colors.primary }]}>
					made personal.
				</Text>
				<Text style={styles.authBody}>
					A calmer way to manage your dental health, appointments, and patient
					card.
				</Text>
			</View>
			<Button label="Get started" compact onPress={() => go("welcome")} />
			<Text style={styles.authFoot}>Secure care for every smile · ጤና ጥርስ</Text>
		</View>
	);
}

export default Splash;
