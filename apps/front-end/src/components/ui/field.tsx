import type {
	InputHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";

import { cn } from "../../lib/utils.ts";

const baseField =
	"w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 " +
	"focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none " +
	"disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function Input({
	className,
	...props
}: InputHTMLAttributes<HTMLInputElement>) {
	return <input className={cn(baseField, className)} {...props} />;
}

export function Textarea({
	className,
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(baseField, "min-h-24 resize-y", className)}
			{...props}
		/>
	);
}

export function Select({
	className,
	children,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select className={cn(baseField, "pr-8", className)} {...props}>
			{children}
		</select>
	);
}

export function Field({
	label,
	error,
	hint,
	children,
	className,
}: {
	label: string;
	error?: string;
	hint?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("block", className)}>
			<span className="mb-1.5 block text-sm font-medium text-slate-700">
				{label}
			</span>
			{children}
			{hint && !error ? (
				<span className="mt-1 block text-xs text-slate-500">{hint}</span>
			) : null}
			{error ? (
				<span className="mt-1 block text-xs font-medium text-rose-600">
					{error}
				</span>
			) : null}
		</div>
	);
}
