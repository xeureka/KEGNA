import { StyleSheet, View } from "react-native";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../constants/colors";
import { statusLabel } from "../utils/status";
export function ProfileScreen() { const { session, signOut } = useAuth(); return <View style={styles.page}><Text bold size={25}>Profile</Text><View style={styles.card}><Text bold size={18}>{session?.user.name}</Text><Text muted>{session?.user.email}</Text><Text style={styles.role}>{statusLabel(session?.user.role ?? "")}</Text></View><Button label="Sign out" variant="secondary" onPress={() => void signOut()} /></View>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.lg }, card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }, role: { color: colors.primary, textTransform: "capitalize" } });
