import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { styles } from "../../styles/commonStyles";
import { colors } from "../../constants/colors";
import { listDentalHistory } from "../../api/client";
import type { Screen } from "../../types";

export function DentalHistory({ go }: { go: (screen: Screen) => void }) {
	const [history, setHistory] = useState<Array<Record<string, unknown>> | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		void listDentalHistory()
			.then(setHistory)
			.catch((reason) =>
				setError(
					reason instanceof Error
						? reason.message
						: "Unable to load dental history",
				),
			);
	}, []);
	return (
		<>
			<Header
				title="My dental history"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.muted}>Doctor-provided treatment records</Text>
				{history === null && !error ? (
					<ActivityIndicator color={colors.primary} />
				) : null}
				{error ? (
					<Card>
						<Text style={styles.muted}>{error}</Text>
					</Card>
				) : null}
				{history?.map((item) => (
					<Card key={String(item.id)}>
						<Text style={styles.eyebrow}>
							{new Date(String(item.date)).toLocaleDateString()}
						</Text>
						<Text style={styles.cardTitle}>{String(item.title)}</Text>
						<Text style={styles.muted}>
							{String(item.notes || "No notes provided")}
						</Text>
						{item.diagnosis ? (
							<Text style={styles.muted}>
								Diagnosis: {String(item.diagnosis)}
							</Text>
						) : null}
					</Card>
				))}
				{history?.length === 0 ? (
					<Card>
						<Text style={styles.muted}>
							No dental history is available yet.
						</Text>
					</Card>
				) : null}
			</ScrollView>
		</>
	);
}

export default DentalHistory;
