import React from "react";
import { ScrollView } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import { MenuRow } from "../../components/MenuRow";
import { Alert } from "../../utils/alert";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function Settings({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	return (
		<>
			<Header
				title="Settings"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<SectionTitle title="Preferences" />
				<Card>
					<MenuRow
						icon="文"
						title="Language"
						detail="English"
						onPress={() =>
							Alert.alert(
								"Language",
								"Language settings are ready to configure.",
							)
						}
					/>
					<MenuRow
						icon="•"
						title="Notifications"
						detail="Manage alerts"
						onPress={() => go("notifications")}
					/>
					<MenuRow
						icon="☎"
						title="Change phone number"
						detail="Contact the clinic to update it"
						onPress={() =>
							Alert.alert(
								"Change phone number",
								"Please contact your clinic so your patient record stays secure.",
							)
						}
					/>
				</Card>
				<SectionTitle title="Privacy & information" />
				<Card>
					<MenuRow
						icon="▣"
						title="Privacy"
						onPress={() =>
							Alert.alert(
								"Privacy",
								"Your information is used to manage your dental care, appointments, and payments.",
							)
						}
					/>
					<MenuRow
						icon="▤"
						title="Terms & Conditions"
						onPress={() => go("terms")}
					/>
					<MenuRow
						icon="ⓘ"
						title={`About ${config.identity.displayName}`}
						onPress={() =>
							Alert.alert(
								`About ${config.identity.displayName}`,
								`${config.identity.displayName} ${config.content.about}`,
							)
						}
					/>
				</Card>
				<Button label="Logout" secondary onPress={() => go("splash")} />
			</ScrollView>
		</>
	);
}

export default Settings;
