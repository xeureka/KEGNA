import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { TextInput } from "../components/TextInput";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../constants/colors";
import { errorMessage } from "../utils/errors";
export function LoginScreen() { const { signIn } = useAuth(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const submit = async () => { setBusy(true); setError(null); try { await signIn(email, password); } catch (e) { setError(errorMessage(e, "Sign-in failed")); } finally { setBusy(false); } }; return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.page}><View style={styles.form}><Text bold size={30} style={styles.brand}>ZOLA</Text><Text muted size={16}>Beer warehouse inventory</Text><Text bold size={18} style={styles.heading}>Sign in</Text><TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} /><TextInput secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} style={styles.password} />{error ? <Text style={styles.error}>{error}</Text> : null}<Button label="Sign in" onPress={submit} busy={busy} disabled={!email || !password} /></View></KeyboardAvoidingView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.xl }, form: { gap: spacing.md }, brand: { color: colors.primary, letterSpacing: 2 }, heading: { marginTop: spacing.xl }, password: { marginTop: spacing.sm }, error: { color: colors.danger, lineHeight: 20 } });
