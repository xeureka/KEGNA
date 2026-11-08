import { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { getFinanceOverview } from "../api/client";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Text } from "../components/Text";
import { colors, spacing } from "../constants/colors";
export function FinanceStockScreen() { const [data, setData] = useState<Awaited<ReturnType<typeof getFinanceOverview>> | null>(null); const [error, setError] = useState<string | null>(null); const load = useCallback(() => { setError(null); return getFinanceOverview().then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load stock")); }, []); useEffect(() => { void load(); }, [load]); if (error) return <ErrorState message={error} onRetry={() => void load()} />; if (!data) return <LoadingState label="Loading stock" />; return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Text bold size={22}>Stock</Text>{data.stock_per_beverage.map((row) => <View key={row.beverage.id} style={styles.card}><Text bold>{row.beverage.name}</Text><Text>Warehouse {row.warehouse_racks} racks</Text><Text muted>Out with sales reps: {row.racks_out_with_reps}</Text></View>)}</ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: spacing.sm, borderRadius: 14 } });
