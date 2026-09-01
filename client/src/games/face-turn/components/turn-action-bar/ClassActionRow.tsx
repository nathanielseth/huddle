import "../../board.css";
import { cn } from "../../../../lib/utils/cn";
import type { CrewClass } from "@shared/games/face-turn/types";
import { SectionTitle } from "../SectionTitle";
import { makeClassActionCostEstimator } from "../../lib/cost";

const CLASS_ACTIONS: {
	action: "strike" | "collect" | "hide";
	label: string;
	needsClass: CrewClass;
}[] = [
	{ action: "strike", label: "Strike", needsClass: "striker" },
	{ action: "collect", label: "Collect", needsClass: "collector" },
	{ action: "hide", label: "Hide", needsClass: "hider" },
];

export function ClassActionRow({
	cash,
	classActionCostReduction,
	hasFaceDownCrew,
	hasClassLive,
	classActionUsedThisTurn,
	needsExplicitTarget,
	armedAction,
	locked,
	onArm,
}: {
	cash: number;
	classActionCostReduction: number;
	hasFaceDownCrew: boolean;
	hasClassLive: (cls: CrewClass) => boolean;
	classActionUsedThisTurn: boolean;
	needsExplicitTarget: boolean;
	armedAction: "strike" | "collect" | "hide" | null;
	locked: boolean;
	onArm: (action: "strike" | "collect" | "hide") => void;
}) {
	const getCost = makeClassActionCostEstimator(classActionCostReduction);
	return (
		<div className="flex flex-col gap-1">
			<SectionTitle>
				Class action ({getCost("strike")}/{getCost("collect")}/{getCost("hide")}{" "}
				cash)
			</SectionTitle>
			<div className="flex gap-2 flex-wrap">
				{CLASS_ACTIONS.map(({ action, label, needsClass }) => {
					const cost = getCost(action);
					const affordable = cash >= cost;
					const wouldBeBluffing = !hasClassLive(needsClass);
					const bluffBlocked = wouldBeBluffing && !hasFaceDownCrew;
					const targetBlocked = action === "strike" && needsExplicitTarget;
					const disabled =
						!affordable ||
						bluffBlocked ||
						targetBlocked ||
						locked ||
						classActionUsedThisTurn;
					const armed = armedAction === action;
					const title = !affordable
						? `Need ₱${cost}, you have ₱${cash}`
						: bluffBlocked
							? "No face-down Crew left to bluff with"
							: targetBlocked
								? "Pick a target first"
								: action === "strike"
									? "Click their Crew or Boss on the board"
									: action === "hide"
										? "Click one of your face-up Crew on the board"
										: undefined;
					return (
						<button
							key={action}
							type="button"
							disabled={disabled}
							title={title}
							onClick={() => onArm(action)}
							className={cn(
								"ft-panel-ink px-4 py-2 rounded-lg border text-sm font-bold transition-all",
								armed
									? "border-amber-400 bg-amber-400/10 text-amber-200"
									: !disabled
										? "border-white/15 text-white/70 hover:border-amber-400/60 hover:text-white cursor-pointer"
										: "border-white/5 text-white/20 cursor-not-allowed opacity-50",
							)}
						>
							{label} <span className="text-white/30">₱{cost}</span>
						</button>
					);
				})}
			</div>
			{armedAction === "strike" && (
				<p className="text-[9px] text-amber-300/70">
					Click their Crew to strike it, or their Boss if exposed.
				</p>
			)}
			{armedAction === "hide" && (
				<p className="text-[9px] text-amber-300/70">
					Click one of your face-up Crew to hide it.
				</p>
			)}
			{classActionUsedThisTurn && (
				<p className="text-[9px] text-white/25">
					Already used a class action this turn.
				</p>
			)}
			{!hasFaceDownCrew && (
				<p className="text-[9px] text-amber-300/50">
					No face-down Crew left — bluffed class actions are disabled above
					(nothing left to lose if called).
				</p>
			)}
		</div>
	);
}