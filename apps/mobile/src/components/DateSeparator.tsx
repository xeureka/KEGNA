import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../constants/colors";
import { Text } from "./Text";
export function DateSeparator({ label }: { label: string }) { return <View style={styles.wrap}><Text muted size={11} style={styles.text}>{label}</Text></View>; }
const styles = StyleSheet.create({ wrap: { alignItems: "center", marginVertical: spacing.sm }, text: { backgroundColor: colors.linen, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999 } });
