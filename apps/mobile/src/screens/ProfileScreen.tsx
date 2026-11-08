import { SafeAreaView, StyleSheet, View } from "react-native";
import { SignOut, UserCircle } from "phosphor-react-native";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../constants/colors";
import { statusLabel } from "../utils/status";
export function ProfileScreen() { const { session, signOut } = useAuth(); return <SafeAreaView style={styles.page}><Text muted size={13}>Account</Text><Text bold size={28}>Profile</Text><View style={styles.card}><Avatar name={session?.user.name ?? "User"} size={64} /><View style={styles.identity}><Text bold size={19}>{session?.user.name}</Text><Text muted>{session?.user.email}</Text><View style={styles.roleRow}><UserCircle color={colors.primary} size={17} /><Text style={styles.role}>{statusLabel(session?.user.role ?? "")}</Text></View></View></View><Button label="Sign out" icon={<SignOut color={colors.primary} size={19} />} variant="secondary" onPress={() => void signOut()} /></SafeAreaView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }, card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }, identity: { flex: 1, gap: spacing.xs }, roleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, role: { color: colors.primary, textTransform: "capitalize" } });
