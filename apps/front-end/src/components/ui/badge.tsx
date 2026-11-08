import { type BadgeTone, badgeTones } from "../../lib/status.ts";
import { cn } from "../../lib/utils.ts";

export function Badge({
	tone = "neutral",
	children,
	className,
}: {
	tone?: BadgeTone;
	children: React.ReactNode;
	className?: string;
}) {
	// API data can contain a newly introduced status before the frontend map is
	// updated. Keep navigation/rendering alive and show a neutral badge rather
	// than throwing while reading an undefined palette.
	const palette = badgeTones[tone] ?? badgeTones.neutral;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
				palette.chip,
				className,
			)}
		>
			<span className={cn("size-1.5 rounded-full", palette.dot)} aria-hidden />
			{children}
		</span>
	);
}
