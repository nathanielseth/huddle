import "../../board.css";
import { useEffect, useReducer, useRef } from "react";
import { cn } from "../../../../lib/utils/cn";
import { getBossDisplay } from "@shared/games/face-turn/card-display";
import { sendFaceturnAction } from "../../actions";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useBossCommandPopoverStore } from "../../hooks/bossCommandPopoverStore";
import { TargetPicker } from "./TargetPicker";
import { PopoverShell } from "./PopoverShell";
import { useTargetPickerSite } from "../../hooks/useTargetPickerSite";
import {
	razorTargets,
	dealerTargets,
} from "../../hooks/crewSlotPickerAdapters";
import { BOSS_FACE_TURN_COST } from "../../lib/cost";

type BossCommandFormState = {
	targetId: string | null;
	confirmed: boolean;
};

type BossCommandFormAction =
	| { type: "set_target"; targetId: string | null }
	| { type: "confirm" }
	| { type: "reset"; targetId: string | null };

function bossCommandFormReducer(
	state: BossCommandFormState,
	action: BossCommandFormAction,
): BossCommandFormState {
	switch (action.type) {
		case "set_target":
			return { ...state, targetId: action.targetId };
		case "confirm":
			return { ...state, confirmed: true };
		case "reset":
			return { targetId: action.targetId, confirmed: false };
		default: {
			const _exhaustive: never = action;
			return _exhaustive;
		}
	}
}

