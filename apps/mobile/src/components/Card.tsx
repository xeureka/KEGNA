import React from "react";
import { View } from "react-native";
import { styles } from "../styles/commonStyles";

export const Card = ({
	children,
	accent = false,
}: {
	children: React.ReactNode;
	accent?: boolean;
}) => (
	<View style={[styles.card, accent && styles.accentCard]}>{children}</View>
);

export default Card;
