import React, { useCallback, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { AuthHeader } from "../../components/AuthHeader";
import { Alert } from "../../utils/alert";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import {
	consumeAccountNotFoundPhone,
	requestPhoneOtp,
	setPendingRegistration,
} from "../../api/client";

export function Register({ go }: { go: (screen: Screen) => void }) {
	const [lang, setLang] = useState("EN");
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [phone, setPhone] = useState("");
	const [phoneNotFound, setPhoneNotFound] = useState(false);
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [sending, setSending] = useState(false);
	useFocusEffect(
		useCallback(() => {
			const accountNotFoundPhone = consumeAccountNotFoundPhone();
			if (accountNotFoundPhone) {
				setPhone(accountNotFoundPhone);
				setPhoneNotFound(true);
			}
		}, []),
	);
	return (
		<View style={styles.authPage}>
			<AuthHeader onBack={() => go("back")} lang={lang} setLang={setLang} />
			<ScrollView contentContainerStyle={styles.authScroll}>
				<Text style={styles.eyebrow}>NEW PATIENT</Text>
				<Text style={styles.authTitle}>Create your account</Text>
				<Text style={styles.authBody}>
					We will use your phone number to keep your care secure.
				</Text>
				{phoneNotFound ? (
					<Text style={[styles.authBody, { color: colors.primary }]}>
						No account found with this phone number. Create an account to
						continue.
					</Text>
				) : null}
				<Card>
					<Text style={styles.inputLabel}>First name</Text>
					<TextInput
						placeholder="Abebe"
						placeholderTextColor={colors.muted}
						style={styles.input}
						value={firstName}
						onChangeText={setFirstName}
					/>
					<Text style={styles.inputLabel}>Last name</Text>
					<TextInput
						placeholder="Tesfaye"
						placeholderTextColor={colors.muted}
						style={styles.input}
						value={lastName}
						onChangeText={setLastName}
					/>
					<Text style={styles.inputLabel}>Phone number</Text>
					<TextInput
						placeholder="+251 9..."
						placeholderTextColor={colors.muted}
						style={styles.input}
						keyboardType="phone-pad"
						value={phone}
						onChangeText={(value) => {
							setPhone(value);
							setPhoneNotFound(false);
						}}
					/>
					<Pressable
						onPress={() => setTermsAccepted((value) => !value)}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 10,
							marginTop: 6,
						}}
					>
						<View
							style={{
								width: 22,
								height: 22,
								borderRadius: 6,
								borderWidth: 1,
								borderColor: termsAccepted ? colors.primary : colors.border,
								backgroundColor: termsAccepted
									? colors.primary
									: colors.surface,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							{termsAccepted && (
								<Text style={{ color: colors.surface, fontWeight: "800" }}>
									✓
								</Text>
							)}
						</View>
						<Text style={[styles.muted, { flex: 1 }]}>
							I have read and agree to the{" "}
							<Text onPress={() => go("terms")} style={styles.link}>
								Terms and Conditions
							</Text>
							.
						</Text>
					</Pressable>
					<Button
						label="Send verification code"
						busy={sending}
						onPress={async () => {
							if (!termsAccepted)
								return Alert.alert(
									"Terms required",
									"Please confirm that you have read the Terms and Conditions to continue.",
								);
							if (!firstName.trim() || !lastName.trim())
								return Alert.alert(
									"Name required",
									"Enter your first and last name.",
								);
							if (!phone.trim())
								return Alert.alert(
									"Phone required",
									"Enter your phone number.",
								);
							try {
								setSending(true);
								setPendingRegistration({
									firstName: firstName.trim(),
									lastName: lastName.trim(),
								});
								await requestPhoneOtp(phone.trim());
								go("otp");
							} catch (error) {
								Alert.alert(
									"Unable to send code",
									error instanceof Error ? error.message : "Please try again.",
								);
							} finally {
								setSending(false);
							}
						}}
						style={!termsAccepted && { opacity: 0.55 }}
					/>
				</Card>
				<Text style={styles.authFoot}>
					Already have an account?{" "}
					<Text onPress={() => go("login")} style={styles.link}>
						Sign in
					</Text>
				</Text>
			</ScrollView>
		</View>
	);
}

export default Register;
