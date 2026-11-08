import { SafeAreaView, StyleSheet, View } from "react-native";
import { SignOut, UserCircle } from "phosphor-react-native";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../constants/colors";
import { statusLabel } from "../utils/status";
import { getApiBaseUrl } from "../config/runtime";
import { getSession, MobileApiError } from "../api/client";
import { useEffect, useState } from "react";
export function ProfileScreen() { const { session, signOut } = useAuth(); const [connection, setConnection] = useState("Checking…"); useEffect(() => { if (!__DEV__) return; void getSession().then(() => setConnection("Authenticated call succeeded (200)")).catch((error: unknown) => setConnection(`Request failed${error instanceof MobileApiError ? ` (${error.status})` : ""}: ${error instanceof Error ? error.message : "Unknown error"}`)); }, []); return <SafeAreaView style={styles.page}><Text muted size={13}>Account</Text><Text bold size={28}>Profile</Text><View style={styles.card}><Avatar name={session?.user.name ?? "User"} size={64} /><View style={styles.identity}><Text bold size={19}>{session?.user.name}</Text><Text muted>{session?.user.email}</Text><View style={styles.roleRow}><UserCircle color={colors.primary} size={17} /><Text style={styles.role}>{statusLabel(session?.user.role ?? "")}</Text></View></View></View>{__DEV__ ? <View style={styles.connection}><Text bold>Connection</Text><Text muted>API: {getApiBaseUrl()}</Text><Text muted>Session: {session ? `signed in (${session.user.role})` : "signed out"}</Text><Text muted>{connection}</Text></View> : null}<Button label="Sign out" icon={<SignOut color={colors.primary} size={19} />} variant="secondary" onPress={() => void signOut()} /></SafeAreaView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }, card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }, identity: { flex: 1, gap: spacing.xs }, roleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, role: { color: colors.primary, textTransform: "capitalize" }, connection: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.xs } });
