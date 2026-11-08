import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { logger } from "@/lib/logger";
import { toChapaPhoneNumber } from "@/utils/phone";

type ChapaObject = Record<string, unknown>;

export interface InitializeChapaPaymentInput {
	txRef: string;
	amount: string;
	currency: "ETB";
	firstName: string;
	lastName: string;
	email?: string;
	phoneNumber?: string;
	returnUrl?: string;
}

export interface ChapaVerifiedPayment {
	status: string;
	tx_ref: string;
	reference?: string;
	amount: string;
	currency: string;
	mode?: string;
	[key: string]: unknown;
}

const asObject = (value: unknown): ChapaObject | null =>
	value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as ChapaObject)
		: null;

const providerMessage = (body: ChapaObject): string => {
	if (typeof body.message === "string") return body.message;
	if (body.message && typeof body.message === "object") {
		return JSON.stringify(body.message);
	}
	return "";
};

function assertConfigured() {
	if (!env.CHAPA_SECRET_KEY) {
		throw new AppError(
			`Online payments are not configured (set CHAPA_${env.CHAPA_MODE.toUpperCase()}_SECRET_KEY or CHAPA_SECRET_KEY).`,
			503,
			ErrorCode.SERVICE_UNAVAILABLE,
		);
	}
}

function friendlyInitializeError(
	message: string,
	body?: ChapaObject | null,
	httpStatus?: number,
): AppError {
	logger.warn({ httpStatus, message, body }, "Chapa API error response");
	const normalized = message.toLowerCase();

	if (
		httpStatus === 401 ||
		normalized.includes("unauthorized") ||
		normalized.includes("invalid key")
	) {
		return new AppError(
			"Payment gateway authorization failed. Please check the API secret key.",
			500,
			"CHAPA_AUTH_FAILED",
		);
	}
	if (normalized.includes("validation.email")) {
		return new AppError(
			"Add a valid email address in your profile to pay online",
			400,
			"EMAIL_REQUIRED",
		);
	}
	if (normalized.includes("transaction reference has been used before")) {
		return new AppError(
			"Transaction reference has already been used. Please try again.",
			400,
			"TX_REF_REUSED",
		);
	}
	if (
		normalized.includes("user can't receive payments") ||
		normalized.includes("payments through api is disabled")
	) {
		return new AppError(
			"Online payments are disabled or unconfigured for this merchant account. Contact clinic support.",
			503,
			"PAYMENTS_DISABLED",
		);
	}
	if (
		normalized.includes("merchant's share of payment is not enough") ||
		normalized.includes("merchant share of payment is not enough")
	) {
		return new AppError(
			"Online payment is unavailable for this amount. Please use another payment method.",
			400,
			"PAYMENT_AMOUNT_UNAVAILABLE",
		);
	}

	return new AppError(
		message ||
			"The payment service could not start checkout. Please try again shortly.",
		httpStatus && httpStatus < 500 ? 400 : 502,
		"PAYMENT_INIT_FAILED",
	);
}

async function request(path: string, init: RequestInit): Promise<ChapaObject> {
	assertConfigured();
	let response: Response;
	try {
		response = await fetch(`${env.CHAPA_BASE_URL}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${env.CHAPA_SECRET_KEY}`,
				"Content-Type": "application/json",
				...init.headers,
			},
			signal: AbortSignal.timeout(15_000),
		});
	} catch (err) {
		logger.error(
			{ path, err },
			"Network timeout/error connecting to Chapa API",
		);
		throw new AppError(
			"The payment service is temporarily unreachable. Please check your internet connection and try again.",
			502,
			"CHAPA_NETWORK_ERROR",
		);
	}
	let body: ChapaObject | null = null;
	try {
		body = asObject(await response.json());
	} catch {
		body = null;
	}
	logger.info(
		{ path, status: response.status, message: providerMessage(body ?? {}) },
		"Chapa API response",
	);
	if (!response.ok || !body) {
		throw friendlyInitializeError(
			providerMessage(body ?? {}),
			body,
			response.status,
		);
	}
	return body;
}

/**
 * Clean up email address for Chapa validator.
 * Chapa optional field: only include email if it is a valid email with standard TLD,
 * omitting it otherwise so synthetic/invalid emails don't fail Chapa validation.
 */
function cleanEmail(email?: string): string | undefined {
	if (!email) return undefined;
	const trimmed = email.trim().toLowerCase();
	if (
		trimmed.endsWith(".et") ||
		trimmed.endsWith(".local") ||
		trimmed.endsWith(".invalid") ||
		trimmed.includes("nexa.et")
	) {
		return undefined;
	}
	const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
		trimmed,
	);
	return isValid ? trimmed : undefined;
}

