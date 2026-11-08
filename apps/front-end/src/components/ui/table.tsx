import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-sm">{children}</table>
		</div>
	);
}

export function TableHead({ children }: { children: ReactNode }) {
	return (
		<thead>
			<tr className="border-b border-slate-200 bg-slate-50">{children}</tr>
		</thead>
	);
}

export function TableBody({ children }: { children: ReactNode }) {
	return <tbody className="divide-y divide-slate-200">{children}</tbody>;
}

export function TableRow({ children }: { children: ReactNode }) {
	return <tr className="transition-colors hover:bg-slate-50">{children}</tr>;
}

export function Th({
	className,
	children,
}: {
	className?: string;
	children?: ReactNode;
}) {
	return (
		<th
			className={`px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase ${className ?? ""}`}
		>
			{children}
		</th>
	);
}

export function Td({
	className,
	children,
	title,
	compact = false,
}: {
	className?: string;
	children?: ReactNode;
	title?: string;
	compact?: boolean;
}) {
	return (
		<td
			title={title}
			className={`px-4 align-middle ${compact ? "py-2" : "py-3"} ${className ?? ""}`}
		>
			{children}
		</td>
	);
}
