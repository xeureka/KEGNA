import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";

export function useAppPolling(
	callback: () => void | Promise<void>,
	intervalMs: number,
	enabled = true,
) {
	const isFocused = useIsFocused();
	const [active, setActive] = useState(AppState.currentState === "active");
	const callbackRef = useRef(callback);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			setActive(state === "active");
		});
		return () => subscription.remove();
	}, []);

	useEffect(() => {
		if (!enabled || !isFocused || !active) return;
		const timer = setInterval(() => {
			void callbackRef.current();
		}, intervalMs);
		return () => clearInterval(timer);
	}, [active, enabled, intervalMs, isFocused]);
}
