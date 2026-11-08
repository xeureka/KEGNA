import React from "react";
import { Text as RNText } from "react-native";
import { useTranslation } from "react-i18next";

export const Text = ({
	children,
	...props
}: React.ComponentProps<typeof RNText>) => {
	const { t } = useTranslation();
	const translated =
		typeof children === "string"
			? t(children, { defaultValue: children })
			: children;
	return <RNText {...props}>{translated}</RNText>;
};

export default Text;
