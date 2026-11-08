import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import { Detail } from "../../components/Detail";
import { styles } from "../../styles/commonStyles";
import { colors } from "../../constants/colors";
import type { Screen } from "../../types";
import { getMobileProfile, listPurchasedCards } from "../../api/client";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function CardScreen({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	const [profile, setProfile] = useState<{
		name?: string;
		patientNumber?: string;
		membershipTier?: string | null;
	} | null>(null);
	const [cards, setCards] = useState<Array<Record<string, unknown>>>([]);
	useEffect(() => {
		void Promise.all([getMobileProfile(), listPurchasedCards()]).then(
			([result, purchased]) => {
				setCards(purchased);
				const patient = result.patient as {
					firstName?: string;
					lastName?: string;
					patientNumber?: string;
					membershipTier?: string | null;
				} | null;
				setProfile({
					name: patient
						? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim()
						: String(result.user.name ?? ""),
					patientNumber: patient?.patientNumber,
					membershipTier: patient?.membershipTier,
				});
			},
		);
	}, []);
	return (
		<>
			<Header
				title="Digital dental card"
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.muted}>Your verified patient identity</Text>
				{!profile ? (
					<ActivityIndicator color={colors.primary} />
				) : (
					<View style={styles.digitalCard}>
						<Text style={styles.digitalBrand}>
							{config.identity.displayName}
						</Text>
						<Text style={styles.digitalName}>{profile.name || "Patient"}</Text>
						<Text style={styles.digitalId}>
							{profile.patientNumber ?? "Pending patient ID"}
						</Text>
						<View style={styles.digitalBottom}>
							<View>
								<Text style={{ color: colors.onPrimary }}>
									{String(
										(cards[0]?.card as Record<string, unknown> | undefined)
											?.name ?? "Patient identity card",
									)}
								</Text>
								{profile?.membershipTier ? (
									<Text
										style={{
											color: colors.onPrimary,
											fontSize: 11,
											fontWeight: "800",
											marginTop: 4,
										}}
									>
										{profile.membershipTier.toUpperCase()} MEMBER
									</Text>
								) : null}
							</View>
							<Text style={styles.digitalQr}>▦</Text>
						</View>
					</View>
				)}
				<Card>
					<SectionTitle title="Card details" />
					<Detail
						label="Membership"
						value={
							cards.some((card) => card.status === "active")
								? "Active"
								: "No active membership"
						}
					/>
					{profile?.membershipTier ? (
						<Detail label="Tier" value={profile.membershipTier} />
					) : null}
					{cards.map((card) => (
						<Detail
							key={String(card.id)}
							label={String(
								(card.card as Record<string, unknown> | undefined)?.name ??
									"Dental card",
							)}
							value={String(card.status ?? "pending")}
						/>
					))}
					<Detail label="Home clinic" value={config.identity.displayName} />
					<Detail label="National Care ID" value="Synced" />
				</Card>
				<Button
					label="View payment history"
					secondary
					onPress={() => go("payments")}
				/>
				<Button
					label="Explore card plans"
					secondary
					onPress={() => go("cardInactive")}
				/>
			</ScrollView>
		</>
	);
}

export default CardScreen;
