import { useEffect, useRef, useState } from "react";
import { sendFaceturnAction } from "../../actions";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useActionLock } from "../../../../hooks/network/useActionLock";
import { resolvePlayMoveAction } from "../../lib/resolvePlayMoveAction";
import type { BoardTarget } from "../../hooks/boardTargetRegistry";
import { useArmedMove, useArmedMoveStore } from "../../hooks/useArmedMove";
import { useActiveMoveDiscardStore } from "../../hooks/useActiveMoveDiscard";
import { useTargetPickerSite } from "../../hooks/useTargetPickerSite";
import {
	strikeTargets,
	hideTargets,
	bossTarget,
} from "../../hooks/crewSlotPickerAdapters";
import {
	getEnemyPlayers,
	isPlayerExposed,
} from "../../lib/challengeEligibility";
import { PlayMoveSection } from "./PlayMoveSection";
import { BossCommandControl } from "./BossCommandControl";
import { useBossCommandPopoverStore } from "../../hooks/bossCommandPopoverStore";
import { ClassActionPopover } from "./ClassActionPopover";
import { useClassActionPopoverStore } from "../../hooks/classActionPopoverStore";
import { ReserveSwapPopover } from "./ReserveSwapPopover";
import { useReserveSwapPopoverStore } from "../../hooks/reserveSwapPopoverStore";

