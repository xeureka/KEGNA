import React from "react";
import { View, ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { useAppointment } from "../../context/AppointmentContext";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import { confirmationStyles } from "../../styles/bookingStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function AppointmentConfirmation({
	go,
}: {
	go: (screen: Screen) => void;
}) {
	const { appointment } = useAppointment();
	const config = useTenantConfig();
	return (
		<>
			<Header
				title="Appointment confirmed"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={confirmationStyles.heroSection}>
					<View style={styles.successIcon}>
						<Text
							style={{ color: colors.surface, fontSize: 36, fontWeight: "800" }}
						>
							✓
						</Text>
					</View>
					<Text style={styles.authTitle}>Appointment Confirmed!</Text>
					<Text style={styles.authBody}>
						Your visit is booked and your care team is ready for you.
					</Text>
				</View>
				<Card accent>
					<View style={styles.rowBetween}>
						<Text style={styles.chip}>CONFIRMED · OCT {appointment.date}</Text>
						<Text style={styles.confirmed}>ACTIVE VISIT</Text>
					</View>
					<Text style={styles.heroTitle}>{appointment.service.title}</Text>
					<Text style={styles.muted}>◉ {appointment.dentist}</Text>
					<View style={styles.infoWell}>
						<Text style={styles.bodyStrong}>
							{appointment.month} · {appointment.time}
						</Text>
						<Text style={styles.muted}>
							⌖ {appointment.clinic}, {config.clinic.address}
						</Text>
					</View>
					<View style={styles.rowBetween}>
						<Text style={styles.muted}>Estimated fee</Text>
						<Text style={styles.price}>{appointment.service.price}</Text>
					</View>
				</Card>
				<View style={confirmationStyles.actions}>
					<Button
						label="View in My Appointments"
						onPress={() => go("appointments")}
					/>
					<Button label="Back to home" secondary onPress={() => go("home")} />
				</View>
			</ScrollView>
		</>
	);
}

export default AppointmentConfirmation;
