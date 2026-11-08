import React from "react";
import { View, Pressable } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Text } from "./Text";
import { icons } from "./Icons";
import { colors } from "../constants/colors";
import { styles } from "../styles/commonStyles";
import type { Screen } from "../types";

export function BottomNav({
	active,
	go,
	state,
	navigation,
}: {
	active?: Screen;
	go?: (screen: Screen) => void;
	state?: BottomTabBarProps["state"];
	navigation?: BottomTabBarProps["navigation"];
}) {
	const items: [Screen, keyof typeof icons, string][] = [
		["home", "home", "Home"],
		["appointments", "visits", "Visits"],
		["card", "card", "Card"],
		["payments", "pay", "Pay"],
		["profile", "profile", "Profile"],
	];

	const currentTab =
		active ?? (state ? (state.routes[state.index]?.name as Screen) : "home");

	return (
		<View style={styles.bottomNav}>
			{items.map(([screen, icon, label]) => {
				const isActive = currentTab === screen;
				const color = isActive ? colors.primary : colors.muted;

				return (
					<Pressable
						key={screen}
						onPress={() => {
							if (go) {
								go(screen);
								return;
							}
							if (navigation) {
								navigation.navigate(screen as never);
							}
						}}
						style={styles.navItem}
					>
						{icons[icon](22, color)}
						<Text
							style={[
								styles.navLabel,
								isActive && { color: colors.primary, fontWeight: "700" },
							]}
						>
							{label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

export default BottomNav;
