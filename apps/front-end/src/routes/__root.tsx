import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";

import { RootError, RootPending } from "@/components/errors/route-feedback";
import { queryClient } from "@/lib/query";

export const Route = createRootRoute({
	component: RootComponent,
	pendingComponent: RootPending,
	errorComponent: RootError,
});

// oxlint-disable-next-line react/only-export-components
function RootComponent() {
	return (
		<QueryClientProvider client={queryClient}>
			<Outlet />
			<Toaster
				position="top-right"
				toastOptions={{
					className:
						"!rounded-lg !border !border-slate-200 !bg-white !text-slate-900",
				}}
			/>
			{import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
		</QueryClientProvider>
	);
}
