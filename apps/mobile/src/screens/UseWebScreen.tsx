import { SafeAreaView, StyleSheet, View } from "react-native";
import { SignOut, Globe } from "phosphor-react-native";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../constants/colors";
export function UseWebScreen() { const { session, signOut } = useAuth(); return <SafeAreaView style={styles.page}><View style={styles.icon}><Globe color={colors.primary} size={30} /></View><Text bold size={28} style={styles.brand}>ZOLA</Text><Text bold size={20}>Use the web app</Text><Text muted style={styles.copy}>Admin and storekeeper workspaces are available on the ZOLA web dashboard.</Text><Text muted>{session?.user.email}</Text><Button label="Sign out" icon={<SignOut color={colors.primary} size={19} />} variant="secondary" onPress={() => void signOut()} /></SafeAreaView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background, justifyContent: "center", gap: spacing.md, padding: spacing.xl }, icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }, brand: { color: colors.primary, letterSpacing: 2 }, copy: { lineHeight: 22, marginBottom: spacing.sm } });
