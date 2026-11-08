import { assertTenantConfig, tenantConfig } from "../config/tenant";
import { getApiBaseUrl, getApiHostDiagnostics } from "../config/runtime";
import { authClient } from "./auth-client";
import { mobileStorage } from "./storage";
import { normalizePhoneNumber, isE164PhoneNumber } from "../utils/phone";

type ApiEnvelope<T> = { success: true; data: T; message?: string };
type ApiErrorEnvelope = {
	success: false;
	error?: { message?: string; code?: string; details?: unknown };
};
const REQUEST_TIMEOUT_MS = 15_000;
const PENDING_PAYMENT_KEY = `${tenantConfig.slug}-pending-payment`;

let accessToken: string | null = null;
let pendingPhone: string | null = null;
let pendingRegistration: { firstName: string; lastName: string } | null = null;
let accountNotFoundForPhone: string | null = null;
const TOKEN_KEY = `${tenantConfig.slug}-api-session-token`;
const tokenHydration = Promise.resolve(mobileStorage.getItem(TOKEN_KEY)).then(
	(token) => {
		accessToken = token;
	},
);

export class MobileApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string,
		readonly requestId?: string,
	) {
		super(message);
		this.name = "MobileApiError";
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	assertTenantConfig();
	const headers = new Headers(init.headers);
	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			reject(
				new MobileApiError(
					`CRM API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Check that the device can reach ${getApiBaseUrl()}.`,
					0,
					"TIMEOUT",
				),
			);
		}, REQUEST_TIMEOUT_MS);
	});
	// Build-time tenant identity is a routing/observability hint only. The
	// backend independently resolves and verifies the authorized tenant.
	headers.set("X-Nexa-Tenant-Id", tenantConfig.id);
	headers.set("X-Nexa-Tenant-Slug", tenantConfig.slug);
	if (!(init.body instanceof FormData))
		headers.set("Content-Type", "application/json");
	if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
	let url = "";
	try {
		const apiBaseUrl = getApiBaseUrl();
		url = `${apiBaseUrl}/api/v1${path}`;
		if (__DEV__) {
			console.info("[Mobile API] runtime host", getApiHostDiagnostics());
			console.info(
				`[Mobile API] ${init.method ?? "GET"} ${url} tenant=${tenantConfig.slug}`,
			);
		}
		await Promise.race([tokenHydration, timeout]);
		const cookie = await Promise.race([authClient.getCookie(), timeout]);
		if (cookie) headers.set("Cookie", cookie);
		const response = await Promise.race([
			fetch(url, {
				...init,
				headers,
				signal: controller.signal,
			}),
			timeout,
		]);
		let body: ApiEnvelope<T> | ApiErrorEnvelope;
		try {
			body = (await Promise.race([response.json(), timeout])) as
				| ApiEnvelope<T>
				| ApiErrorEnvelope;
		} catch {
			throw new MobileApiError(
				`CRM API returned an invalid response (${response.status})`,
				response.status,
				"INVALID_RESPONSE",
			);
		}
		if (!response.ok || body.success === false) {
			const errObj = body.success === false ? body.error : undefined;
			const msg = errObj?.message ?? `Request failed (${response.status})`;
			const code =
				errObj?.code ??
				(response.status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR");
			const reqId =
				((errObj?.details as Record<string, unknown> | undefined)?.requestId as
					| string
					| undefined) ??
				response.headers.get("x-request-id") ??
				undefined;
			throw new MobileApiError(msg, response.status, code, reqId);
		}
		return body.data;
	} catch (error) {
		if (error instanceof MobileApiError) throw error;
		if (__DEV__) console.error(`[Mobile API] ${url}`, error);
		throw new MobileApiError(
			error instanceof Error
				? `${error.message}. Check the derived Expo host or EXPO_PUBLIC_API_URL and ensure the back-end service is reachable from this device.`
				: "CRM API is unreachable. Check the derived Expo host or EXPO_PUBLIC_API_URL.",
			0,
			"NETWORK_ERROR",
		);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

export function setMobileAccessToken(token: string | null) {
	accessToken = token;
	void (token
		? mobileStorage.setItem(TOKEN_KEY, token)
		: mobileStorage.deleteItem(TOKEN_KEY));
}

export function setPendingPhone(phone: string) {
	pendingPhone = phone;
}

export function setAccountNotFoundPhone(phone: string) {
	pendingPhone = phone;
	accountNotFoundForPhone = phone;
}

export function consumeAccountNotFoundPhone() {
	const phone = accountNotFoundForPhone;
	accountNotFoundForPhone = null;
	return phone;
}

export function clearPendingRegistration() {
	pendingRegistration = null;
}

export function setPendingRegistration(profile: {
	firstName: string;
	lastName: string;
}) {
	pendingRegistration = profile;
}

export function getPendingPhone() {
	return pendingPhone;
}

export async function checkPhoneExists(phone: string) {
	const normalized = normalizePhoneNumber(phone);
	if (!isE164PhoneNumber(normalized)) {
		throw new Error(
			"Enter your phone number in E.164 format, for example +251911234567.",
		);
	}
	const result = await request<{ exists: boolean }>("/auth/otp/phone-exists", {
		method: "POST",
		body: JSON.stringify({ phone: normalized }),
	});
	return { phone: normalized, exists: result.exists };
}

export async function requestPhoneOtp(phone: string) {
	const normalized = normalizePhoneNumber(phone);
	if (!isE164PhoneNumber(normalized)) {
		throw new Error(
			"Enter your phone number in E.164 format, for example +251911234567.",
		);
	}
	setPendingPhone(normalized);
	return request<{ message: string }>("/auth/otp/request", {
		method: "POST",
		body: JSON.stringify({ phone: normalized }),
	});
}

export async function verifyPhoneOtp(phone: string, code: string) {
	const normalized = normalizePhoneNumber(phone);
	if (!isE164PhoneNumber(normalized)) {
		throw new Error(
			"Enter your phone number in E.164 format, for example +251911234567.",
		);
	}
	const result = await request<{
		user: Record<string, unknown>;
		sessionToken: string;
		tenant?: Record<string, unknown>;
	}>("/auth/otp/verify", {
		method: "POST",
		body: JSON.stringify({ phone: normalized, code, ...pendingRegistration }),
	});
	pendingRegistration = null;
	const sessionToken = result.sessionToken;
	setMobileAccessToken(sessionToken);
	return result;
}

export function listAppointments(params?: Record<string, string>) {
	const search = params ? `?${new URLSearchParams(params).toString()}` : "";
	return request<Array<Record<string, unknown>>>(
		`/mobile/appointments${search}`,
	);
}

export function listDoctors() {
	return request<{
		items: Array<Record<string, unknown>>;
		total: number;
		page: number;
		pageSize: number;
	}>("/doctors");
}

export function getDoctor(id: string) {
	return request<Record<string, unknown>>(`/doctors/${encodeURIComponent(id)}`);
}

export function createMobileAppointment(input: {
	doctorId: string;
	startAt: string;
	endAt: string;
	reason?: string;
}) {
	return request<{
		id: string;
		status: string;
		startAt: string;
		endAt: string;
	}>("/mobile/appointments", { method: "POST", body: JSON.stringify(input) });
}

export function rescheduleMobileAppointment(
	id: string,
	input: { startAt: string; endAt: string },
) {
	return request<{
		id: string;
		status: string;
		startAt: string;
		endAt: string;
	}>(`/mobile/appointments/${encodeURIComponent(id)}`, {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}

export function cancelMobileAppointment(
	id: string,
	reason = "Cancelled from mobile app",
) {
	return request<{ id: string; status: string }>(
		`/mobile/appointments/${encodeURIComponent(id)}/cancel`,
		{ method: "POST", body: JSON.stringify({ reason }) },
	);
}

export function listMobileServices() {
	return request<Array<Record<string, unknown>>>("/mobile/services");
}

export function createVisitPayment(input: {
	serviceId: string;
	doctorId: string;
	startAt: string;
}) {
	return request<{ checkout_url: string; tx_ref: string }>("/payments/visit", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function verifyPaymentStatus(txRef: string) {
	return request<{ idempotent: boolean; status: string }>(
		`/payments/${encodeURIComponent(txRef)}/status`,
	);
}

export const pendingPayment = {
	get: () => mobileStorage.getItemAsync(PENDING_PAYMENT_KEY),
	set: (txRef: string) =>
		mobileStorage.setItemAsync(PENDING_PAYMENT_KEY, txRef),
	clear: () => mobileStorage.deleteItemAsync(PENDING_PAYMENT_KEY),
};

export function listCardProducts() {
	return request<Array<Record<string, unknown>>>("/payments/cards");
}

export function listPurchasedCards() {
	return request<Array<Record<string, unknown>>>("/payments/cards/me");
}

export function createCardPayment(cardId: string) {
	return request<{ checkout_url: string; tx_ref: string }>("/payments/card", {
		method: "POST",
		body: JSON.stringify({ cardId }),
	});
}

export function createBalancePayment(amount?: string) {
	return request<{ checkout_url: string; tx_ref: string }>(
		"/payments/balance",
		{
			method: "POST",
			body: JSON.stringify(amount ? { amount } : {}),
		},
	);
}

export function getMyPaymentBalance() {
	return request<Record<string, unknown>>("/payments/me/balance");
}

export function getPaymentConfig() {
	return request<{
		currency: string;
		serviceChargeEtb: string;
		holdMinutes: number;
	}>("/payments/config");
}

/** Safe, bilingual user-facing text for a failed checkout or payment API call. */
export function paymentErrorMessage(error: unknown, fallback: string): string {
	let message = fallback;
	let reqId: string | undefined;

	if (error instanceof MobileApiError) {
		reqId = error.requestId;
		if (
			error.code === "CHAPA_AUTH_FAILED" ||
			error.code === "PAYMENT_INIT_FAILED"
		) {
			message =
				"Unable to start checkout with payment service. / ኦንላይን ክፍያ መጀመር አልተቻለም። እባክዎ እንደገና ይሞክሩ።";
		} else if (error.code === "TX_REF_REUSED") {
			message =
				"Payment reference was already processed. / የክፍያ ማጣቀሻው ቀደም ብሎ ተይዟል።";
		} else if (error.code === "SLOT_UNAVAILABLE" || error.code === "CONFLICT") {
			message =
				"This slot or plan is no longer available. / ይህ ቀጠሮ ወይም ፕላን አይገኝም።";
		} else if (error.code === "PAYMENTS_DISABLED") {
			message =
				"Online payments are currently disabled. / ኦንላይን ክፍያ በአሁኑ ጊዜ አልተቻለም።";
		} else if (error.code === "EMAIL_REQUIRED") {
			message =
				"Add a valid email address in Profile → Edit profile to pay online. / ኦንላይን ለመክፈል በመገለጫዎ ውስጥ ትክክለኛ ኢሜይል ያክሉ።";
		} else if (error.message && error.status < 500) {
			message = error.message;
		}
	} else if (error instanceof Error && error.message) {
		message = error.message;
	}

	if (reqId) {
		return `${message}\n\n[Ref: ${reqId}]`;
	}
	return message;
}

export function listMyPayments(page = 1, pageSize = 20) {
	return request<{
		items: Array<Record<string, unknown>>;
		total: number;
		page: number;
		pageSize: number;
	}>(`/payments/me?page=${page}&pageSize=${pageSize}`);
}

export function listDentalHistory() {
	return request<Array<Record<string, unknown>>>("/mobile/dental-history");
}

export function listMobileNotifications() {
	return request<Array<Record<string, unknown>>>("/mobile/notifications");
}

export function markMobileNotificationRead(id: string) {
	return request<{ marked: boolean }>(
		`/mobile/notifications/${encodeURIComponent(id)}/read`,
		{ method: "POST" },
	);
}

export function updateMobileProfile(input: {
	name?: string;
	email?: string;
	dateOfBirth?: string;
	emergencyContactPhone?: string;
}) {
	return request<{ user: Record<string, unknown> }>("/mobile/me", {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}

export function getMobileProfile() {
	return request<{
		user: Record<string, unknown>;
		patient: Record<string, unknown> | null;
	}>("/mobile/me");
}

export function listMobileBills() {
	return request<Array<Record<string, unknown>>>("/mobile/bills");
}
