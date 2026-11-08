import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { cn } from "../../lib/utils.ts";
import { Button } from "./button.tsx";

export function Modal({
	open,
	onClose,
	title,
	subtitle,
	children,
	size = "md",
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: ReactNode;
	size?: "md" | "lg";
}) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = "";
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is purely decorative and Escape also closes the dialog.
		<div
			role="presentation"
			className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:p-8"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className={cn(
					"w-full rounded-lg border border-slate-200 bg-white shadow-lg",
					size === "lg" ? "max-w-2xl" : "max-w-lg",
				)}
			>
				<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
					<div>
						<h2 className="text-base font-semibold text-slate-900">{title}</h2>
						{subtitle ? (
							<p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
						) : null}
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						aria-label="Close"
					>
						<X className="size-4" />
					</Button>
				</div>
				<div className="px-5 py-4">{children}</div>
			</div>
		</div>
	);
}
