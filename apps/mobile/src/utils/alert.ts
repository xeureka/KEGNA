import { Alert as RNAlert } from "react-native";
import i18n from "../i18n";

export const translate = (value: string) =>
	i18n.t(value, { defaultValue: value });

export const Alert = {
	alert: (title: string, message?: string, buttons?: any[]) =>
		RNAlert.alert(
			translate(title),
			message ? translate(message) : message,
			buttons?.map((button) => ({
				...button,
				text:
					typeof button.text === "string"
						? translate(button.text)
						: button.text,
			})),
		),
};

export default Alert;
