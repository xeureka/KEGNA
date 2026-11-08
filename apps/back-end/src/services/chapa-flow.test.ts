import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { toChapaPhoneNumber } from "@/utils/phone";
import { verifySignature } from "./chapa";
import { env } from "@/lib/env";
import { db } from "@/db";
import { sql } from "drizzle-orm";

test("toChapaPhoneNumber normalizes Ethiopian numbers to 10 digits in 09... or 07... form", () => {
	assert.equal(toChapaPhoneNumber("+251911234567"), "0911234567");
	assert.equal(toChapaPhoneNumber("251712345678"), "0712345678");
	assert.equal(toChapaPhoneNumber("0911234567"), "0911234567");
	assert.equal(toChapaPhoneNumber("911234567"), "0911234567");
	assert.equal(toChapaPhoneNumber("712345678"), "0712345678");
	assert.equal(toChapaPhoneNumber("+251 91 123 4567"), "0911234567");

	// Non-conforming or invalid numbers must return undefined (omitted from Chapa payload)
	assert.equal(toChapaPhoneNumber("12345"), undefined);
	assert.equal(toChapaPhoneNumber("+14155552671"), undefined);
	assert.equal(toChapaPhoneNumber(""), undefined);
	assert.equal(toChapaPhoneNumber(null), undefined);
	assert.equal(toChapaPhoneNumber(undefined), undefined);
});

test("verifySignature verifies HMAC-SHA256 signature against raw body string and accepts both x-chapa-signature and chapa-signature headers", () => {
	const secret =
		env.CHAPA_WEBHOOK_SECRET ?? env.CHAPA_SECRET_KEY ?? "test-secret";
	const rawBody =
		'{"event":"charge.success","tx_ref":"NEXA-123","amount":"300.00","currency":"ETB"}';
	const validSig = createHmac("sha256", secret).update(rawBody).digest("hex");

	// Should pass with hex signature
	assert.strictEqual(verifySignature(rawBody, validSig), true);
	// Should pass with sha256= prefix
	assert.strictEqual(verifySignature(rawBody, `sha256=${validSig}`), true);

	// Invalid signature or wrong body must be rejected
	assert.strictEqual(verifySignature(rawBody, "invalid-sig"), false);
	assert.strictEqual(verifySignature('{"event":"other"}', validSig), false);
	assert.strictEqual(verifySignature(rawBody, undefined), false);
});

test("security assertion: Row Level Security (RLS) policies remain enabled and forced on all payment tables", async () => {
	const tables = [
		"payments",
		"payment_events",
		"payment_allocations",
		"card_products",
		"user_cards",
	];

	for (const table of tables) {
		const result = await db.execute(sql`
			SELECT relrowsecurity, relforcerowsecurity
			FROM pg_class
			JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
			WHERE relname = ${table} AND nspname = 'public'
		`);
		assert.equal(result.rows.length, 1, `table ${table} exists`);
		const row = result.rows[0] as {
			relrowsecurity: boolean;
			relforcerowsecurity: boolean;
		};
		assert.equal(row.relrowsecurity, true, `table ${table} has RLS enabled`);
		assert.equal(
			row.relforcerowsecurity,
			true,
			`table ${table} has RLS forced`,
		);
	}
});
