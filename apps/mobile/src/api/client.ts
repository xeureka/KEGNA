import { Platform } from "react-native";

import { appConfig } from "../../config/app";
import { getApiBaseUrl, getApiHostDiagnostics } from "../config/runtime";
import type {
	Deposit,
	DepositInput,
	IssueDetail,
	SessionData,
	SubmitReportInput,
	ThreadEvent,
	ThreadRow,
	UploadedFile,
	Verification,
} from "../types";
import { authClient } from "./auth-client";
import { mobileStorage } from "./storage";

type ApiEnvelope<T> = { success: true; data: T; message?: string };
type ApiErrorEnvelope = {
	success: false;
	error?: { message?: string; code?: string; details?: unknown };
};

const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 45_000;
const TOKEN_KEY = `${appConfig.slug}-api-session-token`;

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
const tokenHydration = Promise.resolve(mobileStorage.getItem(TOKEN_KEY)).then(
	(token) => {
		accessToken = token;
	},
);
const cookieHydration = tokenHydration;

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

export function setUnauthorizedHandler(handler: (() => void) | null) {
	unauthorizedHandler = handler;
}

export function setMobileAccessToken(token: string | null) {
	accessToken = token;
	if (token) mobileStorage.setItem(TOKEN_KEY, token);
	else mobileStorage.deleteItem(TOKEN_KEY);
}

export function getMobileAccessToken() {
	return accessToken;
}

async function authHeaders() {
	await cookieHydration;
	const headers = new Headers();
	if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
	try {
		const cookie = await authClient.getCookie();
		if (cookie) headers.set("Cookie", cookie);
	} catch {
		// Cookie support is optional when the bearer token is available.
	}
	return headers;
}

export async function getAuthHeaders() {
	const headers = await authHeaders();
	return Object.fromEntries(headers.entries()) as Record<string, string>;
}

async function request<T>(
	path: string,
	init: RequestInit = {},
	timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
	const headers = await authHeaders();
	if (!(init.body instanceof FormData))
		headers.set("Content-Type", "application/json");
	headers.set("Accept", "application/json");

	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			reject(
				new MobileApiError(
					`ZOLA API request timed out after ${timeoutMs / 1000}s. Check that this device can reach ${getApiBaseUrl()}.`,
					0,
					"TIMEOUT",
				),
			);
		}, timeoutMs);
	});

	let url = "";
	try {
		url = `${getApiBaseUrl()}/api/v1${path}`;
		if (__DEV__) {
			console.info("[ZOLA API] runtime host", getApiHostDiagnostics());
			console.info(`[ZOLA API] ${init.method ?? "GET"} ${url}`);
		}
		const response = await Promise.race([
			fetch(url, { ...init, headers, signal: controller.signal }),
			timeout,
		]);
		let body: ApiEnvelope<T> | ApiErrorEnvelope;
		try {
			body = (await Promise.race([response.json(), timeout])) as
				| ApiEnvelope<T>
				| ApiErrorEnvelope;
		} catch {
			throw new MobileApiError(
				`ZOLA API returned an invalid response (${response.status})`,
				response.status,
				"INVALID_RESPONSE",
			);
		}
		if (!response.ok || body.success === false) {
			const errObj = body.success === false ? body.error : undefined;
			const message =
				errObj?.message ?? `Request failed (${response.status})`;
			const code =
				errObj?.code ??
				(response.status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR");
			const reqId =
				((errObj?.details as Record<string, unknown> | undefined)
					?.requestId as string | undefined) ??
				response.headers.get("x-request-id") ??
				undefined;
			if (response.status === 401) unauthorizedHandler?.();
			throw new MobileApiError(message, response.status, code, reqId);
		}
		return body.data;
	} catch (error) {
		if (error instanceof MobileApiError) throw error;
		if (__DEV__) console.error(`[ZOLA API] ${url}`, error);
		throw new MobileApiError(
			error instanceof Error
				? `${error.message}. Check EXPO_PUBLIC_API_URL and make sure the API is reachable from this device.`
				: "ZOLA API is unreachable. Check EXPO_PUBLIC_API_URL.",
			0,
			"NETWORK_ERROR",
		);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

export function getSession() {
	return request<SessionData>("/auth/me");
}

export function logoutApi() {
	return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function listThreads(status?: string) {
	const query = status ? `?${new URLSearchParams({ status }).toString()}` : "";
	return request<ThreadRow[]>(`/threads${query}`);
}

export function listThreadEvents(
	issueId: string,
	before?: string,
	limit = 100,
) {
	const params = new URLSearchParams({ limit: String(limit) });
	if (before) params.set("before", before);
	return request<ThreadEvent[]>(
		`/threads/${encodeURIComponent(issueId)}/events?${params.toString()}`,
	);
}

export function postComment(issueId: string, text: string) {
	return request<ThreadEvent>(
		`/threads/${encodeURIComponent(issueId)}/comments`,
		{ method: "POST", body: JSON.stringify({ text }) },
	);
}

export function markThreadRead(issueId: string) {
	return request<unknown>(`/threads/${encodeURIComponent(issueId)}/read`, {
		method: "POST",
	});
}

export function getIssue(issueId: string) {
	return request<IssueDetail>(`/issues/${encodeURIComponent(issueId)}`);
}

export function submitReport(issueId: string, input: SubmitReportInput) {
	return request<{ id: string }>(
		`/issues/${encodeURIComponent(issueId)}/report`,
		{ method: "POST", body: JSON.stringify(input) },
	);
}

export function addDeposit(reportId: string, input: DepositInput) {
	return request<Deposit>(
		`/reports/${encodeURIComponent(reportId)}/deposits`,
		{ method: "POST", body: JSON.stringify(input) },
	);
}

export function verifyReport(
	reportId: string,
	decision: "approved" | "flagged",
	note?: string,
) {
	return request<Verification>(
		`/reports/${encodeURIComponent(reportId)}/verify`,
		{
			method: "POST",
			body: JSON.stringify({ decision, note: note?.trim() || undefined }),
		},
	);
}

export function getFileUrl(key: string) {
	return `${getApiBaseUrl()}/api/v1/files/${encodeURIComponent(key)}`;
}

export async function uploadSlip(input: {
	uri: string;
	name: string;
	type: string;
}) {
	const form = new FormData();
	if (Platform.OS === "web") {
		const response = await fetch(input.uri);
		const blob = await response.blob();
		form.append("file", blob, input.name);
	} else {
		form.append("file", {
			uri: input.uri,
			name: input.name,
			type: input.type,
		} as unknown as Blob);
	}
	return request<UploadedFile>(
		"/files",
		{ method: "POST", body: form },
		UPLOAD_TIMEOUT_MS,
	);
}
