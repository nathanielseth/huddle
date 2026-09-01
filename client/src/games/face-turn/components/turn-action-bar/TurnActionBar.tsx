// active turn bar: move play, class actions, boss, face turn, end turn. move targeting is drag and drop only.
import { useEffect, useRef, useState } from "react";
import { getCrewDisplay } from "@shared/games/face-turn/card-display";
import type { CrewClass } from "@shared/games/face-turn/types";
import { sendFaceturnAction } from "../../actions";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useActionLock } from "../../../../hooks/network/useActionLock";
import { makeMoveCostEstimator } from "../../lib/cost";
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
import { isPlayerExposed } from "../../lib/challengeEligibility";
import { CashChip } from "../BoardPrimitives";
import { SectionTitle } from "../SectionTitle";
import { TargetPicker } from "./TargetPicker";
import { ClassActionRow } from "./ClassActionRow";
import { PlayMoveSection } from "./PlayMoveSection";
import { BossCommandControl } from "./BossCommandControl";
import { useBossCommandPopoverStore } from "../../hooks/bossCommandPopoverStore";
import { OtherActionsRow } from "./OtherActionsRow";

export function TurnActionBar() {
	const { ft, secret, myPlayer, playerId, players, isMyTurn } =
		useFaceturnState();
	const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
	const [targetPlayerId, setTargetPlayerId] = useState<string | null>(null);
	const armed = useArmedMove();
	const disarm = useArmedMoveStore((s) => s.disarm);
	const closeBossCommandPopover = useBossCommandPopoverStore((s) => s.close);

	// one armed board-click pick at a time
	const [armedAction, setArmedAction] = useState<
		"strike" | "hide" | "face_turn" | null
	>(null);

	// clear armed pick on unmount; store is module-level and outlives this component
	useEffect(() => disarm, [disarm]);
	useEffect(() => closeBossCommandPopover, [closeBossCommandPopover]);

	// clear armed pick when turn number changes, even if component stays mounted
	const lastSeenTurnNumber = useRef(ft?.turn?.turnNumber);
	if (lastSeenTurnNumber.current !== ft?.turn?.turnNumber) {
		lastSeenTurnNumber.current = ft?.turn?.turnNumber;
		disarm();
		setArmedAction(null);
		closeBossCommandPopover();
	}

	// lock keyed on turn number, cash, hand size; clears stale picks on rejection
	const lockToken = ft?.turn
		? `${ft.turn.turnNumber}:${myPlayer?.cash}:${myPlayer?.handSize}`
		: null;
	const { locked, runLocked } = useActionLock(
		lockToken,
		undefined,
		() => {
			setSelectedMoveId(null);
			setTargetPlayerId(null);
			setArmedAction(null);
			disarm();
			closeBossCommandPopover();
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
			setSelectedMoveId(null);
			setTargetPlayerId(null);
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

	const otherPlayers = players.filter((p) => p.id !== playerId);
	const effectiveTarget =
		otherPlayers.length > 1
			? targetPlayerId
			: (targetPlayerId ?? otherPlayers[0]?.id ?? null);
	const needsExplicitTarget =
		otherPlayers.length > 1 && effectiveTarget === null;

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

	function declareFaceTurn(targetCrewSlot?: number) {
		if (!effectiveTarget) return;
		runLocked(() => {
			sendFaceturnAction({
				type: "use_face_turn",
				targetPlayerId: effectiveTarget,
				targetCrewSlot,
			});
		});
		setArmedAction(null);
	}

	// strike/face-turn target: enemy's occupied crew slots plus boss if exposed —
	// both are BoardTargets, so one picker session covers the whole eligible set
	const enemyTargetPlayer =
		(armedAction === "strike" || armedAction === "face_turn") && effectiveTarget
			? (ft?.players[effectiveTarget] ?? null)
			: null;
	useTargetPickerSite(
		enemyTargetPlayer
			? {
					mode: "single",
					eligible: [
						...strikeTargets(
							enemyTargetPlayer.crewSlots.reduce<number[]>((slots, s) => {
								if (s.status !== "empty") slots.push(s.slotIndex);
								return slots;
							}, []),
							effectiveTarget!,
						),
						...(isPlayerExposed(enemyTargetPlayer)
							? [bossTarget(enemyTargetPlayer.playerId)]
							: []),
					],
				}
			: null,
		(result) => {
			if (!result.target) return;
			const slotIndex =
				result.target.kind === "crew" ? result.target.slotIndex : undefined;
			if (armedAction === "face_turn") {
				declareFaceTurn(slotIndex);
			} else {
				declareClassAction("strike", effectiveTarget!, slotIndex);
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

	const getCost = makeMoveCostEstimator(
		secret,
		myPlayer.hasBluffedSuccessfully,
		myPlayer.moveBaseCostReduction,
	);

	const hasFaceDownCrew = myPlayer.crewSlots.some(
		(s) => s.status === "face_down",
	);
	function hasClassLive(cls: CrewClass): boolean {
		return myPlayer!.crewSlots.some((slot, idx) => {
			if (slot.status === "face_up") {
				return slot.crewClass === cls || slot.extraClasses.includes(cls);
			}
			if (slot.status === "face_down") {
				const realId = secret?.crewAssignments[idx];
				return realId ? getCrewDisplay(realId).class === cls : false;
			}
			return false;
		});
	}

	// direct play drop for moves without secondary target
	function playMoveFromDrop(moveId: string, primaryTarget: BoardTarget) {
		runLocked(() => {
			sendFaceturnAction(resolvePlayMoveAction(moveId, primaryTarget));
		});
		setSelectedMoveId(null);
		setTargetPlayerId(null);
	}

	// sell drop: dealer passive
	function sellMoveFromDrop(moveId: string) {
		runLocked(() => {
			sendFaceturnAction({ type: "sell_move", moveId });
		});
	}

	// collect immediate, strike/hide arm; clicking same again cancels
	function onArmClassAction(action: "strike" | "collect" | "hide") {
		if (action === "collect") {
			declareClassAction("collect");
			return;
		}
		if (action === "strike" && needsExplicitTarget) return;
		if (armed) disarm();
		closeBossCommandPopover();
		setArmedAction((current) => (current === action ? null : action));
	}

	return (
		<div className="ft-panel-ink relative flex flex-col gap-3 rounded-2xl border border-white/15 px-5 py-4 pt-4.5 overflow-hidden">
			<div className="absolute top-0 left-0 right-0 h-0.75 bg-amber-400" />
			<div className="flex items-center justify-between">
				<p className="ft-eyebrow text-[10px] text-amber-300/80">Your turn</p>
				<CashChip amount={myPlayer.cash} />
			</div>

			{otherPlayers.length > 1 && (
				<div className="flex flex-col gap-1">
					<SectionTitle>
						Target{needsExplicitTarget ? " (pick one)" : ""}
					</SectionTitle>
					<TargetPicker
						players={otherPlayers}
						selectedId={effectiveTarget}
						onSelect={setTargetPlayerId}
					/>
				</div>
			)}

			<ClassActionRow
				cash={myPlayer.cash}
				classActionCostReduction={myPlayer.classActionCostReduction}
				hasFaceDownCrew={hasFaceDownCrew}
				hasClassLive={hasClassLive}
				classActionUsedThisTurn={Boolean(ft.turn?.classActionUsedThisTurn)}
				needsExplicitTarget={needsExplicitTarget}
				armedAction={armedAction === "face_turn" ? null : armedAction}
				locked={locked}
				onArm={onArmClassAction}
			/>

			<PlayMoveSection
				getCost={getCost}
				getPlayable={(id) => secret?.playableMoveIds.includes(id) ?? false}
				selectedMoveId={selectedMoveId}
				onSelectMove={(id) => {
					const next = id === selectedMoveId ? null : id;
					setSelectedMoveId(next);
					setTargetPlayerId(null);
					if (armed && armed.moveId !== next) disarm();
					if (armedAction) setArmedAction(null);
				}}
				playerId={playerId}
				state={ft}
				locked={locked}
				cash={myPlayer.cash}
				hasSellCards={myPlayer.hasSellCards}
				onDropPlay={playMoveFromDrop}
				onDropSell={sellMoveFromDrop}
				onArm={() => setArmedAction(null)}
			/>

			<div className="flex flex-col gap-1">
				<SectionTitle>Other actions</SectionTitle>
				{!myPlayer.boss.commandUsed && (
					<p className="text-xs text-white/40">
						Click your Boss to use its command.
					</p>
				)}
				{/* keyed on target so razor/dealer picks reset */}
				<BossCommandControl
					key={effectiveTarget ?? "no-target"}
					effectiveTarget={effectiveTarget}
					armedElsewhere={armedAction !== null}
					locked={locked}
					runLocked={runLocked}
				/>
				<OtherActionsRow
					cash={myPlayer.cash}
					effectiveTarget={effectiveTarget}
					armed={armedAction === "face_turn"}
					locked={locked}
					onArmFaceTurn={() => {
						if (!effectiveTarget) return;
						if (armed) disarm();
						closeBossCommandPopover();
						setArmedAction((current) =>
							current === "face_turn" ? null : "face_turn",
						);
					}}
					runLocked={runLocked}
				/>
			</div>
		</div>
	);
}