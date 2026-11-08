import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "./card.tsx";

export function StatCard({
	label,
	value,
	icon: Icon,
	hint,
}: {
	label: string;
	value: string | number;
	icon: LucideIcon;
	hint?: string;
}) {
	return (
		<Card className="p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
						{label}
					</p>
					<p className="mt-1.5 text-2xl font-semibold text-slate-900">
						{value}
					</p>
					{hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
				</div>
				<Icon className="size-5 shrink-0 text-slate-400" aria-hidden />
			</div>
		</Card>
	);
}

export function SummaryRow({
	label,
	value,
	children,
}: {
	label: string;
	value?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 py-2">
			<dt className="text-sm text-slate-500">{label}</dt>
			<dd className="text-sm font-medium text-slate-900">
				{value ?? children}
			</dd>
		</div>
	);
}
