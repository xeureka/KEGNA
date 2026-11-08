import React, { useEffect, useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import {
	cancelMobileAppointment,
	listAppointments,
	listMobileBills,
} from "../../api/client";
import { Alert } from "../../utils/alert";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { tenantConfig } from "../../config/tenant";
import { useAppointment } from "../../context/AppointmentContext";
import { useTenantConfig } from "../../context/TenantConfigContext";

function Visit({ title, date }: { title: string; date: string }) {
	return (
		<Card>
			<View style={styles.rowBetween}>
				<View>
					<Text style={styles.cardTitle}>{title}</Text>
					<Text style={styles.muted}>{date} · Completed</Text>
				</View>
				<Text style={styles.link}>Receipt 〉</Text>
			</View>
		</Card>
	);
}

export function Appointments({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	const { setReschedulingAppointmentId } = useAppointment();
	const [appointments, setAppointments] = useState<Array<
		Record<string, unknown>
	> | null>(null);
	const [bills, setBills] = useState<Array<Record<string, unknown>>>([]);
	const [appointmentCancelled, setAppointmentCancelled] = useState(false);
	useEffect(() => {
		void Promise.all([listAppointments(), listMobileBills()])
			.then(([appointmentsResult, billsResult]) => {
				setAppointments(appointmentsResult);
				setBills(billsResult);
			})
			.catch(() => setAppointments([]));
	}, []);

	const confirmCancellation = (id: string) =>
		Alert.alert(
			"Cancel appointment?",
			"Are you sure you want to cancel this appointment?",
			[
				{ text: "No", style: "cancel" },
				{
					text: "Yes, cancel it",
					style: "destructive",
					onPress: async () => {
						try {
							await cancelMobileAppointment(id);
							setAppointments(
								(current) =>
									current?.filter((item) => String(item.id) !== id) ?? [],
							);
							Alert.alert(
								"Appointment cancelled",
								"Your appointment has been cancelled.",
							);
						} catch (error) {
							Alert.alert(
								"Unable to cancel appointment",
								error instanceof Error ? error.message : "Please try again.",
							);
						}
					},
				},
			],
		);

	return (
		<>
			<Header
				title="My appointments"
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				{appointments === null ? (
					<ActivityIndicator color={tenantConfig.colors.primary} />
				) : null}
				{appointments && appointments.length > 0 && !appointmentCancelled && (
					<>
						<SectionTitle
							title="Upcoming"
							action="Book new"
							onAction={() => go("booking")}
						/>
						{appointments.map((item) => (
							<Card accent key={String(item.id)}>
								<Text style={styles.chip}>{String(item.status)}</Text>
								<Text style={styles.heroTitle}>
									{String(item.reason ?? "Dental appointment")}
								</Text>
								<Pressable onPress={() => go("doctorDetails")}>
									<Text style={styles.link}>
										{String(item.doctorName ?? "Dental care team")}
									</Text>
								</Pressable>
								<Text style={styles.bodyStrong}>
									{new Date(String(item.startAt)).toLocaleString()} ·{" "}
									{config.identity.displayName}
								</Text>
								<View style={styles.twoColumns}>
									<Button
										label="Reschedule"
										secondary
										style={{ flex: 1 }}
										onPress={() => {
											setReschedulingAppointmentId(String(item.id));
											go("booking");
										}}
									/>
									<Button
										label="Cancel"
										secondary
										style={{ flex: 1 }}
										onPress={() => confirmCancellation(String(item.id))}
									/>
								</View>
							</Card>
						))}
					</>
				)}
				{appointments?.length === 0 && !appointmentCancelled && (
					<Card>
						<Text style={styles.cardTitle}>No upcoming appointments</Text>
						<Text style={styles.muted}>Book a visit when you are ready.</Text>
						<Button
							label="Book new appointment"
							onPress={() => go("booking")}
						/>
					</Card>
				)}
				{appointmentCancelled && (
					<Card>
						<Text style={styles.cardTitle}>No upcoming appointments</Text>
						<Text style={styles.muted}>
							Your appointment was cancelled. You can book a new visit whenever
							you are ready.
						</Text>
						<Button
							label="Book new appointment"
							onPress={() => {
								setAppointmentCancelled(false);
								go("booking");
							}}
						/>
					</Card>
				)}
				{bills.length > 0 && (
					<>
						<SectionTitle title="Past visits" />
						{bills.map((bill) => (
							<Visit
								key={String(bill.id)}
								title={`Bill ${String(bill.billNumber)}`}
								date={String(bill.issuedAt ?? bill.status)}
							/>
						))}
					</>
				)}
				{bills.length === 0 && (
					<Card>
						<Text style={styles.cardTitle}>
							Past visits unlock after payment
						</Text>
						<Text style={styles.muted}>
							Complete a payment to view your completed visit history and
							receipts.
						</Text>
						<Button
							label="View payments"
							secondary
							onPress={() => go("payments")}
						/>
					</Card>
				)}
			</ScrollView>
		</>
	);
}

export default Appointments;
