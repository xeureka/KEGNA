import assert from "node:assert/strict";
import test from "node:test";
import {
	allocateEtbPayment,
	calculateChapaAmounts,
	formatEtbCents,
	parseEtbCents,
} from "./payment-money";

test("ETB values are converted exactly to integer cents", () => {
	assert.equal(parseEtbCents("50"), 5000);
	assert.equal(parseEtbCents("1.05"), 105);
	assert.equal(formatEtbCents(105), "1.05");
	assert.throws(() => parseEtbCents("1.005"));
});

test("Chapa totals and split match base plus the configured service charge", () => {
	assert.deepEqual(calculateChapaAmounts("250.25", "50"), {
		baseAmount: "250.25",
		serviceCharge: "50.00",
		totalAmount: "300.25",
		clinicShare: "250.25",
		platformShare: "50.00",
	});
});

test("partial balance payment allocates oldest bill balances without rounding", () => {
	assert.deepEqual(
		allocateEtbPayment("10.10", [
			{ billId: "first", remaining: "5.05" },
			{ billId: "second", remaining: "8.00" },
		]),
		[
			{ billId: "first", amount: "5.05" },
			{ billId: "second", amount: "5.05" },
		],
	);
	assert.throws(() =>
		allocateEtbPayment("10.01", [{ billId: "first", remaining: "10.00" }]),
	);
});
