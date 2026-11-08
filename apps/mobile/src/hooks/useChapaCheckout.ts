import * as WebBrowser from "expo-web-browser";
import { useState, useCallback } from "react";
import {
	pendingPayment,
	verifyPaymentStatus,
	type MobileApiError,
} from "../api/client";
import { tenantConfig } from "../../config/tenant.config";

export type CheckoutResult =
	| "SUCCESS"
	| "FAILED"
	| "CANCELLED"
	| "EXPIRED"
	| "PENDING";

export interface CheckoutOptions {
	signal?: AbortSignal;
}

export interface CheckoutCallbacks {
	onSuccess?: () => void;
	onFail?: (status: Exclude<CheckoutResult, "SUCCESS" | "PENDING">) => void;
	onPending?: () => void;
}

export interface CheckoutHookReturn {
	busy: boolean;
	startCheckout: (
		checkoutUrl: string,
		txRef: string,
		options?: CheckoutOptions,
	) => Promise<CheckoutResult>;
}

/** Single, reusable Chapa checkout + status polling with proper cleanup. */
export function useChapaCheckout(
	callbacks: CheckoutCallbacks = {},
): CheckoutHookReturn {
	const [busy, setBusy] = useState(false);

	const startCheckout = useCallback(
		async (
			checkoutUrl: string,
			txRef: string,
			options: CheckoutOptions = {},
		) => {
			const { signal } = options;

			if (busy) return "PENDING";
			setBusy(true);

			try {
				await pendingPayment.set(txRef);
				const redirectUrl = `${tenantConfig.scheme}://payment-return`;

				await WebBrowser.openAuthSessionAsync(checkoutUrl, redirectUrl);

				const deadline = Date.now() + 60_000;
				let delay = 2000;
				while (Date.now() < deadline) {
					if (signal?.aborted) {
						await pendingPayment.clear();
						return "PENDING";
					}
					const result = await verifyPaymentStatus(txRef);
					if (result.status === "SUCCESS") {
						await pendingPayment.clear();
						callbacks.onSuccess?.();
						return "SUCCESS";
					}
					if (["FAILED", "CANCELLED", "EXPIRED"].includes(result.status)) {
						await pendingPayment.clear();
						const status = result.status as Exclude<
							CheckoutResult,
							"SUCCESS" | "PENDING"
						>;
						callbacks.onFail?.(status);
						return status;
					}
					await new Promise((resolve) => setTimeout(resolve, delay));
					delay = Math.min(delay * 1.5, 8000);
				}

				await pendingPayment.clear();
				callbacks.onPending?.();
				return "PENDING";
			} catch (error) {
				await pendingPayment.clear().catch(() => undefined);
				throw error as unknown as Error | MobileApiError;
			} finally {
				setBusy(false);
			}
		},
		[busy, callbacks],
	);

	return { busy, startCheckout };
}
