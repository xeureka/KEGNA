import React, { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { styles } from "../../styles/commonStyles";
import { colors } from "../../constants/colors";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";
import {
	createCardPayment,
	getMobileProfile,
	listCardProducts,
	listPurchasedCards,
	paymentErrorMessage,
} from "../../api/client";
import { openPaymentCheckout } from "../../api/payment-checkout";
import { Alert } from "../../utils/alert";

type CardPlan = {
	id: string;
	name: string;
	summary: string;
	benefits: string[];
	price: string;
	feeText: string;
	rank: number;
};

function parsePlan(raw: Record<string, unknown>): CardPlan {
	const price = String(raw.price ?? "0");
	const fee = Number(price) - Number(raw.baseAmount ?? price);
	return {
		id: String(raw.id ?? ""),
		name: String(raw.name ?? "Dental card"),
		summary: String(raw.summary ?? ""),
		benefits: Array.isArray(raw.benefits)
			? raw.benefits.map(String)
			: ([] as string[]),
		price,
		feeText: Number.isFinite(fee) && fee > 0 ? fee.toFixed(2) : "50.00",
		rank: Number(raw.rank ?? 0),
	};
}

export function CardInactive({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	const [profile, setProfile] = useState<{
		name: string;
		patientNumber: string;
		tier: string;
	} | null>(null);
	const [products, setProducts] = useState<CardPlan[]>([]);
	const [purchasedCards, setPurchasedCards] = useState<
		Array<Record<string, unknown>>
	>([]);
	const [loading, setLoading] = useState(true);
	const [loadingProduct, setLoadingProduct] = useState<string | null>(null);
	const [selectedPlan, setSelectedPlan] = useState<CardPlan | null>(null);

	const refresh = async () => {
		const [productRows, cardRows, profileResult] = await Promise.all([
			listCardProducts(),
			listPurchasedCards(),
			getMobileProfile(),
		]);
		setProducts(productRows.map(parsePlan));
		setPurchasedCards(cardRows);
		setLoading(false);
		const patient = profileResult.patient as {
			firstName?: string;
			lastName?: string;
			patientNumber?: string;
			membershipTier?: string | null;
		} | null;
		setProfile({
			name: patient
				? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim()
				: String(profileResult.user.name ?? "Patient"),
			patientNumber: patient?.patientNumber ?? "Pending patient ID",
			tier: patient?.membershipTier ?? "",
		});
	};
	useEffect(() => {
		void refresh().catch(() => {
			setLoading(false);
			Alert.alert(
				"Unable to load cards",
				"Please check your connection and retry.",
			);
		});
	}, []);

	const purchase = async (plan: CardPlan) => {
		if (!plan.id || loadingProduct) return;
		setLoadingProduct(plan.id);
		try {
			const checkout = await createCardPayment(plan.id);
			const status = await openPaymentCheckout(
				checkout.checkout_url,
				checkout.tx_ref,
			);
			if (status === "SUCCESS") {
				setSelectedPlan(null);
				await refresh();
				Alert.alert("Card activated", "Your card purchase is confirmed.");
			} else if (status === "PENDING") {
				Alert.alert(
					"Payment processing",
					"We will confirm your card as soon as Chapa verifies it.",
				);
			} else {
				Alert.alert(
					"Payment not completed",
					"No card was activated. You can try again.",
				);
			}
		} catch (error) {
			Alert.alert(
				"Unable to start checkout",
				paymentErrorMessage(error, "Please try again."),
			);
		} finally {
			setLoadingProduct(null);
		}
	};

	const confirmPlan = (plan: CardPlan) => {
		Alert.alert(
			`Activate ${plan.name}`,
			`${plan.summary || "Membership plan"}\n\nTotal: ${plan.price} ETB (includes ${plan.feeText} ETB platform service fee).`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Pay with Chapa",
					onPress: () => void purchase(plan),
				},
			],
		);
	};

	const hasActive = purchasedCards.some((card) => card.status === "active");
	const activeCard = purchasedCards.find((card) => card.status === "active");

	return (
		<>
			<Header
				title="Digital patient card"
				onBack={() => go("back")}
				onNotifications={() => go("notifications")}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				<Card>
					<View style={styles.rowBetween}>
						<View>
							<Text style={styles.eyebrow}>{config.identity.displayName}</Text>
							<Text style={styles.cardTitle}>
								{config.identity.displayName}
							</Text>
						</View>
						<Text style={styles.statusText}>
							{hasActive ? "MEMBERSHIP ACTIVE" : "NO ACTIVE MEMBERSHIP"}
						</Text>
					</View>
					<Text style={[styles.heroTitle, { marginTop: 18 }]}>
						{profile?.name ?? "Loading profile…"}
					</Text>
					<Text style={styles.muted}>
						Patient ID · {profile?.patientNumber ?? "Loading…"}
					</Text>
					<View style={styles.digitalCard}>
						<Text style={styles.digitalBrand}>
							{hasActive ? "ACTIVE MEMBERSHIP" : "MEMBERSHIP CARD"}
						</Text>
						<Text style={styles.digitalQr}>▦</Text>
						<Text style={{ color: colors.onPrimary }}>
							{activeCard
								? String(
										(activeCard.card as Record<string, unknown> | undefined)
											?.name ?? "Clinic membership",
									)
								: profile?.tier
									? `${profile.tier} member`
									: "Choose a card plan below"}
						</Text>
					</View>
					{profile?.tier ? (
						<Text style={styles.chip}>{profile.tier.toUpperCase()}</Text>
					) : null}
				</Card>
				{loading && <Text style={styles.muted}>Loading card plans…</Text>}
				{!loading && products.length === 0 && (
					<Card>
						<Text style={styles.cardTitle}>No cards available</Text>
						<Text style={styles.muted}>
							The clinic has not published a card plan yet.
						</Text>
					</Card>
				)}
				{products.map((plan) => (
					<Card key={plan.id}>
						<View style={styles.rowBetween}>
							<Text style={styles.cardTitle}>{plan.name}</Text>
							{plan.rank > 0 && (
								<Text style={styles.chip}>{plan.name.toUpperCase()}</Text>
							)}
						</View>
						{Boolean(plan.summary) && (
							<Text style={styles.muted}>{plan.summary}</Text>
						)}
						{plan.benefits.length > 0 && (
							<View style={{ marginTop: 8, gap: 4 }}>
								{plan.benefits.map((benefit) => (
									<Text key={benefit} style={styles.muted}>
										• {benefit}
									</Text>
								))}
							</View>
						)}
						<View style={styles.rowBetween}>
							<Text style={styles.muted}>Platform service fee</Text>
							<Text style={styles.bodyStrong}>{plan.feeText} ETB</Text>
						</View>
						<View style={styles.rowBetween}>
							<Text style={styles.bodyStrong}>Total price</Text>
							<Text style={styles.price}>{plan.price} ETB</Text>
						</View>
						<Button
							label={
								selectedPlan?.id === plan.id ? "Confirm plan" : "Select plan"
							}
							onPress={() => {
								if (selectedPlan?.id === plan.id) {
									confirmPlan(plan);
								} else {
									setSelectedPlan(plan);
								}
							}}
							busy={loadingProduct === plan.id}
						/>
					</Card>
				))}
				{purchasedCards.map((card) => (
					<Card key={String(card.id)}>
						<View style={styles.rowBetween}>
							<Text style={styles.cardTitle}>
								{String(
									(card.card as Record<string, unknown> | undefined)?.name ??
										"Purchased card",
								)}
							</Text>
							<Text
								style={[
									styles.statusText,
									card.status === "active" && { color: colors.primary },
								]}
							>
								{String(card.status ?? "pending").toUpperCase()}
							</Text>
						</View>
					</Card>
				))}
				<Button label="View active card" secondary onPress={() => go("card")} />
			</ScrollView>
		</>
	);
}

export default CardInactive;
