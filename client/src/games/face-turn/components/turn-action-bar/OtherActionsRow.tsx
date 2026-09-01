import "../../board.css";
import { cn } from "../../../../lib/utils/cn";
import { sendFaceturnAction } from "../../actions";
import { BOSS_FACE_TURN_COST } from "../../lib/cost";

export function OtherActionsRow({
	cash,
	effectiveTarget,
	armed,
	locked,
	onArmFaceTurn,
	runLocked,
}: {
	cash: number;
	effectiveTarget: string | null;
	armed: boolean;
	locked: boolean;
	onArmFaceTurn: () => void;
	runLocked: (fn: () => void) => void;
}) {
	const canFaceTurn = cash >= BOSS_FACE_TURN_COST && Boolean(effectiveTarget);
	return (
		<div className="flex gap-2 flex-wrap">
			<button
				type="button"
				disabled={cash < BOSS_FACE_TURN_COST || !effectiveTarget || locked}
				title={
					cash < BOSS_FACE_TURN_COST
						? `Need ₱${BOSS_FACE_TURN_COST}, you have ₱${cash}`
						: !effectiveTarget
							? "Pick a target first"
							: "Click their Crew or Boss on the board"
				}
				onClick={onArmFaceTurn}
				className={cn(
					"ft-panel-ink px-4 py-2 rounded-lg border text-sm font-bold transition-all",
					armed
						? "border-red-400 bg-red-400/10 text-red-200"
						: canFaceTurn && !locked
							? "border-white/15 text-white/70 hover:border-red-400/60 hover:text-white cursor-pointer"
							: "border-white/5 text-white/20 cursor-not-allowed opacity-50",
				)}
			>
				Face Turn <span className="text-white/30">₱{BOSS_FACE_TURN_COST}</span>
			</button>
			<button
				type="button"
				disabled={locked}
				onClick={() => {
					runLocked(() => {
						sendFaceturnAction({ type: "end_turn" });
					});
				}}
				className={cn(
					"px-4 py-2 rounded-lg border text-sm font-bold transition-all",
					locked
						? "border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
						: "border-amber-400/60 bg-amber-400/10 text-amber-200 cursor-pointer hover:bg-amber-400/20",
				)}
			>
				End turn
			</button>
		</div>
	);
}