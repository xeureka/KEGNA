import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { Detail } from "../../components/Detail";
import { downloadReceipt } from "../../utils/downloadReceipt";
import { colors } from "../../constants/colors";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { listMobileBills } from "../../api/client";
import { useTenantConfig } from "../../context/TenantConfigContext";

export function PaymentPage({
	variant,
	go,
}: {
	variant: "checkout" | "processing" | "success" | "failed" | "receipt";
	go: (screen: Screen) => void;
}) {
	const config = useTenantConfig();
	const titles = {
		checkout: "Secure payment",
		processing: "Payment processing",
		success: "Payment successful",
		failed: "Payment failed",
		receipt: "Digital receipt",
	};
	const [bills, setBills] = useState<Array<Record<string, unknown>>>([]);
	useEffect(() => {
		if (variant === "receipt" || variant === "checkout")
			void listMobileBills()
				.then(setBills)
				.catch(() => undefined);
	}, [variant]);
	const latestBill = bills[0];

	return (
		<>
			<Header
				title={titles[variant]}
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				{variant === "checkout" && (
					<>
						<Text style={styles.heroTitle}>Use the clinic payment flow</Text>
						<Text style={styles.muted}>
							Card details are entered only on Chapa's secure checkout. Choose a
							visit, card plan, or balance amount in the app to begin.
						</Text>
						<Button label="Go to payments" onPress={() => go("payments")} />
					</>
				)}
				{variant === "processing" && (
					<View style={styles.statusPage}>
						<View style={styles.processingIcon}>
							<ActivityIndicator size="large" color={colors.primary} />
						</View>
						<Text style={styles.authTitle}>Verifying payment</Text>
						<Text style={styles.authBody}>
							Please keep this screen open while we confirm your transaction.
						</Text>
						<Card>
							<View style={styles.rowBetween}>
								<Text style={styles.muted}>Amount</Text>
								<Text style={styles.bodyStrong}>
									{String(
										latestBill?.balanceDue ?? latestBill?.totalAmount ?? "0",
									)}{" "}
									ETB
								</Text>
							</View>
							<View style={styles.rowBetween}>
								<Text style={styles.muted}>Reference</Text>
								<Text style={styles.bodyStrong}>
									{String(
										latestBill?.billNumber ?? latestBill?.id ?? "Pending",
									)}
								</Text>
							</View>
						</Card>
						<Button
							label="Refresh payment status"
							onPress={() => go("payments")}
						/>
					</View>
				)}
				{variant === "success" && (
					<View style={styles.statusPage}>
						<View style={styles.successIcon}>
							<Text style={{ color: colors.surface, fontSize: 40 }}>✓</Text>
						</View>
						<Text style={styles.authTitle}>Payment complete</Text>
						<Text style={styles.authBody}>
							Your digital dental card is active and your receipt is ready.
						</Text>
						<Card>
							<Text style={styles.eyebrow}>TRANSACTION CONFIRMED</Text>
							<Text style={styles.price}>
								{String(latestBill?.totalAmount ?? "0")} ETB
							</Text>
							<Text style={styles.muted}>
								{String(latestBill?.paidAt ?? latestBill?.issuedAt ?? "")} ·{" "}
								{String(latestBill?.billNumber ?? latestBill?.id ?? "")}
							</Text>
						</Card>
						<Button
							label="View digital receipt"
							onPress={() => go("receipt")}
						/>
						<Button
							label="Back to payments"
							secondary
							onPress={() => go("payments")}
						/>
					</View>
				)}
				{variant === "failed" && (
					<View style={styles.statusPage}>
						<View style={styles.failedIcon}>
							<Text style={{ color: colors.surface, fontSize: 38 }}>!</Text>
						</View>
						<Text style={styles.authTitle}>Payment could not be completed</Text>
						<Text style={styles.authBody}>
							We couldn't verify this payment. Your card has not been charged.
						</Text>
						<Button label="Try again" onPress={() => go("paymentCheckout")} />
						<Button
							label="Use another method"
							secondary
							onPress={() => go("payments")}
						/>
					</View>
				)}
				{variant === "receipt" && (
					<>
						<Card>
							<View style={styles.receiptHeader}>
								<Text style={styles.eyebrow}>TENADENT · OFFICIAL RECEIPT</Text>
								<Text style={styles.receiptCheck}>✓</Text>
							</View>
							<Text style={styles.heroTitle}>Payment receipt</Text>
							<Text style={styles.muted}>
								Receipt #
								{String(latestBill?.billNumber ?? latestBill?.id ?? "")}
							</Text>
							<View style={styles.rule} />
							<Detail
								label="Patient"
								value={String(latestBill?.patientName ?? "Patient")}
							/>
							<Detail
								label="Service"
								value={String(latestBill?.description ?? "Dental service")}
							/>
							<Detail label="Clinic" value={config.identity.displayName} />
							<Detail
								label="Date"
								value={String(latestBill?.paidAt ?? latestBill?.issuedAt ?? "")}
							/>
							<View style={styles.rowBetween}>
								<Text style={styles.bodyStrong}>Total paid</Text>
								<Text style={styles.price}>
									{String(latestBill?.totalAmount ?? "0")} ETB
								</Text>
							</View>
						</Card>
						<Button
							label="Download receipt"
							onPress={() =>
								void downloadReceipt({
									receipt: String(
										latestBill?.billNumber ?? latestBill?.id ?? "Receipt",
									),
									patient: String(latestBill?.patientName ?? "Patient"),
									service: String(latestBill?.description ?? "Dental service"),
									date: String(
										latestBill?.paidAt ?? latestBill?.issuedAt ?? "",
									),
									clinicName: config.identity.displayName,
									total: String(
										latestBill?.balanceDue ?? latestBill?.totalAmount ?? "0",
									),
								})
							}
						/>
						<Button
							label="Back to payments"
							secondary
							onPress={() => go("back")}
						/>
					</>
				)}
			</ScrollView>
		</>
	);
}

export default PaymentPage;
