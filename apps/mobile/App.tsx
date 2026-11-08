import React, { useState, useEffect, useCallback } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import i18n from "./src/i18n";
import { LanguageContext, type Language } from "./src/context/LanguageContext";
import {
	AppointmentContext,
	initialAppointment,
	type Appointment,
} from "./src/context/AppointmentContext";
import { PaymentContext } from "./src/context/PaymentContext";
import { NotificationContext } from "./src/context/NotificationContext";
import { AvatarContext } from "./src/context/AvatarContext";
import { TenantConfigProvider } from "./src/context/TenantConfigContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { styles } from "./src/styles/commonStyles";
import {
	listMobileNotifications,
	pendingPayment,
	verifyPaymentStatus,
} from "./src/api/client";
import type { MobileNotification } from "./src/context/NotificationContext";

export default function App() {
	const [language, setLanguage] = useState<Language>("EN");
	const [appointment, setAppointment] =
		useState<Appointment>(initialAppointment);
	const [appointmentCancelled, setAppointmentCancelled] = useState(false);
	const [reschedulingAppointmentId, setReschedulingAppointmentId] = useState<
		string | null
	>(null);
	const [paymentVerified, setPaymentVerified] = useState(false);
	const [hasUnread, setHasUnread] = useState(true);
	const [notifications, setNotifications] = useState<MobileNotification[]>([]);
	const [avatarUri, setAvatarUri] = useState<string | undefined>();

	useEffect(() => {
		void i18n.changeLanguage(language === "EN" ? "en" : "am");
	}, [language]);

	const refreshNotifications = useCallback(async () => {
		try {
			const next = (await listMobileNotifications()).toSorted((a, b) =>
				String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
			);
			setNotifications(next);
			setHasUnread(next.length > 0);
			return next;
		} catch {
			return [];
		}
	}, []);

	const recheckPendingVisitPayment = useCallback(async () => {
		const txRef = await pendingPayment.get();
		if (!txRef) return;
		try {
			const result = await verifyPaymentStatus(txRef);
			if (["SUCCESS", "FAILED", "CANCELLED", "EXPIRED"].includes(result.status))
				await pendingPayment.clear();
		} catch {
			// Keep the reference so a later launch/foreground can safely retry.
		}
	}, []);

	useEffect(() => {
		void refreshNotifications();
		void recheckPendingVisitPayment();
		const interval = setInterval(
			() => void refreshNotifications(),
			20 * 60 * 1000,
		);
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				void refreshNotifications();
				void recheckPendingVisitPayment();
			}
		});
		return () => {
			clearInterval(interval);
			subscription.remove();
		};
	}, [refreshNotifications, recheckPendingVisitPayment]);

	return (
		<TenantConfigProvider>
			<LanguageContext.Provider value={{ language, setLanguage }}>
				<AppointmentContext.Provider
					value={{
						appointment,
						setAppointment,
						appointmentCancelled,
						setAppointmentCancelled,
						reschedulingAppointmentId,
						setReschedulingAppointmentId,
					}}
				>
					<PaymentContext.Provider
						value={{ paymentVerified, setPaymentVerified }}
					>
						<NotificationContext.Provider
							value={{
								hasUnread,
								notifications,
								refreshNotifications,
								markNotificationsRead: () => setHasUnread(false),
							}}
						>
							<AvatarContext.Provider value={{ avatarUri, setAvatarUri }}>
								<SafeAreaProvider>
									<NavigationContainer>
										<SafeAreaView style={styles.app} edges={["top", "bottom"]}>
											<StatusBar style="dark" />
											<AppNavigator />
										</SafeAreaView>
									</NavigationContainer>
								</SafeAreaProvider>
							</AvatarContext.Provider>
						</NotificationContext.Provider>
					</PaymentContext.Provider>
				</AppointmentContext.Provider>
			</LanguageContext.Provider>
		</TenantConfigProvider>
	);
}
