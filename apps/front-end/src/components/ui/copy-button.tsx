import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "../../lib/utils.ts";

export function CopyButton({
	value,
	label,
	className,
}: {
	value: string;
	label?: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1600);
		return () => clearTimeout(timer);
	}, [copied]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			toast.success(`Copied ${label ?? "value"}`);
		} catch {
			toast.error("Couldn't copy to clipboard");
		}
	};

	return (
		<button
			type="button"
			onClick={copy}
			title={`Copy ${label ?? "value"}`}
			aria-label={`Copy ${label ?? "value"}`}
			className={cn(
				"inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-700",
				"focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:outline-none",
				copied && "border-emerald-200 text-emerald-600",
				className,
			)}
		>
			{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
		</button>
	);
}