export function BossCommandControl({
	armedElsewhere,
	locked,
	runLocked,
	onArmFaceTurn,
}: {
	// true while a strike/hide/face-turn pick is already armed elsewhere
	armedElsewhere: boolean;
	locked: boolean;
	runLocked: (fn: () => void) => void;
	// arms the shared enemy-target picker (crew or exposed boss) for Face Turn
	onArmFaceTurn: () => void;
}) {
	const { myPlayer, players, playerId, secret } = useFaceturnState();
	const openForPlayerId = useBossCommandPopoverStore((s) => s.openForPlayerId);
	const anchorEl = useBossCommandPopoverStore((s) => s.anchorEl);
	const closePopover = useBossCommandPopoverStore((s) => s.close);
	const isOpen = openForPlayerId === playerId && anchorEl !== null;

	const otherPlayers = players.filter((p) => p.id !== playerId);
	const defaultTargetId = otherPlayers.length === 1 ? otherPlayers[0].id : null;

	const [formState, dispatch] = useReducer(bossCommandFormReducer, {
		targetId: defaultTargetId,
		confirmed: false,
	});
	const { targetId, confirmed } = formState;

	// hooks must run unconditionally; null session/closed popover is a no-op
	const bossId = myPlayer ? getBossDisplay(myPlayer.boss.id).id : null;
	const commandDisabled = myPlayer ? myPlayer.boss.commandUsed || locked : true;
	const bossDisplay = myPlayer ? getBossDisplay(myPlayer.boss.id) : null;
	const canFaceTurn = Boolean(
		myPlayer && myPlayer.cash >= BOSS_FACE_TURN_COST && !locked,
	);

	// once confirmed, the follow-up targeting (razor/dealer picker, or the
	// shared enemy-target picker for plain bosses) takes over from the popover
	function confirm() {
		dispatch({ type: "confirm" });
		closePopover();
	}

	// re-opening the popover (e.g. clicking the boss again after a dead-end
	// confirm) must clear stale confirmed/target state from the last attempt
	const wasOpenRef = useRef(isOpen);
	useEffect(() => {
		if (isOpen && !wasOpenRef.current) {
			dispatch({ type: "reset", targetId: defaultTargetId });
		}
		wasOpenRef.current = isOpen;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	// closing from outside (e.g. Escape) while unconfirmed just dismisses
	function dismiss() {
		if (!confirmed) closePopover();
	}

	type SlotWithIndex = NonNullable<typeof myPlayer>["crewSlots"][number] & {
		i: number;
	};
	const dealerFaceUpSlots: SlotWithIndex[] = myPlayer
		? myPlayer.crewSlots.reduce<SlotWithIndex[]>((acc, s, i) => {
				if (s.status === "face_up") acc.push({ ...s, i });
				return acc;
			}, [])
		: [];

	// server has no precomputed eligibleSlots for boss commands, session opens
	// only after the popover is confirmed and (for razor) a target is chosen
	useTargetPickerSite(
		bossId === "the-razor" &&
			confirmed &&
			!commandDisabled &&
			!armedElsewhere &&
			targetId
			? {
					mode: "single",
					eligible: razorTargets(targetId),
					classGuess: true,
				}
			: null,
		(result) => {
			if (
				!result.target ||
				result.target.kind !== "crew" ||
				!result.guessClass ||
				!targetId
			)
				return;
			const { target, guessClass } = result;
			runLocked(() => {
				sendFaceturnAction({
					type: "use_boss_command",
					targetPlayerId: target.playerId,
					targetCrewSlot: target.slotIndex,
					guessClass,
				});
			});
		},
	);

	useTargetPickerSite(
		bossId === "the-dealer" &&
			confirmed &&
			!commandDisabled &&
			!armedElsewhere &&
			dealerFaceUpSlots.length > 0
			? {
					mode: "single",
					eligible: dealerTargets(
						dealerFaceUpSlots.map((s) => s.i),
						playerId,
					),
				}
			: null,
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			const { target } = result;
			runLocked(() => {
				sendFaceturnAction({
					type: "use_boss_command",
					targetAllySlot: target.slotIndex,
				});
			});
		},
	);

	if (!myPlayer || !bossDisplay) return null;
	if (!isOpen || confirmed) return null;

	function confirmPlainBoss() {
		confirm();
		runLocked(() => {
			sendFaceturnAction({
				type: "use_boss_command",
				targetPlayerId: targetId ?? undefined,
			});
		});
	}

	function fireFaceTurn() {
		closePopover();
		onArmFaceTurn();
	}

	const faceTurnButton = (
		<button
			type="button"
			disabled={!canFaceTurn}
			title={
				!canFaceTurn
					? `Need ₱${BOSS_FACE_TURN_COST}, you have ₱${myPlayer.cash}`
					: "Then click an enemy Crew, or their Boss if exposed."
			}
			onClick={fireFaceTurn}
			className={cn(
				"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
				!canFaceTurn
					? "border-white/10 text-white/20 cursor-not-allowed"
					: "border-red-400/60 text-red-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(248,113,113,0.25)] hover:bg-red-400/10",
			)}
		>
			Face Turn <span className="text-white/30">₱{BOSS_FACE_TURN_COST}</span>
		</button>
	);

	if (bossId === "the-razor") {
		return (
			<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
				<span className="text-[10px] uppercase tracking-widest text-white/30">
					{bossDisplay.name} command
				</span>
				<p className="text-xs text-white/60">
					{bossDisplay.effectText.command}
				</p>
				{otherPlayers.length > 1 && (
					<TargetPicker
						players={otherPlayers}
						selectedId={targetId}
						onSelect={(id) => dispatch({ type: "set_target", targetId: id })}
						accent="violet"
						dense
					/>
				)}
				<button
					type="button"
					disabled={commandDisabled || !targetId}
					onClick={confirm}
					className={cn(
						"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
						commandDisabled || !targetId
							? "border-white/10 text-white/20 cursor-not-allowed"
							: "border-violet-400/60 text-violet-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]",
					)}
				>
					Use command
				</button>
				<p className="text-[11px] text-white/40">
					{targetId
						? "Then click one of their Crew, then choose a class."
						: "Pick an enemy target first."}
				</p>
				<div className="h-px bg-white/10" />
				{faceTurnButton}
			</PopoverShell>
		);
	}

	if (bossId === "the-dealer") {
		const hasReserve = Boolean(secret && secret.reserveCrewId !== null);
		const hasSwapTarget = dealerFaceUpSlots.length > 0;
		const dealerDisabled = commandDisabled || !hasReserve || !hasSwapTarget;
		return (
			<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
				<span className="text-[10px] uppercase tracking-widest text-white/30">
					{bossDisplay.name} command
				</span>
				<p className="text-xs text-white/60">
					{bossDisplay.effectText.command}
				</p>
				<button
					type="button"
					disabled={dealerDisabled}
					onClick={confirm}
					className={cn(
						"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
						dealerDisabled
							? "border-white/10 text-white/20 cursor-not-allowed"
							: "border-violet-400/60 text-violet-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]",
					)}
				>
					Use command
				</button>
				<p className="text-[11px] text-white/40">
					{!hasReserve
						? "You have no reserved Crew to swap in."
						: !hasSwapTarget
							? "You need a face-up Crew on your board to swap out."
							: "Then click a face-up Crew on your board to swap with your reserve."}
				</p>
				<div className="h-px bg-white/10" />
				{faceTurnButton}
			</PopoverShell>
		);
	}

	return (
		<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
			<span className="text-[10px] uppercase tracking-widest text-white/30">
				{bossDisplay.name} command
			</span>
			<p className="text-xs text-white/60">{bossDisplay.effectText.command}</p>
			{otherPlayers.length > 1 && (
				<TargetPicker
					players={otherPlayers}
					selectedId={targetId}
					onSelect={(id) => dispatch({ type: "set_target", targetId: id })}
					dense
				/>
			)}
			<button
				type="button"
				disabled={commandDisabled || (otherPlayers.length > 1 && !targetId)}
				onClick={confirmPlainBoss}
				className={cn(
					"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
					commandDisabled || (otherPlayers.length > 1 && !targetId)
						? "border-white/10 text-white/20 cursor-not-allowed"
						: "border-violet-400/60 text-violet-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]",
				)}
			>
				Use command
			</button>
			<div className="h-px bg-white/10" />
			{faceTurnButton}
		</PopoverShell>
	);
}
