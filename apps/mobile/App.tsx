import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { AppErrorBoundary, reportGlobalError } from "./src/components/AppErrorBoundary";
import { useEffect } from "react";

function RuntimeErrorHandlers() {
	useEffect(() => {
		const runtime = globalThis as typeof globalThis & { ErrorUtils?: { setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void; getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void }; addEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void; removeEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void };
		const previous = runtime.ErrorUtils?.getGlobalHandler?.();
		const handler = (error: Error, isFatal?: boolean) => { reportGlobalError(error); if (__DEV__) previous?.(error, isFatal); };
		runtime.ErrorUtils?.setGlobalHandler(handler);
		const rejection = (event: { reason?: unknown }) => reportGlobalError(event.reason instanceof Error ? event.reason : new Error(String(event.reason ?? "Unhandled promise rejection")));
		runtime.addEventListener?.("unhandledrejection", rejection);
		return () => runtime.removeEventListener?.("unhandledrejection", rejection);
	}, []);
	return null;
}

export default function App() {
	return (
		<AppErrorBoundary><SafeAreaProvider><AuthProvider><NavigationContainer><RuntimeErrorHandlers /><StatusBar style="dark" /><AppNavigator /></NavigationContainer></AuthProvider></SafeAreaProvider></AppErrorBoundary>
	);
}
