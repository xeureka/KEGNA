import assert from "node:assert/strict";
import test from "node:test";
import {
	CARD_TIERS,
	DEFAULT_CARD_TIER,
	findCardTier,
	tierRank,
} from "./card-tiers";

test("the three tiers are present with rising prices and ranks", () => {
	assert.equal(CARD_TIERS.length, 3);
	const names = CARD_TIERS.map((tier) => tier.name);
	assert.deepEqual(names, ["Silver", "Gold", "Platinum"]);
	const prices = CARD_TIERS.map((tier) => Number(tier.price));
	assert.deepEqual(prices, [1000, 2500, 5000]);
	const ranks = CARD_TIERS.map((tier) => tier.rank);
	assert.deepEqual(ranks, [10, 20, 30]);
	for (const tier of CARD_TIERS) {
		assert.ok(tier.benefits.length > 0, `${tier.name} must list benefits`);
		assert.equal(tier.validityDays, null, `${tier.name} is lifetime`);
	}
});

test("findCardTier matches case-insensitively and falls back safely", () => {
	assert.equal(findCardTier("Gold")?.name, "Gold");
	assert.equal(findCardTier("gold")?.name, "Gold");
	assert.equal(findCardTier("unknown-plan"), undefined);
	assert.equal(findCardTier(""), undefined);
	assert.equal(DEFAULT_CARD_TIER.name, "Silver");
});

test("tierRank orders unknown names below every configured tier", () => {
	assert.ok(tierRank("Platinum") > tierRank("Gold"));
	assert.ok(tierRank("Gold") > tierRank("Silver"));
	assert.ok(tierRank("Silver") > tierRank("something-new"));
});
