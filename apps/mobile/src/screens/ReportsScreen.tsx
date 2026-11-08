import { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { CaretRight, Receipt } from "phosphor-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusLabel } from "../components/StatusLabel";
import { Text } from "../components/Text";
import { useAuth } from "../context/AuthContext";
import { useThreads } from "../hooks/useThreads";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { colors, radius, spacing } from "../constants/colors";
import { formatChatTimestamp } from "../utils/format";
export function ReportsScreen() { const { session } = useAuth(); const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>(); const { rows, loading, error, reload } = useThreads(); const reports = useMemo(() => rows.filter((row) => row.issue.status !== "open"), [rows]); if (loading) return <LoadingState label="Loading reports" />; if (error && !rows.length) return <ErrorState message={error} onRetry={reload} />; return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Text muted size={13}>{session?.user.role === "accountant" ? "Audit workspace" : "Sales workspace"}</Text><Text bold size={28}>Reports</Text><Text muted>Report history is built from your authorized load-out activity. Open a report for the full reconciliation.</Text>{reports.length ? reports.map((row) => <Pressable key={row.issue.id} onPress={() => navigation.navigate("Conversation", { issueId: row.issue.id })} style={styles.card}><View style={styles.icon}><Receipt color={colors.primary} size={22} /></View><View style={styles.body}><Text bold>{row.issue.issueNo}</Text><Text muted size={13}>{row.salesperson.name} · {formatChatTimestamp(row.lastEventAt ?? row.issue.issuedAt)}</Text></View><StatusLabel status={row.issue.status} /><CaretRight color={colors.muted} size={18} /></Pressable>) : <EmptyState title="No reports yet" message="Submitted reports will appear here once a load-out is reported." />}</ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }, card: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }, icon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }, body: { flex: 1, gap: spacing.xs } });
