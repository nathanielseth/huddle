import "../../board.css";
import { cn } from "../../../../lib/utils/cn";
import { getCrewDisplay } from "@shared/games/face-turn/card-display";
import { sendFaceturnAction } from "../../actions";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useReserveSwapPopoverStore } from "../../hooks/reserveSwapPopoverStore";
import { PopoverShell } from "./PopoverShell";

export function ReserveSwapPopover({
	armedElsewhere,
	locked,
	runLocked,
}: {
	// true while a strike/hide/face-turn pick is already armed elsewhere,
	// so this popover shouldn't itself be actionable
	armedElsewhere: boolean;
	locked: boolean;
	runLocked: (fn: () => void) => void;
}) {
	const { myPlayer, secret } = useFaceturnState();
	const openForSlotIndex = useReserveSwapPopoverStore(
		(s) => s.openForSlotIndex,
	);
	const anchorEl = useReserveSwapPopoverStore((s) => s.anchorEl);
	const closePopover = useReserveSwapPopoverStore((s) => s.close);
	const isOpen = openForSlotIndex !== null && anchorEl !== null;

	if (!isOpen || !myPlayer || !secret) return null;

	const slotIndex = openForSlotIndex;
	const slot = myPlayer.crewSlots[slotIndex];
	// popover only ever opens for a face-up slot; guard against stale state
	if (!slot || slot.status !== "face_up") return null;

	const reserveCrewIds = secret.reserveCrewIds;
	const disabled = locked || armedElsewhere;

	function dismiss() {
		closePopover();
	}

	function swapIn(reserveSlot: number) {
		closePopover();
		runLocked(() => {
			sendFaceturnAction({
				type: "swap_in_reserve_crew",
				targetAllySlot: slotIndex,
				reserveSlot,
			});
		});
	}

	return (
		<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
			<span className="text-[10px] uppercase tracking-widest text-white/30">
				Swap in reserve
			</span>
			<div className="flex flex-col gap-1.5">
				{reserveCrewIds.map((crewId, i) => {
					if (!crewId) return null;
					const display = getCrewDisplay(crewId);
					return (
						<button
							key={i}
							type="button"
							disabled={disabled}
							title="Swaps in face-down, free"
							onClick={() => swapIn(i)}
							className={cn(
								"flex items-center justify-between px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
								disabled
									? "border-white/10 text-white/20 cursor-not-allowed"
									: "border-violet-400/60 text-violet-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)] hover:bg-violet-400/10",
							)}
						>
							<span>{display.name}</span>
							<span className="text-white/30">₱0</span>
						</button>
					);
				})}
			</div>
			<p className="text-[10px] text-white/25">
				Enters face-down. You can't get this Crew back once replaced.
			</p>
		</PopoverShell>
	);
}