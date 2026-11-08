import React from "react";
import { ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import { MenuRow } from "../../components/MenuRow";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function Support({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	return (
		<>
			<Header
				title="Help & support"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.heroTitle}>How can we help?</Text>
				<Text style={styles.muted}>
					Our care team is here when you need us.
				</Text>
				<Card>
					<MenuRow
						icon="☎"
						title={`Call ${config.identity.displayName}`}
						detail={config.clinic.supportPhone}
					/>
					<MenuRow
						icon="✉"
						title="Message support"
						detail={config.clinic.supportResponseTime}
					/>
					<MenuRow
						icon="⌖"
						title="Find a clinic"
						detail={`${config.clinic.address} · ${config.clinic.workingHours}`}
					/>
				</Card>
				<SectionTitle title="Common questions" />
				<Card>
					<MenuRow icon="＋" title="How do I reschedule?" />
					<MenuRow icon="＋" title="How are payments secured?" />
					<MenuRow icon="＋" title="What should I bring?" />
				</Card>
			</ScrollView>
		</>
	);
}

export default Support;
