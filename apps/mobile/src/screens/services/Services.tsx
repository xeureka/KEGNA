import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { icons } from "../../components/Icons";
import { useAppointment } from "../../context/AppointmentContext";
import { listMobileServices } from "../../api/client";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function Services({ go }: { go: (screen: Screen) => void }) {
	const { appointment, setAppointment } = useAppointment();
	const config = useTenantConfig();
	const [services, setServices] = useState<Array<
		Record<string, unknown>
	> | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		void listMobileServices()
			.then(setServices)
			.catch((reason) =>
				setError(
					reason instanceof Error ? reason.message : "Unable to load services",
				),
			);
	}, []);
	return (
		<>
			<Header
				title="Dental services"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={{ gap: 4 }}>
					<Text style={styles.heroTitle}>Dental services</Text>
					<Text style={styles.muted}>
						Explore treatments available at {config.identity.displayName}.
					</Text>
				</View>
				{services === null && !error ? (
					<ActivityIndicator color={colors.primary} />
				) : null}
				{error ? (
					<Card>
						<Text style={styles.muted}>{error}</Text>
					</Card>
				) : null}
				{services?.map((service) => {
					const title = String(service.name);
					const duration = service.durationMinutes
						? `${String(service.durationMinutes)} mins`
						: "Clinic duration";
					const price = service.price
						? `${String(service.price)} ETB`
						: "Contact clinic";
					return (
						<Card key={String(service.id)}>
							<View
								style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
							>
								<View style={styles.serviceIcon}>
									{icons.tooth(22, colors.primary)}
								</View>
								<View style={{ flex: 1 }}>
									<Text style={styles.cardTitle}>{title}</Text>
									<Text style={[styles.serviceMeta, { marginTop: 2 }]}>
										◷ {duration}
									</Text>
								</View>
							</View>
							<Text
								style={[
									styles.bodyStrong,
									{ fontSize: 13, lineHeight: 20, color: colors.ink },
								]}
							>
								{String(service.category ?? "Dental care service")}
							</Text>
							<Text style={[styles.muted, { fontSize: 12 }]}>
								✓ Available at {config.identity.displayName}
							</Text>
							<View style={styles.rule} />
							<View style={[styles.rowBetween, { alignItems: "center" }]}>
								<View>
									<Text style={[styles.muted, { fontSize: 11 }]}>
										Estimated fee
									</Text>
									<Text style={styles.price}>{price}</Text>
								</View>
								<Button
									label="Book visit"
									compact
									style={{ paddingHorizontal: 18 }}
									onPress={() => {
										setAppointment({
											...appointment,
											service: {
												title,
												description: String(service.category ?? ""),
												duration,
												price,
											},
										});
										go("booking");
									}}
								/>
							</View>
						</Card>
					);
				})}
				{services?.length === 0 ? (
					<Card>
						<Text style={styles.muted}>
							No services are configured for this tenant.
						</Text>
					</Card>
				) : null}
			</ScrollView>
		</>
	);
}

export default Services;
