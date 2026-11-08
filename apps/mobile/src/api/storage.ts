import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/** SecureStore is native-only; web uses browser storage for the session token. */
function webStorage() {
	return typeof globalThis.localStorage === "undefined"
		? null
		: globalThis.localStorage;
}

export const mobileStorage = {
	getItem(key: string): string | null {
		if (Platform.OS === "web") return webStorage()?.getItem(key) ?? null;
		return SecureStore.getItem(key);
	},
	setItem(key: string, value: string): void {
		if (Platform.OS === "web") {
			webStorage()?.setItem(key, value);
			return;
		}
		SecureStore.setItem(key, value);
	},
	deleteItem(key: string): void {
		if (Platform.OS === "web") {
			webStorage()?.removeItem(key);
			return;
		}
		void SecureStore.deleteItemAsync(key);
	},
	getItemAsync(key: string) {
		if (Platform.OS === "web") return Promise.resolve(this.getItem(key));
		return SecureStore.getItemAsync(key);
	},
	setItemAsync(key: string, value: string) {
		if (Platform.OS === "web") {
			this.setItem(key, value);
			return Promise.resolve();
		}
		return SecureStore.setItemAsync(key, value);
	},
	deleteItemAsync(key: string) {
		if (Platform.OS === "web") {
			this.deleteItem(key);
			return Promise.resolve();
		}
		return SecureStore.deleteItemAsync(key);
	},
};