export async function initializePayment(input: InitializeChapaPaymentInput) {
	const phone = toChapaPhoneNumber(input.phoneNumber);
	const email = cleanEmail(input.email);

	const payload: Record<string, unknown> = {
		first_name: input.firstName.trim() || "Patient",
		last_name: input.lastName.trim() || "User",
		currency: input.currency,
		amount: input.amount,
		tx_ref: input.txRef,
	};
	if (email) {
		payload.email = email;
	}
	if (phone) {
		payload.phone_number = phone;
	}
	if (env.CHAPA_CALLBACK_URL) {
		payload.callback_url = env.CHAPA_CALLBACK_URL;
	}
	if (input.returnUrl || env.CHAPA_RETURN_URL) {
		payload.return_url = input.returnUrl ?? env.CHAPA_RETURN_URL;
	}

	// NOTE: Split payments / subaccounts are OUT OF SCOPE for now.
	// All money goes directly to our single merchant Chapa account.
	// Do not send a `subaccounts` field. If subaccounts / split payments
	// are enabled in a future release, attach the subaccounts array here.

	logger.info(
		{
			txRef: input.txRef,
			amount: input.amount,
			currency: input.currency,
			fields: Object.keys(payload),
			phone: phone ?? "omitted",
			email: email ?? "omitted",
		},
		"Initializing Chapa payment checkout",
	);

	const body = await request("/transaction/initialize", {
		method: "POST",
		body: JSON.stringify(payload),
	});
	const data = asObject(body.data);
	if (body.status !== "success" || typeof data?.checkout_url !== "string") {
		throw friendlyInitializeError(providerMessage(body), body);
	}
	return {
		checkoutUrl: data.checkout_url,
		providerReference:
			typeof data.reference === "string" ? data.reference : null,
	};
}

export async function verifyPayment(
	txRef: string,
): Promise<ChapaVerifiedPayment> {
	logger.info({ txRef }, "Verifying transaction with Chapa API");
	const body = await request(
		`/transaction/verify/${encodeURIComponent(txRef)}`,
		{ method: "GET" },
	);
	const data = asObject(body.data);
	if (
		body.status !== "success" ||
		!data ||
		typeof data.status !== "string" ||
		typeof data.tx_ref !== "string" ||
		(typeof data.amount !== "string" && typeof data.amount !== "number") ||
		typeof data.currency !== "string"
	) {
		throw new AppError(
			"We could not verify this payment with the provider.",
			502,
			ErrorCode.BAD_GATEWAY,
		);
	}
	return {
		...data,
		status: data.status as string,
		tx_ref: data.tx_ref as string,
		amount: String(data.amount),
		currency: data.currency as string,
		mode: typeof data.mode === "string" ? data.mode : undefined,
	};
}

/**
 * Verify webhook signature against raw request body or payload.
 * Checks x-chapa-signature or chapa-signature header.
 */
export function verifySignature(
	rawBodyOrPayload: string | unknown,
	signatureHeader: string | undefined,
): boolean {
	if (!signatureHeader) return false;
	const secret = env.CHAPA_WEBHOOK_SECRET ?? env.CHAPA_SECRET_KEY;
	if (!secret) return false;

	const bodyString =
		typeof rawBodyOrPayload === "string"
			? rawBodyOrPayload
			: JSON.stringify(rawBodyOrPayload);

	const expected = createHmac("sha256", secret)
		.update(bodyString)
		.digest("hex");

	const received = signatureHeader.trim().replace(/^sha256=/i, "");
	if (!/^[a-f0-9]{64}$/i.test(received)) return false;

	try {
		return timingSafeEqual(
			Buffer.from(expected, "hex"),
			Buffer.from(received, "hex"),
		);
	} catch {
		return false;
	}
}

/** Signature-check and independently verify the referenced transaction. */
export async function handleWebhook(
	rawBodyOrPayload: string | unknown,
	signatureHeader: string | undefined,
) {
	if (!verifySignature(rawBodyOrPayload, signatureHeader)) {
		logger.warn(
			{ signatureHeader },
			"Rejected Chapa webhook due to invalid signature",
		);
		throw new AppError(
			"Invalid webhook signature",
			401,
			ErrorCode.UNAUTHORIZED,
		);
	}
	let body: ChapaObject | null = null;
	if (typeof rawBodyOrPayload === "string") {
		try {
			body = asObject(JSON.parse(rawBodyOrPayload));
		} catch {
			body = null;
		}
	} else {
		body = asObject(rawBodyOrPayload);
	}

	const txRef = body?.tx_ref;
	if (typeof txRef !== "string" || txRef.length < 1 || txRef.length > 100) {
		throw new AppError(
			"Invalid webhook transaction reference",
			400,
			ErrorCode.BAD_REQUEST,
		);
	}
	const verified = await verifyPayment(txRef);
	if (verified.tx_ref !== txRef) {
		throw new AppError(
			"Provider transaction reference mismatch",
			400,
			ErrorCode.BAD_REQUEST,
		);
	}
	return { txRef, verified, body };
}
