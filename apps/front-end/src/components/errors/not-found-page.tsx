import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
			<p className="text-5xl font-bold text-slate-300">404</p>
			<p className="text-base font-semibold text-slate-800">Page not found</p>
			<p className="max-w-sm text-sm text-slate-500">
				The page you're looking for doesn't exist or you don't have access to
				it.
			</p>
			<Link to="/dashboard">
				<Button variant="secondary">Back to dashboard</Button>
			</Link>
		</div>
	);
}
