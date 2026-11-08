import assert from "node:assert/strict";
import test from "node:test";
import { resolveChapaKeys } from "./env";

const base = {
	CHAPA_MODE: "test" as const,
	CHAPA_TEST_SECRET_KEY: "sk_test_123",
	CHAPA_TEST_PUBLIC_KEY: "pk_test_123",
	CHAPA_LIVE_SECRET_KEY: "sk_live_456",
	CHAPA_LIVE_PUBLIC_KEY: "pk_live_456",
};

test("test mode selects the test key pair", () => {
	assert.deepEqual(resolveChapaKeys(base), {
		secretKey: "sk_test_123",
		publicKey: "pk_test_123",
	});
});

test("live mode selects the live key pair", () => {
	assert.deepEqual(resolveChapaKeys({ ...base, CHAPA_MODE: "live" }), {
		secretKey: "sk_live_456",
		publicKey: "pk_live_456",
	});
});

test("mode-specific keys beat the generic fallback pair", () => {
	// Precedence is mode key first; the generic pair is only a fallback so a
	// deployment that sets just CHAPA_SECRET_KEY/CHAPA_PUBLIC_KEY keeps working.
	assert.deepEqual(
		resolveChapaKeys({
			...base,
			CHAPA_SECRET_KEY: "sk_generic",
			CHAPA_PUBLIC_KEY: "pk_generic",
		}),
		{ secretKey: "sk_test_123", publicKey: "pk_test_123" },
	);
	assert.deepEqual(
		resolveChapaKeys({
			...base,
			CHAPA_MODE: "live",
			CHAPA_SECRET_KEY: "sk_generic",
			CHAPA_PUBLIC_KEY: "pk_generic",
		}),
		{ secretKey: "sk_live_456", publicKey: "pk_live_456" },
	);
});

test("the generic pair is used when the mode keys are missing", () => {
	assert.deepEqual(
		resolveChapaKeys({
			CHAPA_MODE: "live",
			CHAPA_SECRET_KEY: "sk_generic",
			CHAPA_PUBLIC_KEY: "pk_generic",
		}),
		{ secretKey: "sk_generic", publicKey: "pk_generic" },
	);
	assert.deepEqual(
		resolveChapaKeys({
			CHAPA_MODE: "test",
			CHAPA_SECRET_KEY: "sk_generic",
			CHAPA_PUBLIC_KEY: "pk_generic",
		}),
		{ secretKey: "sk_generic", publicKey: "pk_generic" },
	);
});

test("missing keys resolve to undefined instead of empty strings", () => {
	assert.deepEqual(resolveChapaKeys({ CHAPA_MODE: "test" }), {
		secretKey: undefined,
		publicKey: undefined,
	});
});
