import React, { useCallback, useState } from "react";
import { AppState, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { SectionTitle } from "../../components/SectionTitle";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import {
	createBalancePayment,
	getMyPaymentBalance,
	listMobileBills,
	listMyPayments,
	paymentErrorMessage,
} from "../../api/client";
import { openPaymentCheckout } from "../../api/payment-checkout";
import { Alert } from "../../utils/alert";

function formatDate(value: unknown) {
	const date = new Date(String(value ?? ""));
	return Number.isNaN(date.getTime())
		? "Date unavailable"
		: date.toLocaleString();
}

function methodLabel(value: unknown) {
	if (value === "MOBILE_TRANSFER") return "Mobile transfer";
	if (value === "CASH") return "Cash";
	return "Chapa (mobile app)";
}

export function Payment({
	title,
	amount,
	date,
	status,
	onPress,
}: {
	title: string;
	amount: string;
	date: string;
	status: string;
	onPress: () => void;
}) {
	return (
		<Pressable onPress={onPress}>
			<Card>
				<View style={styles.rowBetween}>
					<View>
						<Text style={styles.cardTitle}>{title}</Text>
						<Text style={styles.muted}>{date}</Text>
					</View>
					<View style={{ alignItems: "flex-end" }}>
						<Text style={styles.bodyStrong}>{amount}</Text>
						<Text
							style={[
								styles.statusText,
								status === "Paid" && { color: colors.primary },
							]}
						>
							{status}
						</Text>
					</View>
				</View>
			</Card>
		</Pressable>
	);
}

export function Payments({ go }: { go: (screen: Screen) => void }) {
	const [balance, setBalance] = useState<Record<string, unknown> | null>(null);
	const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
	const [bills, setBills] = useState<Array<Record<string, unknown>>>([]);
	const [amount, setAmount] = useState("");
	const [loading, setLoading] = useState(true);
	const [paying, setPaying] = useState(false);

	const available = Number(balance?.available ?? 0);

	const refresh = useCallback(async () => {
		try {
			const [nextBalance, payments, billRows] = await Promise.all([
				getMyPaymentBalance(),
				listMyPayments(),
				listMobileBills(),
			]);
			setBalance(nextBalance);
			setHistory(payments.items);
			setBills(billRows.filter((bill) => Number(bill.balanceDue) > 0));
			setAmount(
				(current) => current || String(nextBalance.available ?? "0.00"),
			);
		} catch (error) {
			Alert.alert(
				"Unable to refresh balance",
				paymentErrorMessage(error, "Please try again."),
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			void refresh();
			const subscription = AppState.addEventListener("change", (state) => {
				if (state === "active") void refresh();
			});
			return () => subscription.remove();
		}, [refresh]),
	);

	const payBalance = async () => {
		if (paying) return;
		const parsed = Number(amount.trim() || "0");
		if (!Number.isFinite(parsed) || parsed <= 0) {
			Alert.alert(
				"Enter an amount",
				"Enter how much you would like to pay toward your balance.",
			);
			return;
		}
		if (available > 0 && parsed > available) {
			Alert.alert(
				"Amount is too high",
				`Your outstanding balance is ${available.toFixed(2)} ETB. You cannot pay more than that.`,
			);
			return;
		}
		setPaying(true);
		try {
			const checkout = await createBalancePayment(amount.trim() || undefined);
			const status = await openPaymentCheckout(
				checkout.checkout_url,
				checkout.tx_ref,
			);
			await refresh();
			if (status === "SUCCESS") {
				Alert.alert("Payment confirmed", "Your balance has been updated.");
			} else if (status === "PENDING") {
				Alert.alert(
					"Payment processing",
					"We are waiting for Chapa to confirm your payment. Your balance will refresh when you return.",
				);
			} else {
				Alert.alert(
					"Payment not completed",
					"No balance payment was recorded.",
				);
			}
		} catch (error) {
			Alert.alert(
				"Unable to start payment",
				paymentErrorMessage(error, "Please try again."),
			);
		} finally {
			setPaying(false);
		}
	};

	return (
		<>
			<Header title="Payments" onNotifications={() => go("notifications")} />
			<ScrollView contentContainerStyle={styles.content}>
				<Card>
					<Text style={styles.eyebrow}>OUTSTANDING BALANCE</Text>
					<Text style={styles.balance}>
						{String(balance?.remaining ?? (loading ? "Loading…" : "0.00"))} ETB
					</Text>
					<View style={styles.rowBetween}>
						<Text style={styles.muted}>Total charged</Text>
						<Text style={styles.bodyStrong}>
							{String(balance?.totalCharged ?? "0.00")} ETB
						</Text>
					</View>
					<View style={styles.rowBetween}>
						<Text style={styles.muted}>Paid toward bills</Text>
						<Text style={styles.bodyStrong}>
							{String(balance?.totalPaid ?? "0.00")} ETB
						</Text>
					</View>
				</Card>

				<Card>
					<Text style={styles.cardTitle}>Pay outstanding balance</Text>
					<Text style={styles.muted}>
						Available to pay: {String(balance?.available ?? "0.00")} ETB
					</Text>
					<Text style={styles.inputLabel}>Amount (ETB)</Text>
					<TextInput
						value={amount}
						onChangeText={setAmount}
						placeholder="Enter a partial amount or pay all"
						keyboardType="decimal-pad"
						style={styles.input}
					/>
					<Button
						label="Continue to Chapa"
						onPress={() => void payBalance()}
						busy={paying || available <= 0}
					/>
				</Card>

				{bills.length > 0 && (
					<>
						<SectionTitle title="Outstanding items" />
						{bills.map((bill) => (
							<Card key={String(bill.id)}>
								<View style={styles.rowBetween}>
									<View style={{ flex: 1 }}>
										<Text style={styles.cardTitle}>
											{String(bill.billNumber ?? "Bill")}
										</Text>
										<Text style={styles.muted}>
											Issued · {formatDate(bill.issuedAt)}
										</Text>
									</View>
									<View style={{ alignItems: "flex-end" }}>
										<Text style={styles.bodyStrong}>
											{String(bill.balanceDue ?? "0.00")} ETB due
										</Text>
									</View>
								</View>
							</Card>
						))}
					</>
				)}

				<SectionTitle title="Payment history" />
				{history.length === 0 && !loading && (
					<Text style={styles.muted}>No payments have been recorded yet.</Text>
				)}
				{history.map((payment) => (
					<Card key={String(payment.id)}>
						<View style={styles.rowBetween}>
							<View style={{ flex: 1 }}>
								<Text style={styles.cardTitle}>
									{String(payment.purpose ?? "Payment").toUpperCase()} ·{" "}
									{methodLabel(payment.method)}
								</Text>
								<Text style={styles.muted}>
									{formatDate(payment.paidAt ?? payment.createdAt)}
								</Text>
								{Boolean(payment.txRef) && (
									<Text style={styles.muted}>
										Ref · {String(payment.txRef)}
									</Text>
								)}
							</View>
							<View style={{ alignItems: "flex-end" }}>
								<Text style={styles.bodyStrong}>
									{String(payment.totalAmount ?? "0.00")} ETB
								</Text>
								<Text style={styles.statusText}>
									{String(payment.status ?? "PENDING")}
								</Text>
							</View>
						</View>
					</Card>
				))}
			</ScrollView>
		</>
	);
}

export default Payments;
