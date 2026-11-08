import React, { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { AuthHeader } from "../../components/AuthHeader";
import { Alert } from "../../utils/alert";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function CompleteProfile({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	const [lang, setLang] = useState("EN");
	return (
		<View style={styles.authPage}>
			<AuthHeader onBack={() => go("back")} lang={lang} setLang={setLang} />
			<ScrollView contentContainerStyle={styles.authScroll}>
				<Text style={styles.eyebrow}>STEP 3 OF 3</Text>
				<Text style={styles.authTitle}>Complete your profile</Text>
				<Text style={styles.authBody}>
					A few details help us personalize your care.
				</Text>
				<Card>
					<Text style={styles.inputLabel}>Date of birth</Text>
					<TextInput
						placeholder="DD / MM / YYYY"
						placeholderTextColor={colors.muted}
						style={styles.input}
					/>
					<Text style={styles.inputLabel}>Preferred clinic</Text>
					<Pressable
						onPress={() =>
							Alert.alert(
								"Preferred clinic",
								`${config.identity.displayName} selected.`,
							)
						}
						style={styles.input}
					>
						<Text style={styles.muted}>{config.identity.displayName} ⌄</Text>
					</Pressable>
					<Button label="Finish setup" onPress={() => go("home")} />
				</Card>
			</ScrollView>
		</View>
	);
}

export default CompleteProfile;
