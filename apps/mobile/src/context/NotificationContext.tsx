import { createContext, useContext } from "react";

export type MobileNotification = Record<string, unknown>;

export const NotificationContext = createContext<{
	hasUnread: boolean;
	notifications: MobileNotification[];
	refreshNotifications: () => Promise<MobileNotification[]>;
	markNotificationsRead: () => void;
}>({
	hasUnread: true,
	notifications: [],
	refreshNotifications: async () => [],
	markNotificationsRead: () => undefined,
});

export const useNotifications = () => useContext(NotificationContext);

export default NotificationContext;
