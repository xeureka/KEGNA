import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { AuthHeader } from "../../components/AuthHeader";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import {
	checkPhoneExists,
	clearPendingRegistration,
	requestPhoneOtp,
	setAccountNotFoundPhone,
} from "../../api/client";

export function Login({ go }: { go: (screen: Screen) => void }) {
	const [lang, setLang] = useState("EN");
	const [phone, setPhone] = useState("");
	const [sending, setSending] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	return (
		<View style={styles.authPage}>
			<AuthHeader onBack={() => go("back")} lang={lang} setLang={setLang} />
			<ScrollView contentContainerStyle={styles.authScroll}>
				<Text style={styles.eyebrow}>✓ TENADENT SECURE ACCESS</Text>
				<Text style={styles.authTitle}>Welcome back</Text>
				<Text style={styles.authBody}>
					Sign in securely with your phone number and a one-time code.
				</Text>
				<Card>
					<Text style={styles.inputLabel}>Phone number</Text>
					<TextInput
						value={phone}
						onChangeText={setPhone}
						placeholder="+251 9..."
						placeholderTextColor={colors.muted}
						style={styles.input}
						keyboardType="phone-pad"
					/>
					<Button
						label={sending ? "Checking number and sending code" : "Sign in"}
						busy={sending}
						onPress={async () => {
							setErrorMessage("");
							setSending(true);
							clearPendingRegistration();
							try {
								const result = await checkPhoneExists(phone);
								if (!result.exists) {
									setAccountNotFoundPhone(result.phone);
									go("register");
									return;
								}
								await requestPhoneOtp(result.phone);
								go("otp");
							} catch (error) {
								setErrorMessage(
									error instanceof Error &&
										error.message.startsWith("Enter your phone")
										? error.message
										: "We couldn't check this number. Check your connection and try again.",
								);
							} finally {
								setSending(false);
							}
						}}
					/>
					{errorMessage ? (
						<Text style={[styles.authBody, { color: colors.danger }]}>
							{errorMessage}
						</Text>
					) : null}
				</Card>
				<Text style={styles.authFoot}>
					Don't have an account?{" "}
					<Text onPress={() => go("register")} style={styles.link}>
						Create account
					</Text>
				</Text>
			</ScrollView>
		</View>
	);
}

export default Login;
