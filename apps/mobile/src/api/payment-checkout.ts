import * as WebBrowser from "expo-web-browser";
import { pendingPayment, verifyPaymentStatus } from "./client";
import { tenantConfig } from "../../config/tenant.config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Open hosted checkout and confirm only from the API's Chapa verification. */
export async function openPaymentCheckout(checkoutUrl: string, txRef: string) {
	await pendingPayment.set(txRef);
	const redirectUrl = `${tenantConfig.scheme}://payment-return`;
	await WebBrowser.openAuthSessionAsync(checkoutUrl, redirectUrl);

	const deadline = Date.now() + 60_000;
	let delay = 2_000;
	while (Date.now() < deadline) {
		const result = await verifyPaymentStatus(txRef);
		if (result.status === "SUCCESS") {
			await pendingPayment.clear();
			return "SUCCESS";
		}
		if (["FAILED", "CANCELLED", "EXPIRED"].includes(result.status)) {
			await pendingPayment.clear();
			return result.status;
		}
		await sleep(delay);
		delay = Math.min(delay * 1.5, 8_000);
	}
	return "PENDING";
}
