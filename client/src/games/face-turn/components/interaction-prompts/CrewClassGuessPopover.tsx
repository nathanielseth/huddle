import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../../lib/utils/cn";
import type { CrewClass } from "@shared/games/face-turn/types";

const CLASS_OPTIONS: CrewClass[] = [
	"striker",
	"defender",
	"collector",
	"hider",
];

interface Rect {
	top: number;
	left: number;
	width: number;
	height: number;
}

function measure(el: HTMLElement): Rect {
	const r = el.getBoundingClientRect();
	return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// class guess popover anchored to a clicked card, shared by background_check_guess and boss command
export function CrewClassGuessPopover({
	anchorEl,
	onConfirm,
	onCancel,
	locked,
}: {
	anchorEl: HTMLElement | null;
	onConfirm: (guessClass: CrewClass) => void;
	onCancel: () => void;
	locked: boolean;
}) {
	// measure during render to avoid first frame with null geometry
	const [, setReMeasureTick] = useState(0);
	const rect = anchorEl ? measure(anchorEl) : null;
	const [guessClass, setGuessClass] = useState<CrewClass | null>(null);
	const popoverRef = useRef<HTMLDivElement | null>(null);

	// re-measure on resize/scroll to track anchor through reflows
	useEffect(() => {
		if (!anchorEl) return;
		function reMeasure() {
			setReMeasureTick((t) => t + 1);
		}
		window.addEventListener("resize", reMeasure);
		window.addEventListener("scroll", reMeasure, true);
		return () => {
			window.removeEventListener("resize", reMeasure);
			window.removeEventListener("scroll", reMeasure, true);
		};
	}, [anchorEl]);

	// dismiss on outside click and escape
	useEffect(() => {
		function handlePointerDown(e: PointerEvent) {
			if (!popoverRef.current) return;
			if (!(e.target instanceof Node)) return;
			if (popoverRef.current.contains(e.target)) return;
			onCancel();
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [onCancel]);

	if (!rect) return null;

	return createPortal(
		<div
			ref={popoverRef}
			className="ft-panel-ink fixed flex flex-col gap-2 rounded-xl border border-white/15 px-3 py-3 shadow-2xl shadow-black/60"
			style={{
				// clamp left so popover doesn't run off viewport edge
				top: rect.top + rect.height + 8,
				left: Math.max(8, rect.left + rect.width / 2 - 110),
				width: 220,
				zIndex: 1050,
			}}
		>
			<span className="text-[10px] uppercase tracking-widest text-white/30">
				Guess class
			</span>
			<div className="grid grid-cols-2 gap-1.5">
				{CLASS_OPTIONS.map((c) => (
					<button
						key={c}
						type="button"
						disabled={locked}
						onClick={() => {
							setGuessClass(c);
						}}
						className={cn(
							"ft-panel-ink px-2 py-1.5 rounded-lg border text-xs font-bold capitalize transition-all",
							locked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
							guessClass === c
								? "border-amber-400 text-amber-200 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.3)]"
								: "border-white/15 text-white/70 hover:border-white/30",
						)}
					>
						{c}
					</button>
				))}
			</div>
			<button
				type="button"
				disabled={!guessClass || locked}
				onClick={() => {
					if (!guessClass) return;
					onConfirm(guessClass);
				}}
				className={cn(
					"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
					!guessClass || locked
						? "border-white/10 text-white/20 cursor-not-allowed"
						: "border-amber-400/60 text-amber-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]",
				)}
			>
				Confirm guess
			</button>
		</div>,
		document.body,
	);
}