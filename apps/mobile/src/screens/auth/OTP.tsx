import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	View,
	ScrollView,
	Pressable,
	TextInput as NativeTextInput,
	type TextInput as NativeTextInputType,
} from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { AuthHeader } from "../../components/AuthHeader";
import { styles } from "../../styles/commonStyles";
import { colors } from "../../constants/colors";
import type { Screen } from "../../types";
import {
	getPendingPhone,
	requestPhoneOtp,
	verifyPhoneOtp,
} from "../../api/client";
import { MobileApiError } from "../../api/client";

export function Otp({
	go,
	onAuthenticated,
}: {
	go: (screen: Screen) => void;
	onAuthenticated?: () => void;
}) {
	const [lang, setLang] = useState("EN");
	const [code, setCode] = useState("");
	const [verifying, setVerifying] = useState(false);
	const [resending, setResending] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [infoMessage, setInfoMessage] = useState("");
	const inputRefs = useRef<Array<NativeTextInputType | null>>([]);
	const verifyingRef = useRef(false);

	useEffect(() => {
		const focusTimer = setTimeout(() => inputRefs.current[0]?.focus(), 250);
		return () => clearTimeout(focusTimer);
	}, []);

	const verifyCode = useCallback(
		async (candidate: string) => {
			if (candidate.length !== 6 || verifyingRef.current) return;
			verifyingRef.current = true;
			setVerifying(true);
			setErrorMessage("");
			setInfoMessage("");
			try {
				const phone = getPendingPhone();
				if (!phone) throw new Error("Phone number is missing");
				await verifyPhoneOtp(phone, candidate);
				if (onAuthenticated) onAuthenticated();
				else go("home");
			} catch (error) {
				if (
					error instanceof MobileApiError &&
					(error.status === 400 || error.status === 401)
				) {
					setCode("");
					setErrorMessage(
						"That code doesn't look right or has expired. Please try again.",
					);
					setTimeout(() => inputRefs.current[0]?.focus(), 100);
				} else if (error instanceof MobileApiError && error.status === 0) {
					setErrorMessage(
						"We couldn't reach the server. Check your connection and try again.",
					);
				} else if (error instanceof MobileApiError && error.status >= 500) {
					setErrorMessage(
						"We're having trouble on our side. Please try again in a moment.",
					);
				} else {
					setErrorMessage(
						"We couldn't verify your code right now. Please try again.",
					);
				}
			} finally {
				verifyingRef.current = false;
				setVerifying(false);
			}
		},
		[go, onAuthenticated],
	);

	const updateCode = (index: number, value: string) => {
		const digits = value.replace(/\D/g, "");
		setErrorMessage("");
		setInfoMessage("");
		if (digits.length > 1) {
			const next = digits.slice(0, 6);
			setCode(next.padEnd(6, " "));
			if (next.length === 6) void verifyCode(next);
			else inputRefs.current[Math.max(0, next.length)]?.focus();
			return;
		}
		const nextDigits = code.padEnd(6, " ").split("");
		nextDigits[index] = digits || " ";
		const next = nextDigits.join("");
		setCode(next);
		if (digits && index < 5) inputRefs.current[index + 1]?.focus();
		const compactCode = next.replace(/\s/g, "");
		if (compactCode.length === 6) void verifyCode(compactCode);
	};

	const resendCode = async () => {
		setResending(true);
		setErrorMessage("");
		setInfoMessage("");
		try {
			const phone = getPendingPhone();
			if (!phone) throw new Error("Phone number is missing");
			await requestPhoneOtp(phone);
			setCode("");
			setInfoMessage("A new verification code was sent.");
			inputRefs.current[0]?.focus();
		} catch {
			setErrorMessage(
				"We couldn't resend the code. Check your connection and try again.",
			);
		} finally {
			setResending(false);
		}
	};

	return (
		<View style={styles.authPage}>
			<AuthHeader onBack={() => go("back")} lang={lang} setLang={setLang} />
			<ScrollView contentContainerStyle={styles.authScroll}>
				<Text style={styles.eyebrow}>STEP 2 OF 2</Text>
				<Text style={styles.authTitle}>Verify your number</Text>
				<Text style={styles.authBody}>
					Enter the 6-digit code we sent by SMS to{" "}
					{getPendingPhone() ?? "your phone"}.
				</Text>
				<Card>
					<Text style={styles.inputLabel}>Verification code</Text>
					<View style={styles.otpBoxes}>
						{Array.from({ length: 6 }, (_, index) => (
							<NativeTextInput
								key={index}
								ref={(input) => {
									inputRefs.current[index] = input;
								}}
								value={code[index] === " " ? "" : (code[index] ?? "")}
								onChangeText={(value) => updateCode(index, value)}
								onKeyPress={({ nativeEvent }) => {
									if (
										nativeEvent.key === "Backspace" &&
										(!code[index] || code[index] === " ") &&
										index > 0
									) {
										inputRefs.current[index - 1]?.focus();
									}
								}}
								style={styles.otpBox}
								keyboardType="number-pad"
								maxLength={6}
								textContentType="oneTimeCode"
								autoComplete="sms-otp"
								editable={!verifying}
							/>
						))}
					</View>
					{verifying ? (
						<Text style={styles.authBody}>Verifying code…</Text>
					) : null}
					{errorMessage ? (
						<Text style={[styles.authBody, { color: colors.danger }]}>
							{errorMessage}
						</Text>
					) : null}
					{infoMessage ? (
						<Text style={[styles.authBody, { color: colors.primary }]}>
							{infoMessage}
						</Text>
					) : null}
					{code.replace(/\s/g, "").length === 6 && !verifying ? (
						<Button
							label="Try verification again"
							secondary
							busy={verifying}
							onPress={() => void verifyCode(code.replace(/\s/g, ""))}
						/>
					) : null}
					<Pressable
						onPress={() => void resendCode()}
						disabled={resending || verifying}
					>
						<Text style={[styles.link, { textAlign: "center" }]}>
							{resending ? "Sending a new code…" : "Resend code"}
						</Text>
					</Pressable>
				</Card>
			</ScrollView>
		</View>
	);
}

export default Otp;
