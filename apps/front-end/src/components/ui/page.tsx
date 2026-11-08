import { HeartPulse } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export function PageHeader({
	title,
	subtitle,
	actions,
	className,
}: {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex items-start justify-between gap-4", className)}>
			<div>
				<h1 className="text-xl font-bold text-slate-900">{title}</h1>
				{subtitle ? (
					<p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}

export function EmptyState({
	title,
	description,
	action,
	icon,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
	icon?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
			<div className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
				{icon ?? (
					<svg
						className="size-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						aria-hidden
					>
						<rect x="3" y="4" width="18" height="16" rx="2" />
						<path d="M3 9h18" />
						<path d="M8 13h8" />
					</svg>
				)}
			</div>
			<p className="text-sm font-semibold text-slate-700">{title}</p>
			{description ? (
				<p className="max-w-sm text-sm text-slate-500">{description}</p>
			) : null}
			{action ? <div className="mt-2">{action}</div> : null}
		</div>
	);
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 px-6 py-16">
			<div className="relative size-10">
				<div className="absolute inset-0 rounded-full border-4 border-primary-100" />
				<div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-300" />
				<div className="absolute inset-0 flex items-center justify-center">
					<HeartPulse className="size-4 animate-pulse text-primary-600" />
				</div>
			</div>
			{label ? (
				<p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
					{label}
				</p>
			) : null}
		</div>
	);
}

export function InlineError({ message }: { message: string }) {
	return (
		<div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
			{message}
		</div>
	);
}
