/**
 * Membership card tiers — the single source of truth for what a clinic sells.
 *
 * The back-end owns these definitions and serves them through `GET /cards`;
 * the mobile app only renders what the API returns and posts back a tier id.
 * Prices are base prices in ETB: the Chapa service charge is added once, at
 * checkout, by the server (see `payment-money.calculateChapaAmounts`).
 *
 * EDIT HERE to add, reprice or retire a tier. Nothing else needs to change.
 */

export type CardTierDefinition = {
	/** Stable natural key. Stored in `card_products.name` for lookups. */
	id: string;
	/** Display name shown to patients and in dashboards. */
	name: string;
	/** Higher wins when a patient buys several tiers. */
	rank: number;
	/** Base price in ETB, integer cents rejected — two decimals max. */
	price: string;
	/** `null` = lifetime membership. Otherwise days from activation. */
	validityDays: number | null;
	/** Short pitch shown at the top of the tier card. */
	summary: string;
	/** Full benefit list rendered under the tier card. */
	benefits: string[];
};

export const CARD_TIERS: CardTierDefinition[] = [
	{
		id: "silver",
		name: "Silver",
		rank: 10,
		price: "1000.00",
		validityDays: null,
		summary: "Essential membership for routine dental care.",
		benefits: [
			"10% off every in-clinic treatment",
			"Priority scheduling for routine checkups",
			"Free dental cleaning once a year",
			"Digital patient card in the app",
		],
	},
	{
		id: "gold",
		name: "Gold",
		rank: 20,
		price: "2500.00",
		validityDays: null,
		summary: "Better value for families and frequent visitors.",
		benefits: [
			"20% off every in-clinic treatment",
			"Same-day emergency appointments",
			"Two free cleanings a year",
			"Free annual X-ray screening",
			"Digital patient card in the app",
		],
	},
	{
		id: "platinum",
		name: "Platinum",
		rank: 30,
		price: "5000.00",
		validityDays: null,
		summary: "Complete cover with the clinic's strongest benefits.",
		benefits: [
			"30% off every in-clinic treatment",
			"Guaranteed same-day emergency care",
			"Unlimited cleanings and checkups",
			"Free annual X-ray and whitening session",
			"Dedicated care coordinator",
			"Digital patient card in the app",
		],
	},
];

export const DEFAULT_CARD_TIER = CARD_TIERS[0]!;

export function findCardTier(name: string): CardTierDefinition | undefined {
	const normalized = name.trim().toLowerCase();
	return CARD_TIERS.find(
		(tier) => tier.id === normalized || tier.name.toLowerCase() === normalized,
	);
}

/** Highest rank among the tiers a set of names belongs to; 0 when unknown. */
export function tierRank(name: string | null | undefined): number {
	if (!name) return 0;
	return findCardTier(name)?.rank ?? 0;
}
