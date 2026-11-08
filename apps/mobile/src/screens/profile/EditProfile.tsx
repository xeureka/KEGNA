import React, { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { Alert } from "../../utils/alert";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { getMobileProfile, updateMobileProfile } from "../../api/client";

export function EditProfile({ go }: { go: (screen: Screen) => void }) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [dateOfBirth, setDateOfBirth] = useState("");
	const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
	const [phone, setPhone] = useState("");
	useEffect(() => {
		void getMobileProfile().then((result) => {
			setName(String(result.user.name ?? ""));
			setEmail(String(result.user.email ?? ""));
			setPhone(String(result.user.phone ?? ""));
			const patient = result.patient as Record<string, unknown> | null;
			setDateOfBirth(String(patient?.dateOfBirth ?? ""));
			setEmergencyContactPhone(String(patient?.emergencyContactPhone ?? ""));
		});
	}, []);
	return (
		<>
			<Header
				title="Edit profile"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.heroTitle}>Personal information</Text>
				<Card>
					<Text style={styles.inputLabel}>Full name</Text>
					<TextInput value={name} onChangeText={setName} style={styles.input} />
					<Text style={styles.inputLabel}>Phone number</Text>
					<TextInput
						value={phone}
						style={[styles.input, { color: colors.muted }]}
						keyboardType="phone-pad"
						editable={false}
					/>
					<Text style={styles.inputLabel}>Email address</Text>
					<TextInput
						value={email}
						onChangeText={setEmail}
						style={styles.input}
						keyboardType="email-address"
					/>
					<Text style={styles.inputLabel}>Date of birth</Text>
					<TextInput
						value={dateOfBirth}
						onChangeText={setDateOfBirth}
						style={styles.input}
					/>
				</Card>
				<Card>
					<Text style={styles.cardTitle}>Emergency & clinical</Text>
					<Text style={styles.inputLabel}>Emergency phone</Text>
					<TextInput
						value={emergencyContactPhone}
						onChangeText={setEmergencyContactPhone}
						style={styles.input}
						keyboardType="phone-pad"
					/>
					<Text style={styles.muted}>
						Changes to clinical and contact records are synced with your clinic
						file.
					</Text>
				</Card>
				<Button
					label="Save changes"
					onPress={async () => {
						try {
							await updateMobileProfile({
								name,
								email,
								dateOfBirth,
								emergencyContactPhone,
							});
							Alert.alert(
								"Profile updated",
								"Your changes were saved to the clinic profile.",
							);
							go("profile");
						} catch (error) {
							Alert.alert(
								"Unable to update profile",
								error instanceof Error ? error.message : "Please try again.",
							);
						}
					}}
				/>
			</ScrollView>
		</>
	);
}

export default EditProfile;
