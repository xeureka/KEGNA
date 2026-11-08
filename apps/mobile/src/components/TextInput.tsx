import React from "react";
import { TextInput as RNTextInput } from "react-native";
import { useTranslation } from "react-i18next";

export const TextInput = ({
	placeholder,
	defaultValue,
	...props
}: React.ComponentProps<typeof RNTextInput>) => {
	const { t } = useTranslation();
	const translatedPlaceholder =
		typeof placeholder === "string"
			? t(placeholder, { defaultValue: placeholder })
			: placeholder;
	const translatedDefaultValue =
		typeof defaultValue === "string"
			? t(defaultValue, { defaultValue })
			: defaultValue;
	return (
		<RNTextInput
			{...props}
			placeholder={translatedPlaceholder}
			defaultValue={translatedDefaultValue}
		/>
	);
};

export default TextInput;
