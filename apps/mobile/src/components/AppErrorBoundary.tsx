import React from "react";
import { Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import { WarningCircle, ArrowClockwise } from "phosphor-react-native";
import { colors, spacing } from "../constants/colors";
import { Text } from "./Text";

type ErrorListener = (error: Error) => void;
const listeners = new Set<ErrorListener>();
export function reportGlobalError(error: Error) { console.error("[ZOLA mobile] unhandled error", error); listeners.forEach((listener) => listener(error)); }

type State = { error: Error | null };
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
	state: State = { error: null };
	componentDidMount() { listeners.add(this.onGlobalError); }
	componentWillUnmount() { listeners.delete(this.onGlobalError); }
	componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("[ZOLA mobile] render error", error, info.componentStack); }
	onGlobalError = (error: Error) => { this.setState({ error }); };
	retry = () => { this.setState({ error: null }); };
	render() {
		if (!this.state.error) return this.props.children;
		const detail = __DEV__ ? `${this.state.error.message}\n${this.state.error.stack?.split("\n").slice(0, 3).join("\n") ?? ""}` : "Something went wrong while loading the app.";
		return <SafeAreaView style={styles.page}><View style={styles.card}><WarningCircle color={colors.danger} size={32} /><Text bold size={20}>We hit a problem</Text><Text muted style={styles.detail}>{detail}</Text><Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}><ArrowClockwise color={colors.onPrimary} size={18} /><Text style={styles.buttonText}>Try again</Text></Pressable></View></SafeAreaView>;
	}
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.xl }, card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: spacing.xl, gap: spacing.md }, detail: { lineHeight: 20 }, button: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primary, padding: spacing.md }, buttonText: { color: colors.onPrimary }});
