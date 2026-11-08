import { AsyncLocalStorage } from "node:async_hooks";

export const otpRequestContext = new AsyncLocalStorage<{
	tenantName: string;
}>();
