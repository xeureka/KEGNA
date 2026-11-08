const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const ETHIOPIA_MSISDN_PATTERN = /^251\d{9}$/;

export function normalizePhoneNumber(value: string): string {
	const normalized = value.trim().replace(/[\s().-]/g, "");
	if (!E164_PATTERN.test(normalized)) {
		throw new Error(
			"Phone number must use E.164 format, for example +251911234567",
		);
	}
	return normalized;
}

export function isE164PhoneNumber(value: string): boolean {
	return E164_PATTERN.test(value);
}

/** SMSEthiopia expects 251XXXXXXXXX with no leading +. */
export function toSmsEthiopiaMsisdn(e164: string): string {
	const digits = e164.trim().replace(/^\+/, "").replace(/\D/g, "");
	if (!ETHIOPIA_MSISDN_PATTERN.test(digits)) {
		throw new Error(
			"Verification SMS can only be sent to Ethiopian numbers, for example +251911234567",
		);
	}
	return digits;
}

const CHAPA_PHONE_PATTERN = /^0[97]\d{8}$/;

/**
 * Chapa requires phone_number to be exactly 10 digits in 09xxxxxxxx or 07xxxxxxxx form.
 * Normalizes stored numbers (+2519..., 2519..., spaces, etc.), or returns undefined to omit the field.
 */
export function toChapaPhoneNumber(value?: string | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	let digits = trimmed.replace(/[\s().-]/g, "");
	if (digits.startsWith("+251")) {
		digits = `0${digits.slice(4)}`;
	} else if (digits.startsWith("251")) {
		digits = `0${digits.slice(3)}`;
	} else if (
		digits.length === 9 &&
		(digits.startsWith("9") || digits.startsWith("7"))
	) {
		digits = `0${digits}`;
	}
	return CHAPA_PHONE_PATTERN.test(digits) ? digits : undefined;
}
