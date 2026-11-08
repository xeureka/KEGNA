const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneNumber(value: string): string {
	return value.trim().replace(/[\s().-]/g, "");
}

export function isE164PhoneNumber(value: string): boolean {
	return E164_PATTERN.test(normalizePhoneNumber(value));
}
