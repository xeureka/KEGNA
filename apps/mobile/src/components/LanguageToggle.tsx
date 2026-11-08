import React from "react";
import { Pressable, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { Text } from "./Text";
import { styles } from "../styles/commonStyles";

export const LanguageToggle = () => {
	const { language, setLanguage } = useLanguage();
	return (
		<View style={styles.languagePill}>
			<Pressable
				onPress={() => setLanguage("EN")}
				style={[
					styles.languageButton,
					language === "EN" && styles.languageActive,
				]}
			>
				<Text>EN</Text>
			</Pressable>
			<Pressable
				onPress={() => setLanguage("አማ")}
				style={[
					styles.languageButton,
					language === "አማ" && styles.languageActive,
				]}
			>
				<Text>አማ</Text>
			</Pressable>
		</View>
	);
};

export default LanguageToggle;
