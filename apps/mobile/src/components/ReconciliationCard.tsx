import { StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { Text } from "./Text";
import { colors, spacing } from "../constants/colors";
import { formatMoney } from "../utils/format";
import type { IssueDetail } from "../types";
export function ReconciliationCard({ issue, onApprove, onFlag, busy }: { issue: IssueDetail; onApprove: () => void; onFlag: () => void; busy?: boolean }) { const r = issue.reconciliation; const can = r.returns_confirmed && r.racks_variance === 0 && r.cash_variance === "0.00"; const reason = !r.returns_confirmed ? "Waiting for the storekeeper to confirm returns" : r.racks_variance !== 0 ? "Racks do not match" : r.cash_variance !== "0.00" ? "Cash does not match" : "Ready to approve"; return <View style={styles.card}><Text bold>Reconciliation</Text><Text>Expected racks: {r.expected_sold} · Declared: {r.declared_sold}</Text><Text>Expected cash: {formatMoney(r.expected_cash)} · Deposited: {formatMoney(r.deposited_cash)}</Text><Text muted>{reason}</Text><View style={styles.actions}><Button label="Approve" onPress={onApprove} disabled={!can} busy={busy} style={styles.action}/><Button label="Flag" variant="danger" onPress={onFlag} disabled={busy} style={styles.action}/></View></View>; }
const styles = StyleSheet.create({ card: { margin: spacing.md, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 } });
