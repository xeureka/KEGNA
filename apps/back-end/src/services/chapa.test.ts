import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { handleWebhook } from "./chapa";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";

function sign(payload: unknown) {
	return createHmac("sha256", env.CHAPA_WEBHOOK_SECRET ?? "missing")
		.update(JSON.stringify(payload))
		.digest("hex");
}

test("webhook rejects a missing or malformed signature before any network call", async () => {
	const payload = { tx_ref: "NEXA-1" };
	await assert.rejects(
		() => handleWebhook(payload, undefined),
		(error: unknown) => error instanceof AppError && error.statusCode === 401,
	);
	await assert.rejects(
		() => handleWebhook(payload, "sha256=zz"),
		(error: unknown) => error instanceof AppError && error.statusCode === 401,
	);
});

test("webhook rejects a signature computed with the wrong secret", async () => {
	const payload = { tx_ref: "NEXA-1" };
	const forged = createHmac("sha256", "wrong-secret")
		.update(JSON.stringify(payload))
		.digest("hex");
	await assert.rejects(
		() => handleWebhook(payload, forged),
		(error: unknown) => error instanceof AppError && error.statusCode === 401,
	);
});

test("webhook rejects a payload without a usable transaction reference", async (t) => {
	if (!env.CHAPA_WEBHOOK_SECRET) {
		t.skip("CHAPA_WEBHOOK_SECRET is not configured in this environment");
		return;
	}
	// Signed correctly, but the reference check happens before any provider
	// verification, so this stays offline.
	await assert.rejects(
		() =>
			handleWebhook(
				{ event: "charge.success" },
				sign({ event: "charge.success" }),
			),
		(error: unknown) => error instanceof AppError && error.statusCode === 400,
	);
	await assert.rejects(
		() =>
			handleWebhook(
				{ tx_ref: "x".repeat(101) },
				sign({ tx_ref: "x".repeat(101) }),
			),
		(error: unknown) => error instanceof AppError && error.statusCode === 400,
	);
});
