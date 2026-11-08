import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "./Avatar";
import { Text } from "./Text";
import { UnreadBadge } from "./UnreadBadge";
import { colors, spacing } from "../constants/colors";
import type { ThreadRow } from "../types";
import { eventPreview } from "../utils/status";
import { formatChatTimestamp } from "../utils/format";
export function ChatListItem({ row, sales, onPress, pinned }: { row: ThreadRow; sales: boolean; onPress: () => void; pinned?: boolean }) { const title = sales ? row.issue.issueNo : `${row.salesperson.name} · ${row.issue.issueNo}`; return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pinned && styles.pinned, pressed && styles.pressed]}><Avatar name={row.salesperson.name} /><View style={styles.body}><View style={styles.line}><Text bold numberOfLines={1} style={styles.title}>{title}</Text><Text muted size={12}>{formatChatTimestamp(row.lastEventAt ?? row.issue.issuedAt)}</Text></View><View style={styles.line}><Text muted numberOfLines={1} style={styles.preview}>{pinned ? "Open load · " : ""}{eventPreview[row.lastEvent?.type ?? ""] ?? "Activity"}</Text><UnreadBadge count={Number(row.unreadCount) || 0} /></View></View></Pressable>; }
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }, pinned: { backgroundColor: colors.mint }, pressed: { opacity: 0.72 }, body: { flex: 1, gap: spacing.xs }, line: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, title: { flex: 1 }, preview: { flex: 1 } });
