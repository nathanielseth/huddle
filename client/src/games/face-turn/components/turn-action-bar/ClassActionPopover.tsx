import "../../board.css";
import { cn } from "../../../../lib/utils/cn";
import type { CrewClass } from "@shared/games/face-turn/types";
import { getCrewDisplay } from "@shared/games/face-turn/card-display";
import { sendFaceturnAction } from "../../actions";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useClassActionPopoverStore } from "../../hooks/classActionPopoverStore";
import { PopoverShell } from "./PopoverShell";
import { makeClassActionCostEstimator } from "../../lib/cost";

type ClassAction = "strike" | "collect" | "hide";

const CLASS_ACTIONS: {
	action: ClassAction;
	label: string;
	needsClass: CrewClass;
	hint: string;
}[] = [
	{
		action: "collect",
		label: "Collect",
		needsClass: "collector",
		hint: "Collect cash immediately.",
	},
	{
		action: "strike",
		label: "Strike",
		needsClass: "striker",
		hint: "Then click an enemy Crew, or their Boss if exposed.",
	},
	{
		action: "hide",
		label: "Hide",
		needsClass: "hider",
		hint: "Then click one of your face-up Crew to hide it.",
	},
];

export function ClassActionPopover({
	armedElsewhere,
	locked,
	runLocked,
	onArm,
}: {
	// true while a strike/hide/face-turn pick is already armed elsewhere,
	// so this popover shouldn't itself be openable/actionable
	armedElsewhere: boolean;
	locked: boolean;
	runLocked: (fn: () => void) => void;
	// called when Strike/Hide is confirmed, so the caller can open the
	// matching board target-picker session
	onArm: (action: "strike" | "hide") => void;
}) {
	const { myPlayer, secret, ft } = useFaceturnState();
	const openForSlotIndex = useClassActionPopoverStore(
		(s) => s.openForSlotIndex,
	);
	const anchorEl = useClassActionPopoverStore((s) => s.anchorEl);
	const closePopover = useClassActionPopoverStore((s) => s.close);
	const isOpen = openForSlotIndex !== null && anchorEl !== null;

	if (!isOpen || !myPlayer || !ft) return null;

	const slotIndex = openForSlotIndex;
	const slot = myPlayer.crewSlots[slotIndex];
	// popover only ever opens for a face-down slot; guard against stale state
	// (e.g. the crew got turned face-up by something else while open)
	if (!slot || slot.status !== "face_down") return null;

	const hasFaceDownCrew = myPlayer.crewSlots.some(
		(s) => s.status === "face_down",
	);
	function hasClassLive(cls: CrewClass): boolean {
		return myPlayer!.crewSlots.some((s, idx) => {
			if (s.status === "face_up") {
				return s.crewClass === cls || s.extraClasses.includes(cls);
			}
			if (s.status === "face_down") {
				const realId = secret?.crewAssignments[idx];
				return realId ? getCrewDisplay(realId).class === cls : false;
			}
			return false;
		});
	}

	const getCost = makeClassActionCostEstimator(
		myPlayer.classActionCostReduction,
	);
	const classActionUsedThisTurn = Boolean(ft.turn?.classActionUsedThisTurn);
	const disabledBase = locked || armedElsewhere || classActionUsedThisTurn;

	function dismiss() {
		closePopover();
	}

	function runAction(action: ClassAction) {
		closePopover();
		if (action === "collect") {
			runLocked(() => {
				sendFaceturnAction({ type: "declare_class_action", action: "collect" });
			});
			return;
		}
		onArm(action);
	}

	return (
		<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
			<span className="text-[10px] uppercase tracking-widest text-white/30">
				Class action
			</span>
			<div className="flex flex-col gap-1.5">
				{CLASS_ACTIONS.map(({ action, label, needsClass, hint }) => {
					const cost = getCost(action);
					const affordable = myPlayer.cash >= cost;
					const wouldBeBluffing = !hasClassLive(needsClass);
					const bluffBlocked = wouldBeBluffing && !hasFaceDownCrew;
					const disabled = disabledBase || !affordable || bluffBlocked;
					const title = !affordable
						? `Need ₱${cost}, you have ₱${myPlayer.cash}`
						: bluffBlocked
							? "No face-down Crew left to bluff with"
							: classActionUsedThisTurn
								? "Already used a class action this turn"
								: hint;
					return (
						<button
							key={action}
							type="button"
							disabled={disabled}
							title={title}
							onClick={() => runAction(action)}
							className={cn(
								"flex items-center justify-between px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
								disabled
									? "border-white/10 text-white/20 cursor-not-allowed"
									: "border-amber-400/60 text-amber-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)] hover:bg-amber-400/10",
							)}
						>
							<span>{label}</span>
							<span className="text-white/30">₱{cost}</span>
						</button>
					);
				})}
			</div>
			{classActionUsedThisTurn && (
				<p className="text-[10px] text-white/25">
					Already used a class action this turn.
				</p>
			)}
			{!hasFaceDownCrew && (
				<p className="text-[10px] text-amber-300/50">
					No face-down Crew left — bluffed actions are disabled above.
				</p>
			)}
		</PopoverShell>
	);
}
