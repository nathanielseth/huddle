import { useEffect, useRef, useState } from "react";
import { cn } from "../../../../lib/utils/cn";

// below this width the stats group and done button no longer comfortably
// share one row at their natural sizes
const STACK_THRESHOLD_PX = 360;

export function DraftFooter({
	bossDone,
	crewCount,
	crewMax,
	moveCount,
	moveMax,
	allDone,
	locked,
	pickedCount,
	onDone,
	onReviewPicks,
}: {
	bossDone: boolean;
	crewCount: number;
	crewMax: number;
	moveCount: number;
	moveMax: number;
	allDone: boolean;
	locked: boolean;
	pickedCount: number;
	onDone: () => void;
	// present only on layouts (mobile) where the pick list isn't already visible
	onReviewPicks?: () => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [stacked, setStacked] = useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width !== undefined) setStacked(width < STACK_THRESHOLD_PX);
		});
		observer.observe(el);
		return () => {
			observer.disconnect();
		};
	}, []);

	const stats = (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black tracking-widest uppercase text-white/40 min-w-0">
			<span className="whitespace-nowrap">
				Boss <span className="text-white/70">{bossDone ? 1 : 0}/1</span>
			</span>
			<span className="whitespace-nowrap">
				Crew{" "}
				<span className="text-white/70">
					{crewCount}/{crewMax}
				</span>
			</span>
			<span className="whitespace-nowrap">
				Moves{" "}
				<span className="text-white/70">
					{moveCount}/{moveMax}
				</span>
			</span>
			{onReviewPicks && (
				<button
					type="button"
					onClick={onReviewPicks}
					className={cn(
						"flex items-center gap-1 text-white/50 hover:text-white active:text-white normal-case tracking-normal font-bold text-xs cursor-pointer",
						!stacked && "ml-auto",
					)}
				>
					{pickedCount > 0 ? `${pickedCount} picked` : "Review"}
					<svg
						viewBox="0 0 24 24"
						className="w-3 h-3"
						fill="none"
						stroke="currentColor"
						strokeWidth={3}
					>
						<path
							d="M6 9l6 6 6-6"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			)}
		</div>
	);

	const doneButton = (
		<button
			type="button"
			disabled={!allDone || locked}
			onClick={onDone}
			className={cn(
				"shrink-0 px-6 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all min-w-26",
				stacked && "w-full",
				allDone && !locked
					? "border-amber-400/60 bg-amber-400/10 text-amber-200 cursor-pointer active:scale-95"
					: "border-white/10 text-white/20 cursor-not-allowed",
			)}
		>
			{locked ? "Locking…" : "Done"}
		</button>
	);

	return (
		<div
			ref={containerRef}
			className="shrink-0 border-t border-white/10 ft-draft-bg"
			style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
		>
			{stacked ? (
				<div className="flex flex-col gap-2 px-4 py-2.5">
					{stats}
					{doneButton}
				</div>
			) : (
				<div className="flex items-center gap-3 px-4 py-2.5">
					<div className="flex-1 min-w-0">{stats}</div>
					{doneButton}
				</div>
			)}
		</div>
	);
}