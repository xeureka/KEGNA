import { getAccessToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export class ApiError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(message: string, code: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.status = status;
	}
}

interface Envelope<T> {
	success: true;
	data: T;
	message?: string;
}

interface ErrorEnvelope {
	success: false;
	error?: { code?: string; message?: string };
}

/**
 * Resolves a route path to the versioned API path. Accepts legacy
 * `/api/...` and raw `/...` forms and normalizes them to `/api/v1/...`.
 */
export function apiPath(path: string): string {
	const stripped = path.replace(/^\/api(\/v1)?/, "");
	return `/api/v1${stripped.startsWith("/") ? stripped : `/${stripped}`}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const controller = new AbortController();
	const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
	const callerSignal = options.signal;
	if (callerSignal) {
		if (callerSignal.aborted) controller.abort(callerSignal.reason);
		else
			callerSignal.addEventListener(
				"abort",
				() => controller.abort(callerSignal.reason),
				{ once: true },
			);
	}
	const token = getAccessToken();

	const headers: Record<string, string> = {
		...(options.body instanceof FormData
			? {}
			: { "Content-Type": "application/json" }),
		...(options.headers as Record<string, string>),
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	let res: Response;
	try {
		res = await fetch(`${API_BASE_URL}${apiPath(path)}`, {
			...options,
			signal: controller.signal,
			headers,
			credentials: "include",
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new ApiError(
				`The API did not respond while loading ${path}. Check that the back-end service is running.`,
				"REQUEST_TIMEOUT",
				504,
			);
		}
		throw error;
	} finally {
		window.clearTimeout(timeoutId);
	}

	if (!res.ok) {
		let code = "UNKNOWN";
		let message = `Request failed (${res.status})`;
		try {
			const body = (await res.json()) as ErrorEnvelope;
			if (body?.error?.message) message = body.error.message;
			if (body?.error?.code) code = body.error.code;
		} catch {
			// non-JSON error body — keep defaults
		}
		throw new ApiError(`${message} [${path}]`, code, res.status);
	}

	if (res.status === 204) return undefined as T;

	const body = (await res.json()) as Envelope<T> | ErrorEnvelope;
	if (body.success === false) {
		throw new ApiError(
			body.error?.message ?? "Request failed",
			body.error?.code ?? "UNKNOWN",
			res.status,
		);
	}
	return body.data as T;
}

export const api = {
	get: <T>(path: string, params?: Record<string, unknown>) => {
		const search = params
			? "?" +
				Object.entries(params)
					.filter(
						([, value]) =>
							value !== undefined && value !== null && value !== "",
					)
					.map(
						([key, value]) =>
							`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
					)
					.join("&")
			: "";
		return request<T>(`${path}${search}`);
	},
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "POST",
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	patch: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "PATCH",
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	put: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "PUT",
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
	upload: <T>(path: string, file: File) => {
		const form = new FormData();
		form.append("file", file);
		return request<T>(path, { method: "POST", body: form });
	},
};
