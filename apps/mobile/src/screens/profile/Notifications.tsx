import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import { Notification } from "../../components/Notification";
import { useNotifications } from "../../context/NotificationContext";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { markMobileNotificationRead } from "../../api/client";
import { colors } from "../../constants/colors";

export function Notifications({ go }: { go: (screen: Screen) => void }) {
	const { refreshNotifications, markNotificationsRead } = useNotifications();
	const [notifications, setNotifications] = useState<Array<
		Record<string, unknown>
	> | null>(null);

	useEffect(() => {
		markNotificationsRead();
	}, [markNotificationsRead]);
	useEffect(() => {
		void refreshNotifications().then((items) => {
			setNotifications(items);
			void Promise.all(
				items.map((item) => markMobileNotificationRead(String(item.id))),
			)
				.then(() => {
					markNotificationsRead();
				})
				.catch(() => undefined);
		});
	}, [markNotificationsRead, refreshNotifications]);

	return (
		<>
			<Header
				title="Notifications"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				{notifications === null ? (
					<ActivityIndicator color={colors.primary} />
				) : null}
				{notifications?.map((item) => (
					<Notification
						key={String(item.id)}
						title={String(item.title)}
						body={String(item.message)}
						read={item.status === "READ"}
					/>
				))}
				{notifications?.length === 0 ? (
					<SectionTitle title="No notifications" />
				) : null}
			</ScrollView>
		</>
	);
}

export default Notifications;
