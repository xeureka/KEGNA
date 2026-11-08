import { env, isSmsEthiopiaConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { logger } from "@/lib/logger";

const TEST_CAMPAIGN_WHITELIST_ERROR = "10007";
const INVALID_MSISDN_ERROR = "10000";

const asRecord = (value: unknown): Record<string, unknown> => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
};

function readErrorCode(payload: Record<string, unknown>): string | null {
	for (const key of ["error", "error_code", "code", "errno"]) {
		const value = payload[key];
		if (typeof value === "number" || typeof value === "string") {
			return String(value);
		}
	}
	return null;
}

function extractDescription(payload: Record<string, unknown>): string | null {
	for (const key of ["description", "message", "error_message"]) {
		const value = payload[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	if (typeof payload.error === "string" && payload.error.trim()) {
		return payload.error.trim();
	}
	const fieldErrors = Object.entries(payload)
		.filter((entry): entry is [string, string] => {
			return typeof entry[1] === "string" && Boolean(entry[1].trim());
		})
		.map(([key, value]) => {
			const text = value.trim();
			return text.toLowerCase().startsWith(key.toLowerCase())
				? text
				: `${key}: ${text}`;
		});
	return fieldErrors.length > 0 ? fieldErrors.join("; ") : null;
}

export class SmsEthiopiaService {
	assertConfigured() {
		if (!isSmsEthiopiaConfigured) {
			throw new AppError(
				"SMS delivery is not configured for this environment",
				503,
				ErrorCode.SERVICE_UNAVAILABLE,
			);
		}
	}

	async sendSms(input: { msisdn: string; text: string }): Promise<void> {
		this.assertConfigured();
		const url = `${env.SMS_ETHIOPIA_BASE_URL.replace(/\/+$/, "")}/sms/send`;

		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: {
					KEY: env.SMS_ETHIOPIA ?? "",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					msisdn: input.msisdn,
					text: input.text,
				}),
			});
		} catch (error) {
			throw new AppError(
				`SMS gateway is unreachable: ${
					error instanceof Error ? error.message : "unknown error"
				}`,
				502,
				ErrorCode.BAD_GATEWAY,
			);
		}

		const rawBody = await response.text().catch(() => "");
		let parsed: unknown;
		try {
			parsed = JSON.parse(rawBody);
		} catch {
			parsed = {};
		}
		const payload = asRecord(parsed);
		const errorCode = readErrorCode(payload);
		const description = extractDescription(payload);
		const mentions = (code: string) =>
			errorCode === code || Boolean(description?.includes(code));
		const maskedMsisdn = `***${input.msisdn.slice(-4)}`;

		if (mentions(TEST_CAMPAIGN_WHITELIST_ERROR)) {
			logger.warn(
				{
					msisdn: maskedMsisdn,
					provider: "smsethiopia",
					status: response.status,
					gatewayError: description,
				},
				"SMS gateway rejected recipient: number is not whitelisted",
			);
			throw new AppError(
				"This phone number cannot receive test SMS until it is verified in the SMSEthiopia dashboard",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		if (mentions(INVALID_MSISDN_ERROR)) {
			throw new AppError(
				description ?? "SMS gateway rejected the phone number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		if (!response.ok || payload.sent === false) {
			logger.warn(
				{
					msisdn: maskedMsisdn,
					provider: "smsethiopia",
					status: response.status,
					gatewayError: description ?? rawBody.slice(0, 500),
				},
				"SMS gateway request failed",
			);
			throw new AppError(
				description
					? `SMS gateway rejected the request: ${description}`
					: `SMS gateway returned ${response.status}`,
				502,
				ErrorCode.BAD_GATEWAY,
			);
		}

		logger.info(
			{ msisdn: maskedMsisdn, provider: "smsethiopia" },
			"verification SMS accepted for delivery",
		);
	}
}

export const smsEthiopiaService = new SmsEthiopiaService();
