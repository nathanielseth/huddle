import "../../board.css";
import "./phase-scene.css";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../../lib/utils/cn";

export interface PhaseSceneProps {
	title?: ReactNode;
	children: ReactNode;
	actions?: ReactNode;
	fullBleed?: boolean;
	bare?: boolean;
	// lets board-click prompts pass clicks through to the board underneath
	boardClickThrough?: boolean;
	backdrop?: "default" | "light";
	// exit state comes from the parent's useExitPresence, since that's what
	// tracks when this scene is queued to unmount
	isExiting?: boolean;
	// accepts either a RefObject or a callback ref (useExitPresence hands out
	// callback refs so it can key them per entry), so this stays React.Ref
	// rather than narrowing to RefObject like the DOM element type would suggest
	panelRef?: React.Ref<HTMLDivElement>;
}

export function PhaseScene({
	title,
	children,
	actions,
	fullBleed = false,
	bare = false,
	boardClickThrough = false,
	backdrop = "default",
	isExiting = false,
	panelRef,
}: PhaseSceneProps) {
	return createPortal(
		<div
			className={cn(
				"ft-scene-backdrop",
				// portaled to body, sibling of hand portal, so z-index competes with hand.
				// confined to the board region (excludes the rail on desktop) via the
				// same --rail-inset used by GameScreen to size the board slot; on mobile
				// the rail sits below the board so full width is correct there anyway.
				// top/left/bottom set explicitly (not via inset-0) so the lg:right override
				// can't lose to a shorthand's implicit right:0 from later in the cascade.
				"fixed top-0 left-0 bottom-0 right-0 lg:right-(--rail-inset) z-40 flex",
				!fullBleed && "items-center justify-center",
				// let board clicks pass through wrapper; panel re-enables pointer events
				boardClickThrough && "pointer-events-none",
				isExiting && "is-exiting",
			)}
		>
			<div
				className={cn(
					backdrop === "light"
						? "absolute inset-0 bg-[#050a18]/45"
						: "absolute inset-0 bg-[#050a18]/80 backdrop-blur-[2px]",
					// dim via BoardRecede; don't block board clicks
					boardClickThrough && "pointer-events-none bg-[#050a18]/55",
				)}
			/>

			<div
				ref={panelRef}
				className={cn(
					"ft-scene-panel relative pointer-events-auto",
					fullBleed
						? "absolute inset-0 flex flex-col"
						: bare
							? "flex flex-col items-center gap-4 max-w-md w-full mx-6"
							: "ft-panel-ink flex flex-col items-center gap-5 max-w-md w-full mx-6 px-6 py-8 rounded-2xl border border-white/15 shadow-2xl shadow-black/60",
					isExiting && "is-exiting",
				)}
			>
				{fullBleed ? (
					children
				) : (
					<>
						{title && (
							<p className="ft-eyebrow text-[11px] text-white/50 text-center">
								{title}
							</p>
						)}
						<div className="w-full flex flex-col items-center gap-4">
							{children}
						</div>
						{actions && (
							<div className="w-full flex justify-center gap-3">{actions}</div>
						)}
					</>
				)}
			</div>
		</div>,
		document.body,
	);
}

export function BoardRecede({
	active,
	children,
	intensity = "full",
}: {
	active: boolean;
	children: ReactNode;
	intensity?: "full" | "light";
}) {
	return (
		<div
			className={cn(
				"ft-board-recede w-full h-full",
				`intensity-${intensity}`,
				active && "is-receding",
			)}
		>
			{children}
		</div>
	);
}
