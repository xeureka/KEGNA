import { StyleSheet, TextInput as NativeTextInput, type TextInputProps } from "react-native";
import { colors, radius, spacing } from "../constants/colors";

export function TextInput({ style, ...props }: TextInputProps) {
	return <NativeTextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...props} />;
}

const styles = StyleSheet.create({ input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.ink, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: spacing.sm } });
