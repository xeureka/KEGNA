import { useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BackendUnavailableError } from "@/lib/auth";

export function RootError({ error }: { error?: unknown }) {
	const router = useRouter();
	if (import.meta.env.DEV) console.error("Route rendering failed", error);
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "Something went wrong while loading this dashboard";
	const unavailable = error instanceof BackendUnavailableError;

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
			<p className="text-5xl font-bold text-rose-300">
				{unavailable ? "Offline" : "Error"}
			</p>
			<p className="text-base font-semibold text-slate-800">
				{unavailable
					? "The WAI backend is unavailable."
					: "The application hit an unexpected error."}
			</p>
			<p className="max-w-sm text-sm text-slate-500">{message}</p>
			<div className="mt-2 flex items-center gap-2">
				<Button variant="secondary" onClick={() => router.invalidate()}>
					Try again
				</Button>
				<Button variant="outline" onClick={() => router.history.back()}>
					Go back
				</Button>
			</div>
		</div>
	);
}

export function RootPending() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-50">
			<div className="flex items-center gap-3 text-sm text-slate-500">
				<span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
				Loading…
			</div>
		</div>
	);
}
