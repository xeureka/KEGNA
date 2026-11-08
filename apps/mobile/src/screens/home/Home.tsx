import React, { useEffect, useState } from "react";
import { View, ScrollView, Pressable, Image, Linking } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import { Action } from "../../components/Action";
import { icons } from "../../components/Icons";
import { useAppointment } from "../../context/AppointmentContext";
import { useAvatar } from "../../context/AvatarContext";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";
import { getMobileProfile, listAppointments } from "../../api/client";

export function Home({ go }: { go: (screen: Screen) => void }) {
	const { appointment, appointmentCancelled, setReschedulingAppointmentId } =
		useAppointment();
	const { avatarUri } = useAvatar();
	const config = useTenantConfig();
	const [profileName, setProfileName] = useState("Patient");
	const [patientNumber, setPatientNumber] = useState("Pending patient ID");
	const [membershipTier, setMembershipTier] = useState("");
	const [remoteAppointment, setRemoteAppointment] = useState<Record<
		string,
		unknown
	> | null>(null);
	useEffect(() => {
		void Promise.all([getMobileProfile(), listAppointments()])
			.then(([profile, appointments]) => {
				const patient = profile.patient as {
					firstName?: string;
					lastName?: string;
					patientNumber?: string;
					membershipTier?: string | null;
				} | null;
				setProfileName(
					patient
						? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() ||
								String(profile.user.name ?? "Patient")
						: String(profile.user.name ?? "Patient"),
				);
				setPatientNumber(patient?.patientNumber ?? "Pending patient ID");
				setMembershipTier(patient?.membershipTier ?? "");
				setRemoteAppointment(appointments[0] ?? null);
			})
			.catch(() => undefined);
	}, []);
	const activeAppointment = remoteAppointment
		? {
				...appointment,
				service: {
					...appointment.service,
					title: String(remoteAppointment.reason ?? appointment.service.title),
				},
				dentist: String(remoteAppointment.doctorName ?? appointment.dentist),
				date: new Date(String(remoteAppointment.startAt)).getDate(),
				time: new Date(String(remoteAppointment.startAt)).toLocaleTimeString(
					[],
					{ hour: "numeric", minute: "2-digit" },
				),
			}
		: appointment;

	return (
		<>
			<Header onNotifications={() => go("notifications")} />
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.welcomeRow}>
					<Pressable
						onPress={() => go("profile")}
						style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
					>
						{avatarUri ? (
							<Image source={{ uri: avatarUri }} style={styles.avatarImage} />
						) : (
							<Text style={styles.avatarText}>A</Text>
						)}
					</Pressable>
					<View style={{ flex: 1 }}>
						<Text style={styles.titleSmall}>Greetings, {profileName} 👋</Text>
					</View>
				</View>
				<Card>
					<View style={styles.rowBetween}>
						<View>
							<Text style={styles.eyebrow}>✓ DIGITAL DENTAL CARD</Text>
							<Text style={styles.cardTitle}>Active · {patientNumber}</Text>
							<Text style={styles.muted}>
								{membershipTier ? `${membershipTier} member` : "Standard Care"}{" "}
								· {config.identity.displayName}
							</Text>
						</View>
						<View style={styles.qr}>
							<Text style={styles.qrText}>▦</Text>
						</View>
					</View>
					<View style={styles.rule} />
					<Pressable onPress={() => go("card")}>
						<Text style={styles.link}>View digital card 〉</Text>
					</Pressable>
				</Card>
				{!appointmentCancelled && (
					<Card accent>
						<View style={styles.rowBetween}>
							<Text style={styles.chip}>UPCOMING VISIT</Text>
							<Text style={styles.confirmed}>CONFIRMED</Text>
						</View>
						<Text style={styles.heroTitle}>
							{activeAppointment.service.title}
						</Text>
						<Text style={styles.muted}>◉ {activeAppointment.dentist}</Text>
						<View style={styles.infoWell}>
							<Text style={styles.bodyStrong}>
								◷ {activeAppointment.month} · {activeAppointment.time}
							</Text>
							<Text style={styles.muted}>
								⌖ {appointment.clinic}, {config.clinic.address}
							</Text>
						</View>
						<View style={styles.twoColumns}>
							<Button
								label="Reschedule"
								secondary
								style={{ flex: 1 }}
								onPress={() => {
									setReschedulingAppointmentId(
										remoteAppointment ? String(remoteAppointment.id) : null,
									);
									go("booking");
								}}
							/>
							<Button
								label="Directions"
								style={{ flex: 1 }}
								onPress={() => {
									const query = encodeURIComponent(
										`${config.identity.displayName}, ${config.clinic.address}`,
									);
									void Linking.openURL(
										`https://www.google.com/maps/search/?api=1&query=${query}`,
									);
								}}
							/>
						</View>
					</Card>
				)}
				<SectionTitle
					title="Quick actions"
					action="See all"
					onAction={() => go("services")}
				/>
				<View style={styles.actionGrid}>
					<Action
						icon={icons.book(26, colors.primary)}
						label="Book visit"
						onPress={() => go("booking")}
					/>
					<Action
						icon={icons.card(26, colors.primary)}
						label="My card"
						onPress={() => go("card")}
					/>
					<Action
						icon={icons.tooth(26, colors.primary)}
						label="Services"
						onPress={() => go("services")}
					/>
					<Action
						icon={icons.pay(26, colors.primary)}
						label="Pay balance"
						onPress={() => go("payments")}
					/>
				</View>
				<SectionTitle title="Dental care tip" />
				<Card>
					<View style={styles.tipAccent}>
						<Text style={styles.tipTitle}>{config.content.homeTipTitle}</Text>
						<Text style={styles.muted}>{config.content.homeTip}</Text>
					</View>
				</Card>
			</ScrollView>
		</>
	);
}

export default Home;
