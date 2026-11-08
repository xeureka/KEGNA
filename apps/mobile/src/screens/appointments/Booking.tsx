import React, { useState, useEffect } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import { icons } from "../../components/Icons";
import { useAppointment } from "../../context/AppointmentContext";
import { dentalServices } from "../../constants/dentalServices";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import { bookingStyles } from "../../styles/bookingStyles";
import type { AppointmentService, Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";
import { Alert } from "../../utils/alert";
import {
	createVisitPayment,
	getPaymentConfig,
	listDoctors,
	listMobileServices,
	paymentErrorMessage,
	rescheduleMobileAppointment,
} from "../../api/client";
import { useChapaCheckout } from "../../hooks/useChapaCheckout";

export function Booking({ go }: { go: (screen: Screen) => void }) {
	const {
		appointment,
		setAppointment,
		setAppointmentCancelled,
		reschedulingAppointmentId,
		setReschedulingAppointmentId,
	} = useAppointment();
	const config = useTenantConfig();
	const today = new Date();
	const [step, setStep] = useState(1);
	const { startCheckout, busy } = useChapaCheckout({});
	const [selectedService, setSelectedService] = useState(
		appointment.service || dentalServices[0],
	);
	const [selectedDentist, setSelectedDentist] = useState(
		appointment.dentist || "Dr. Selamawit Tadesse",
	);
	const [selectedDate, setSelectedDate] = useState(
		appointment.month === "October 2026" ? today.getDate() : appointment.date,
	);
	const [selectedTime, setSelectedTime] = useState(
		appointment.time || "10:30 AM",
	);
	const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>(
		[],
	);
	const [services, setServices] =
		useState<AppointmentService[]>(dentalServices);
	const [selectedDoctorId, setSelectedDoctorId] = useState("");
	const [visibleMonth, setVisibleMonth] = useState(
		new Date(today.getFullYear(), today.getMonth(), 1),
	);
	const [serviceChargeEtb, setServiceChargeEtb] = useState<number | null>(null);
	useEffect(() => {
		void getPaymentConfig()
			.then((paymentConfig) =>
				setServiceChargeEtb(Number(paymentConfig.serviceChargeEtb)),
			)
			.catch(() => setServiceChargeEtb(null));
	}, []);
	useEffect(() => {
		void listDoctors()
			.then((result) => {
				const values = result.items.map((doctor) => ({
					id: String(doctor.id),
					name: String(doctor.userName ?? "Dental care team"),
				}));
				setDoctors(values);
				setSelectedDoctorId(values[0]?.id ?? "");
			})
			.catch(() => undefined);
	}, []);
	useEffect(() => {
		void listMobileServices()
			.then((result) => {
				const values = result
					.map((service) => ({
						id: String(service.id ?? ""),
						title: String(service.name ?? service.code ?? "Dental service"),
						description: String(service.category ?? "Available dental care"),
						duration: `${String(service.durationMinutes ?? 30)} mins`,
						price: `${String(service.inclusivePrice ?? service.price ?? "0")} ETB`,
						basePrice:
							service.price != null
								? `${String(service.price)} ETB`
								: undefined,
					}))
					.filter((service) => service.title.length > 0);
				if (values.length > 0) {
					setServices(values);
					if (!appointment.service?.id) setSelectedService(values[0]);
				}
			})
			.catch(() => undefined);
	}, [appointment.service]);

	useEffect(() => {
		if (appointment.service) {
			setSelectedService(appointment.service);
			setStep(1);
		}
	}, [appointment.service]);

	const goBack = () => (step > 1 ? setStep(step - 1) : go("back"));
	const next = async () => {
		if (step < 4) {
			setStep(step + 1);
		} else {
			if (!selectedDoctorId) return;
			const [clock, meridiem] = selectedTime.split(" ");
			let [hours, minutes] = clock.split(":").map(Number);
			if (meridiem === "PM" && hours < 12) hours += 12;
			if (meridiem === "AM" && hours === 12) hours = 0;
			const start = new Date(
				visibleMonth.getFullYear(),
				visibleMonth.getMonth(),
				selectedDate,
				hours,
				minutes,
			);
			if (start <= new Date()) {
				Alert.alert(
					"Choose a future time",
					"Appointments can only be booked for a future date and time.",
				);
				return;
			}
			try {
				const payload = {
					doctorId: selectedDoctorId,
					startAt: start.toISOString(),
					endAt: new Date(start.getTime() + 45 * 60 * 1000).toISOString(),
					reason: selectedService.title,
				};
				if (reschedulingAppointmentId) {
					await rescheduleMobileAppointment(reschedulingAppointmentId, {
						startAt: payload.startAt,
						endAt: payload.endAt,
					});
					setReschedulingAppointmentId(null);
				} else {
					if (!selectedService.id) {
						Alert.alert(
							"Service unavailable",
							"Please select a service loaded from the clinic catalog and try again.",
						);
						return;
					}
					const checkout = await createVisitPayment({
						serviceId: selectedService.id,
						doctorId: selectedDoctorId,
						startAt: payload.startAt,
					});
					const status = await startCheckout(
						checkout.checkout_url,
						checkout.tx_ref,
					);
					if (status !== "SUCCESS") {
						Alert.alert(
							status === "PENDING"
								? "Payment is processing"
								: "Payment not completed",
							status === "PENDING"
								? "We are still confirming your payment. Reopen the app to check again."
								: "Your appointment was not confirmed. You can choose another time and try again.",
						);
						return;
					}
				}
			} catch (error) {
				Alert.alert(
					"Unable to book appointment",
					paymentErrorMessage(
						error,
						"We couldn't start your booking. Please try again.",
					),
				);
				return;
			}
			setAppointment({
				service: selectedService,
				dentist: selectedDentist,
				date: selectedDate,
				month: visibleMonth.toLocaleDateString("en-US", {
					month: "long",
					year: "numeric",
				}),
				time: selectedTime,
				clinic: config.identity.displayName,
			});
			setAppointmentCancelled(false);
			go("appointmentConfirmation");
		}
	};

	const dentists = doctors;
	const morningTimes = [
		"08:30 AM",
		"09:15 AM",
		"10:00 AM",
		"10:45 AM",
		"11:30 AM",
	];
	const afternoonTimes = [
		"02:00 PM",
		"02:45 PM",
		"03:30 PM",
		"04:15 PM",
		"05:00 PM",
	];
	const monthName = visibleMonth.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
	const daysInMonth = new Date(
		visibleMonth.getFullYear(),
		visibleMonth.getMonth() + 1,
		0,
	).getDate();
	const firstDay = new Date(
		visibleMonth.getFullYear(),
		visibleMonth.getMonth(),
		1,
	).getDay();
	const changeMonth = (offset: number) => {
		const nextMonth = new Date(
			visibleMonth.getFullYear(),
			visibleMonth.getMonth() + offset,
			1,
		);
		if (nextMonth < new Date(today.getFullYear(), today.getMonth(), 1)) return;
		setVisibleMonth(nextMonth);
		setSelectedDate(
			nextMonth.getFullYear() === today.getFullYear() &&
				nextMonth.getMonth() === today.getMonth()
				? today.getDate()
				: 1,
		);
	};
	const isPastDay = (day: number) =>
		new Date(
			visibleMonth.getFullYear(),
			visibleMonth.getMonth(),
			day,
			23,
			59,
			59,
		) < today;
	const parseTime = (time: string) => {
		const [clock, meridiem] = time.split(" ");
		let [hours, minutes] = clock.split(":").map(Number);
		if (meridiem === "PM" && hours < 12) hours += 12;
		if (meridiem === "AM" && hours === 12) hours = 0;
		return new Date(
			visibleMonth.getFullYear(),
			visibleMonth.getMonth(),
			selectedDate,
			hours,
			minutes,
		);
	};
	const isPastTime = (time: string) =>
		isPastDay(selectedDate) || parseTime(time) <= today;

	return (
		<>
			<Header
				title={
					reschedulingAppointmentId
						? "Reschedule appointment"
						: "Book appointment"
				}
				onBack={goBack}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<View style={styles.stepRow}>
					<Text style={styles.eyebrow}>STEP {step} OF 4</Text>
					<Text style={styles.muted}>Approx. 2 mins</Text>
				</View>
				<View style={styles.progress}>
					<View style={[styles.progressFill, { width: `${step * 25}%` }]} />
				</View>
				{step === 1 && (
					<>
						<SectionTitle title="Select dental service" />
						<Text style={styles.muted}>
							Choose the service you want to book.
						</Text>
						{services.map((service) => (
							<Pressable
								key={service.title}
								style={[
									styles.serviceCard,
									selectedService.title === service.title &&
										styles.selectedCard,
								]}
								onPress={() => setSelectedService(service)}
							>
								<View style={styles.serviceIcon}>
									{icons.tooth(22, colors.primary)}
								</View>
								<View style={{ flex: 1 }}>
									<Text style={styles.cardTitle}>{service.title}</Text>
									<Text style={styles.muted}>{service.description}</Text>
									<Text style={styles.serviceMeta}>
										◷ {service.duration} · {service.price}
									</Text>
								</View>
								<Text style={styles.radio}>
									{selectedService.title === service.title ? "✓" : "○"}
								</Text>
							</Pressable>
						))}
						<SectionTitle title="Choose your dentist" />
						{dentists.map((dentist, index) => (
							<Pressable
								key={dentist.id}
								style={[
									styles.serviceCard,
									selectedDoctorId === dentist.id && styles.selectedCard,
								]}
								onPress={() => {
									setSelectedDentist(dentist.name);
									setSelectedDoctorId(dentist.id);
								}}
							>
								<View style={styles.avatar}>
									<Text style={styles.avatarText}>
										{dentist.name.slice(0, 1)}
									</Text>
								</View>
								<View style={{ flex: 1 }}>
									<Text style={styles.cardTitle}>{dentist.name}</Text>
									<Text style={styles.muted}>
										{index === 0
											? "General Dental Surgeon"
											: "Available specialist"}
									</Text>
								</View>
								<Text style={styles.radio}>
									{selectedDoctorId === dentist.id ? "✓" : "○"}
								</Text>
							</Pressable>
						))}
						<View style={{ marginTop: 8 }}>
							<Button label="Proceed" onPress={next} />
						</View>
					</>
				)}
				{step === 2 && (
					<>
						<SectionTitle title="Choose date" />
						<Text style={styles.muted}>
							{config.identity.displayName} · {config.clinic.address}
						</Text>
						<Card>
							<View style={bookingStyles.calendarHeader}>
								<Pressable
									accessibilityLabel="Previous month"
									onPress={() => changeMonth(-1)}
									style={bookingStyles.monthArrow}
								>
									<Text style={bookingStyles.monthArrowText}>‹</Text>
								</Pressable>
								<View style={{ alignItems: "center" }}>
									<Text style={styles.cardTitle}>{monthName}</Text>
									<Text style={styles.muted}>Select a day</Text>
								</View>
								<Pressable
									accessibilityLabel="Next month"
									onPress={() => changeMonth(1)}
									style={bookingStyles.monthArrow}
								>
									<Text style={bookingStyles.monthArrowText}>›</Text>
								</Pressable>
							</View>
							<View style={bookingStyles.weekRow}>
								{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
									<Text key={`${day}-${index}`} style={bookingStyles.weekDay}>
										{day}
									</Text>
								))}
							</View>
							<View style={bookingStyles.calendarGrid}>
								{Array.from({ length: firstDay }, (_, i) => (
									<View key={`empty-${i}`} style={bookingStyles.dayCell} />
								))}
								{Array.from(
									{ length: daysInMonth },
									(_, index) => index + 1,
								).map((day) => {
									const isSelected = selectedDate === day;
									const disabled = isPastDay(day);
									return (
										<View key={day} style={bookingStyles.dayCell}>
											<Pressable
												disabled={disabled}
												onPress={() => setSelectedDate(day)}
												style={[
													bookingStyles.dayCircle,
													isSelected && bookingStyles.dayCircleSelected,
													disabled && { opacity: 0.3 },
												]}
											>
												<Text
													style={[
														bookingStyles.dayText,
														isSelected && bookingStyles.dayTextSelected,
													]}
												>
													{day}
												</Text>
											</Pressable>
										</View>
									);
								})}
							</View>
							<View style={bookingStyles.selectedDatePill}>
								<Text style={bookingStyles.selectedDateText}>
									Selected date:{" "}
									{new Date(
										visibleMonth.getFullYear(),
										visibleMonth.getMonth(),
										selectedDate,
									).toLocaleDateString("en-US", {
										weekday: "long",
										month: "long",
										day: "numeric",
										year: "numeric",
									})}
								</Text>
							</View>
						</Card>
						<View style={{ marginTop: 8 }}>
							<Button label="Proceed" onPress={next} />
						</View>
					</>
				)}
				{step === 3 && (
					<>
						<SectionTitle title="Choose time" />
						<Text style={styles.muted}>
							{monthName} {selectedDate} · {config.identity.displayName}
						</Text>
						<Card>
							<Text style={bookingStyles.slotHeading}>Morning</Text>
							<View style={bookingStyles.timeGrid}>
								{morningTimes.map((time) => {
									const isSelected = selectedTime === time;
									const disabled = isPastTime(time);
									return (
										<Pressable
											key={time}
											disabled={disabled}
											onPress={() => setSelectedTime(time)}
											style={[
												bookingStyles.timeChip,
												isSelected && bookingStyles.timeChipSelected,
												disabled && { opacity: 0.35 },
											]}
										>
											<Text
												style={[
													bookingStyles.timeChipText,
													isSelected && bookingStyles.timeChipTextSelected,
												]}
											>
												{time}
											</Text>
										</Pressable>
									);
								})}
							</View>
							<Text style={[bookingStyles.slotHeading, { marginTop: 14 }]}>
								Afternoon
							</Text>
							<View style={bookingStyles.timeGrid}>
								{afternoonTimes.map((time) => {
									const isSelected = selectedTime === time;
									const disabled = isPastTime(time);
									return (
										<Pressable
											key={time}
											disabled={disabled}
											onPress={() => setSelectedTime(time)}
											style={[
												bookingStyles.timeChip,
												isSelected && bookingStyles.timeChipSelected,
												disabled && { opacity: 0.35 },
											]}
										>
											<Text
												style={[
													bookingStyles.timeChipText,
													isSelected && bookingStyles.timeChipTextSelected,
												]}
											>
												{time}
											</Text>
										</Pressable>
									);
								})}
							</View>
							<View style={bookingStyles.selectedDatePill}>
								<Text style={bookingStyles.selectedDateText}>
									Selected slot: {selectedTime}
								</Text>
							</View>
						</Card>
						<View style={{ marginTop: 8 }}>
							<Button label="Proceed" onPress={next} />
						</View>
					</>
				)}
				{step === 4 && (
					<>
						<SectionTitle title="Review appointment" />
						<Card>
							<Text style={styles.eyebrow}>YOUR VISIT</Text>
							<Text style={styles.heroTitle}>{selectedService.title}</Text>
							<Text style={styles.muted}>{selectedDentist}</Text>
							<View style={styles.infoWell}>
								<Text style={styles.bodyStrong}>
									{monthName} {selectedDate} · {selectedTime}
								</Text>
								<Text style={styles.muted}>
									{config.identity.displayName}, {config.clinic.address}
								</Text>
							</View>
							<View style={styles.rowBetween}>
								<Text style={styles.muted}>Service</Text>
								<Text style={styles.muted}>
									{selectedService.basePrice ?? selectedService.price}
								</Text>
							</View>
							{serviceChargeEtb !== null && (
								<View style={styles.rowBetween}>
									<Text style={styles.muted}>Platform service fee</Text>
									<Text style={styles.muted}>
										{serviceChargeEtb.toFixed(2)} ETB
									</Text>
								</View>
							)}
							<View style={styles.rowBetween}>
								<Text style={styles.muted}>Total</Text>
								<Text style={styles.price}>{selectedService.price}</Text>
							</View>
						</Card>
						<View style={{ gap: 10, marginTop: 8 }}>
							<Button
								label={
									reschedulingAppointmentId
										? "Confirm new appointment time"
										: `Pay ${selectedService.price}`
								}
								onPress={next}
								busy={busy}
							/>
							<Button
								label="Edit details"
								secondary
								onPress={() => setStep(3)}
							/>
						</View>
					</>
				)}
			</ScrollView>
		</>
	);
}

export default Booking;
