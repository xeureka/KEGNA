import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/utils.ts";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
	primary:
		"border border-primary-600 bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500/30",
	secondary:
		"border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/30",
	danger:
		"border border-rose-600 bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/30",
	ghost:
		"border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
	outline:
		"border border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/30",
};

const sizes: Record<Size, string> = {
	sm: "px-2.5 py-1.5 text-xs",
	md: "px-3.5 py-2 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	children: ReactNode;
}

export function Button({
	variant = "primary",
	size = "md",
	loading = false,
	className,
	disabled,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
				"focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
				"disabled:cursor-not-allowed disabled:opacity-50",
				variants[variant],
				sizes[size],
				className,
			)}
			disabled={disabled || loading}
			{...props}
		>
			{loading && (
				<span
					className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
					aria-hidden
				/>
			)}
			{children}
		</button>
	);
}
