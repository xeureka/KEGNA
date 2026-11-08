import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./button.tsx";

export function Pagination({
	page,
	totalPages,
	onPageChange,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;

	const pages: Array<number | "…"> = [];
	for (let i = 1; i <= totalPages; i++) {
		if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
			pages.push(i);
		} else if (pages[pages.length - 1] !== "…") {
			pages.push("…");
		}
	}

	return (
		<div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-3">
			<p className="text-xs text-slate-500">
				Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
				<span className="font-semibold text-slate-700">{totalPages}</span>
			</p>
			<div className="flex items-center gap-1">
				<Button
					variant="secondary"
					size="sm"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
					aria-label="Previous page"
				>
					<ChevronLeft className="size-4" />
				</Button>
				{pages.map((p, index) =>
					p === "…" ? (
						<span
							key={`gap-${pages[index - 1]}`}
							className="px-2 text-sm text-slate-400"
						>
							…
						</span>
					) : (
						<button
							type="button"
							key={p}
							onClick={() => onPageChange(p)}
							className={`inline-flex size-8 items-center justify-center rounded-lg border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:outline-none ${
								p === page
									? "border-primary-600 bg-primary-600 text-white"
									: "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
							}`}
							aria-current={p === page ? "page" : undefined}
						>
							{p}
						</button>
					),
				)}
				<Button
					variant="secondary"
					size="sm"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
					aria-label="Next page"
				>
					<ChevronRight className="size-4" />
				</Button>
			</div>
		</div>
	);
}
