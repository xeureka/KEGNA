import React from "react";
import { View, ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { AuthHeader } from "../../components/AuthHeader";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function Terms({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	return (
		<View style={styles.authPage}>
			<AuthHeader
				onBack={() => go("back")}
				lang="EN"
				setLang={() => undefined}
			/>
			<ScrollView contentContainerStyle={styles.authScroll}>
				<Text style={styles.eyebrow}>TENADENT</Text>
				<Text style={styles.authTitle}>Terms and Conditions</Text>
				<Text style={styles.authBody}>
					By using {config.identity.displayName}, you agree to provide accurate
					information and keep your account details secure.
				</Text>
				<Card>
					<Text style={styles.cardTitle}>Your care and privacy</Text>
					<Text style={styles.muted}>
						We use your information to manage appointments, payments, and dental
						care. You can contact the clinic if you have questions about your
						account or treatment.
					</Text>
				</Card>
				<Button
					label="Back to registration"
					secondary
					onPress={() => go("back")}
				/>
			</ScrollView>
		</View>
	);
}

export default Terms;