export function TurnActionBar() {
	const { ft, secret, myPlayer, playerId, isMyTurn } = useFaceturnState();
	const armed = useArmedMove();
	const disarm = useArmedMoveStore((s) => s.disarm);
	const closeBossCommandPopover = useBossCommandPopoverStore((s) => s.close);
	const closeClassActionPopover = useClassActionPopoverStore((s) => s.close);
	const closeReserveSwapPopover = useReserveSwapPopoverStore((s) => s.close);

	// one armed board-click pick at a time, opened via a popover confirm
	const [armedAction, setArmedAction] = useState<
		"strike" | "hide" | "face_turn" | null
	>(null);

	// clear armed pick on unmount; stores are module-level and outlive this component
	useEffect(() => disarm, [disarm]);
	useEffect(() => closeBossCommandPopover, [closeBossCommandPopover]);
	useEffect(() => closeClassActionPopover, [closeClassActionPopover]);
	useEffect(() => closeReserveSwapPopover, [closeReserveSwapPopover]);

	// clear armed pick when turn number changes, even if component stays mounted
	const lastSeenTurnNumber = useRef(ft?.turn?.turnNumber);
	if (lastSeenTurnNumber.current !== ft?.turn?.turnNumber) {
		lastSeenTurnNumber.current = ft?.turn?.turnNumber;
		disarm();
		setArmedAction(null);
		closeBossCommandPopover();
		closeClassActionPopover();
		closeReserveSwapPopover();
	}

	// lock keyed on turn number, cash, hand size; clears stale picks on rejection
	const lockToken = ft?.turn
		? `${ft.turn.turnNumber}:${myPlayer?.cash}:${myPlayer?.handSize}`
		: null;
	const { locked, runLocked } = useActionLock(
		lockToken,
		undefined,
		() => {
			setArmedAction(null);
			disarm();
			closeBossCommandPopover();
			closeClassActionPopover();
			closeReserveSwapPopover();
		},
		true,
	);

	// armed completion: fires final play_move when secondary pick lands
	const setOnComplete = useArmedMoveStore((s) => s.setOnComplete);
	const runLockedRef = useRef(runLocked);
	useEffect(() => {
		runLockedRef.current = runLocked;
	});
	const secretRef = useRef(secret);
	useEffect(() => {
		secretRef.current = secret;
	});
	useEffect(() => {
		setOnComplete((moveId, primaryTarget, secondaryPick) => {
			// re-check move still in hand before sending
			if (!secretRef.current?.hand.includes(moveId)) {
				disarm();
				return;
			}
			runLockedRef.current(() => {
				sendFaceturnAction(
					resolvePlayMoveAction(moveId, primaryTarget, secondaryPick),
				);
			});
		});
		return () => setOnComplete(null);
	}, [setOnComplete, disarm]);

	// register handler for discarding active move via drag
	const setOnDiscard = useActiveMoveDiscardStore((s) => s.setOnDiscard);
	useEffect(() => {
		setOnDiscard((slotIndex) => {
			runLockedRef.current(() => {
				sendFaceturnAction({ type: "discard_active_move", slotIndex });
			});
		});
		return () => setOnDiscard(null);
	}, [setOnDiscard]);

	// escape cancels armed pick
	useEffect(() => {
		if (!armed && !armedAction) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			disarm();
			setArmedAction(null);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [armed, armedAction, disarm]);

	function declareClassAction(
		action: "strike" | "collect" | "hide",
		targetPlayerId?: string,
		targetCrewSlot?: number,
	) {
		runLocked(() => {
			sendFaceturnAction({
				type: "declare_class_action",
				action,
				targetPlayerId,
				targetCrewSlot,
			});
		});
		setArmedAction(null);
	}

	function declareFaceTurn(targetPlayerId: string, targetCrewSlot?: number) {
		runLocked(() => {
			sendFaceturnAction({
				type: "use_face_turn",
				targetPlayerId,
				targetCrewSlot,
			});
		});
		setArmedAction(null);
	}

	// strike/face-turn target: every enemy's occupied crew slots plus their
	// boss if exposed, all in one picker session — clicking any lit-up card
	// across any opponent's board resolves both which opponent and which slot
	const enemyPlayers =
		ft && (armedAction === "strike" || armedAction === "face_turn")
			? getEnemyPlayers(ft, playerId)
			: [];
	useTargetPickerSite(
		enemyPlayers.length > 0
			? {
					mode: "single",
					eligible: enemyPlayers.flatMap((p) => [
						...strikeTargets(
							p.crewSlots.reduce<number[]>((slots, s) => {
								if (s.status !== "empty") slots.push(s.slotIndex);
								return slots;
							}, []),
							p.playerId,
						),
						...(isPlayerExposed(p) ? [bossTarget(p.playerId)] : []),
					]),
				}
			: null,
		(result) => {
			if (!result.target) return;
			const slotIndex =
				result.target.kind === "crew" ? result.target.slotIndex : undefined;
			if (armedAction === "face_turn") {
				declareFaceTurn(result.target.playerId, slotIndex);
			} else {
				declareClassAction("strike", result.target.playerId, slotIndex);
			}
		},
	);

	// hide target: own face-up crew
	useTargetPickerSite(
		armedAction === "hide" && myPlayer
			? {
					mode: "single",
					eligible: hideTargets(
						myPlayer.crewSlots.reduce<number[]>((slots, s) => {
							if (s.status === "face_up") slots.push(s.slotIndex);
							return slots;
						}, []),
						playerId,
					),
				}
			: null,
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			declareClassAction("hide", undefined, result.target.slotIndex);
		},
	);

	if (!ft || !myPlayer || !isMyTurn) return null;

	// direct play drop for moves without secondary target
	function playMoveFromDrop(moveId: string, primaryTarget: BoardTarget) {
		runLocked(() => {
			sendFaceturnAction(resolvePlayMoveAction(moveId, primaryTarget));
		});
	}

	return (
		<>
			<PlayMoveSection
				getPlayable={(id) => secret?.playableMoveIds.includes(id) ?? false}
				locked={locked}
				state={ft}
				playerId={playerId}
				onDropPlay={playMoveFromDrop}
				onArm={() => setArmedAction(null)}
			/>
			<ClassActionPopover
				armedElsewhere={armed !== null || armedAction !== null}
				locked={locked}
				runLocked={runLocked}
				onArm={(action) => {
					if (armed) disarm();
					closeBossCommandPopover();
					setArmedAction(action);
				}}
			/>
			<ReserveSwapPopover
				armedElsewhere={armed !== null || armedAction !== null}
				locked={locked}
				runLocked={runLocked}
			/>
			<BossCommandControl
				armedElsewhere={armed !== null || armedAction !== null}
				locked={locked}
				runLocked={runLocked}
				onArmFaceTurn={() => {
					if (armed) disarm();
					closeClassActionPopover();
					setArmedAction("face_turn");
				}}
			/>
		</>
	);
}
