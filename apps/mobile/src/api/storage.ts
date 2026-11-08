import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memory = new Map<string, string>();

function webStorage() {
	return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
}

export const mobileStorage = {
	getItem(key: string): string | null {
		if (Platform.OS === "web") return webStorage()?.getItem(key) ?? null;
		return memory.get(key) ?? null;
	},
	setItem(key: string, value: string): void {
		memory.set(key, value);
		if (Platform.OS === "web") webStorage()?.setItem(key, value);
		else void SecureStore.setItemAsync(key, value);
	},
	deleteItem(key: string): void {
		memory.delete(key);
		if (Platform.OS === "web") webStorage()?.removeItem(key);
		else void SecureStore.deleteItemAsync(key);
	},
	async getItemAsync(key: string): Promise<string | null> {
		if (Platform.OS === "web") return this.getItem(key);
		const value = await SecureStore.getItemAsync(key);
		if (value !== null) memory.set(key, value);
		return value;
	},
	async setItemAsync(key: string, value: string): Promise<void> {
		memory.set(key, value);
		if (Platform.OS === "web") webStorage()?.setItem(key, value);
		else await SecureStore.setItemAsync(key, value);
	},
	async deleteItemAsync(key: string): Promise<void> {
		memory.delete(key);
		if (Platform.OS === "web") webStorage()?.removeItem(key);
		else await SecureStore.deleteItemAsync(key);
	},
	async updateItemAsync(key: string, updater: (value: string | null) => string | null): Promise<boolean> {
		const next = updater(await this.getItemAsync(key));
		if (next === null) await this.deleteItemAsync(key);
		else await this.setItemAsync(key, next);
		return true;
	},
};
