import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { AuthHeader } from "../../components/AuthHeader";
import { styles } from "../../styles/commonStyles";
import { useTenantConfig } from "../../context/TenantConfigContext";
import type { Screen } from "../../types";

export function Welcome({ go }: { go: (screen: Screen) => void }) {
	const [lang, setLang] = useState("EN");
	const config = useTenantConfig();
	return (
		<View style={styles.authPage}>
			<AuthHeader onBack={() => go("back")} lang={lang} setLang={setLang} />
			<ScrollView contentContainerStyle={styles.authScroll}>
				<View style={styles.welcomeIllustration}>
					<Text style={styles.logoMark}>☺️✨</Text>
					<Text style={styles.illustrationCaption}>YOUR SMILE, YOUR CARE</Text>
				</View>
				<Text style={styles.authTitle}>
					Welcome to {config.identity.displayName}
				</Text>
				<Text style={styles.authBody}>
					Book visits, keep your records close, and feel supported at every step
					of your dental journey.
				</Text>
				<Button label="Sign in" onPress={() => go("login")} />
				<Button
					label="Create an account"
					secondary
					onPress={() => go("register")}
				/>
				<Text style={styles.authFoot}>
					By continuing, you agree to our privacy policy.
				</Text>
			</ScrollView>
		</View>
	);
}

export default Welcome;
