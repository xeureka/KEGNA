import type { ReactNode } from "react";

import { cn } from "../../lib/utils.ts";

export function Card({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"rounded-lg border border-slate-200 bg-white shadow-xs",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function CardHeader({
	title,
	subtitle,
	actions,
}: {
	title: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
			<div>
				<h3 className="text-sm font-semibold text-slate-900">{title}</h3>
				{subtitle ? (
					<p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
				) : null}
			</div>
			{actions ? <div className="shrink-0">{actions}</div> : null}
		</div>
	);
}

export function CardContent({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
