import React from "react";
import { View, ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { Detail } from "../../components/Detail";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function DoctorDetails({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	return (
		<>
			<Header
				title="Doctor details"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<Card>
					<View style={styles.profileHero}>
						<View style={styles.avatarLarge}>
							<Text style={styles.avatarText}>S</Text>
						</View>
						<Text style={styles.heroTitle}>Dr. Selamawit Tadesse</Text>
						<Text style={styles.muted}>General Dental Surgeon</Text>
					</View>
					<Detail
						label="Specialization"
						value="General dentistry and restorative care"
					/>
					<Detail label="Experience" value="8 years" />
					<Detail label="Clinic" value={config.identity.displayName} />
					<Text style={styles.muted}>
						Dr. Selamawit provides preventive care, dental examinations,
						cleanings, and tooth restoration treatments.
					</Text>
				</Card>
			</ScrollView>
		</>
	);
}

export default DoctorDetails;
