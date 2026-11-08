import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { ArrowClockwise, Package } from "phosphor-react-native";
import { getMyStock } from "../api/client";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Text } from "../components/Text";
import { colors, radius, spacing } from "../constants/colors";
import { formatMoney } from "../utils/format";
import type { PersonalStock } from "../types";

export function SalesHomeScreen({ onReport }: { onReport: () => void }) {
	const [stock, setStock] = useState<PersonalStock | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string | null>(null);
	const load = useCallback(async (refresh = false) => { if (refresh) setRefreshing(true); else setLoading(true); setError(null); try { setStock(await getMyStock()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your stock"); } finally { setLoading(false); setRefreshing(false); } }, []);
	useEffect(() => { void load(); }, [load]);
	if (loading) return <LoadingState label="Loading your stock" />;
	if (error && !stock) return <ErrorState message={error} onRetry={() => void load()} />;
	return <SafeAreaView style={styles.page}><ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}><View style={styles.heading}><View><Text muted size={13}>Sales workspace</Text><Text bold size={22}>Your stock</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh stock" onPress={() => void load(true)}><ArrowClockwise color={colors.primary} size={22} /></Pressable></View><View style={styles.hero}><Text muted>Left with you now</Text><Text bold size={30}>{stock?.totals.racks_left ?? 0} racks</Text><Text muted>Estimated value {formatMoney(stock?.totals.est_value)} · Sold so far {formatMoney(stock?.totals.sold_value)}</Text><Text muted size={13}>Assigned by warehouse · only yours</Text></View><Button label="Report sales and pay" onPress={onReport} disabled={!stock?.items.length} />{stock?.items.length ? stock.items.map((item) => <View key={item.beverage.id} style={styles.card}><View style={styles.cardTitle}><Package color={colors.primary} size={20} /><Text bold>{item.beverage.name}</Text></View><Text>{item.left} left of {item.assigned}</Text><View style={styles.track}><View style={[styles.progress, { width: `${item.assigned ? Math.min(100, (item.sold / item.assigned) * 100) : 0}%` }]} /></View><Text muted size={13}>Sold {item.sold} · {formatMoney(item.price)} per rack</Text></View>) : <EmptyState title="No racks assigned" message="Your warehouse assignments will appear here." />}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, hero: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: spacing.sm }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: spacing.sm }, cardTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, track: { height: 8, backgroundColor: colors.linen, borderRadius: 8, overflow: "hidden" }, progress: { height: 8, backgroundColor: colors.primary, borderRadius: 8 } });
