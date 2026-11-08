import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

import type { SortDir } from "@/hooks/use-sort";
import { cn } from "@/lib/utils";

import { Th } from "./table.tsx";

export function SortableTh({
	field,
	sortKey,
	sortDir,
	onSort,
	align = "left",
	className,
	children,
}: {
	field: string;
	sortKey: string | null;
	sortDir: SortDir;
	onSort: (field: string) => void;
	align?: "left" | "right";
	className?: string;
	children?: ReactNode;
}) {
	const isActive = sortKey === field;
	return (
		<Th className={className}>
			<button
				type="button"
				onClick={() => onSort(field)}
				className={cn(
					"inline-flex w-full items-center gap-1 transition-colors hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:outline-none",
					align === "right" && "justify-end",
				)}
			>
				{children}
				{isActive ? (
					sortDir === "asc" ? (
						<ArrowUp className="size-3 shrink-0" />
					) : (
						<ArrowDown className="size-3 shrink-0" />
					)
				) : (
					<ChevronsUpDown className="size-3 shrink-0 opacity-40" />
				)}
			</button>
		</Th>
	);
}
