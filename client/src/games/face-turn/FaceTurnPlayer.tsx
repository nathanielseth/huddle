import type { CSSProperties } from "react";
import { useFaceturnState } from "./hooks/useFaceturnState";
import { useFitBoardCardSize } from "./hooks/useFitBoardCardSize";
import { usePhaseSceneQueue } from "./hooks/usePhaseSceneQueue";
import { useExitPresence } from "./hooks/useExitPresence";
import { computeSceneKind, sceneKeyOf } from "./lib/phaseScenePredicate";
import { isChallengeEligible } from "./lib/challengeEligibility";
import { LogRow } from "./components/EventDrawer";
import { RailChat } from "./components/RailChat";
import { GameScreen } from "./components/shell/GameScreen";
import { BoardRecede } from "./components/scene/PhaseScene";
import { PlayerSceneContent } from "./components/scene/PhaseSceneContent";
import { PhaseTimer } from "./components/PhaseTimer";
import { MoveAnnouncer } from "./components/MoveAnnouncer";
import { PlayerBoard } from "./components/PlayerBoard";
import { MoveChainBar } from "./components/MoveChainBar";
import { TurnActionBar } from "./components/turn-action-bar/TurnActionBar";
import { ChallengeBar } from "./components/ChallengeBar";
import { Hand } from "./components/hand/Hand";
import { CardPreviewDock } from "./components/hand/CardPreviewDock";
import {
	useHandControllerStore,
	type HandController,
} from "./hooks/handControllerStore";
import type { BoardTarget } from "./hooks/boardTargetRegistry";
import { SectionTitle } from "./components/SectionTitle";
import { cn } from "../../lib/utils/cn";
import { makeMoveCostEstimator } from "./lib/cost";
import "./board.css";

// opponent boards mirrored above local board
function OpponentsRow() {
	const { ft, playerId, playerMap } = useFaceturnState();
	if (!ft) return null;
	const opponentIds = ft.turnOrder.filter((id) => id !== playerId);
	if (opponentIds.length === 0) return null;

	return (
		<div className="flex flex-col gap-4 px-2">
			{opponentIds.map((id) => {
				const p = ft.players[id];
				if (!p) return null;
				return (
					<div key={id} className="flex flex-col-reverse">
						<PlayerBoard
							player={p}
							name={playerMap[id]?.name ?? id}
							isActive={ft.turn?.activePlayerId === id}
						/>
					</div>
				);
			})}
		</div>
	);
}

function MyBoard() {
	const { ft, secret, myPlayer, playerId, playerMap } = useFaceturnState();
	if (!ft || !myPlayer) return null;
	return (
		<div className="px-2">
			<PlayerBoard
				player={myPlayer}
				name={playerMap[playerId]?.name ?? "You"}
				isActive={ft.turn?.activePlayerId === playerId}
				isMe
				knownCrewAssignments={secret?.crewAssignments}
			/>
		</div>
	);
}

const HAND_MAX_HEIGHT_PX = 240;

function BoardContent() {
	const { containerRef, contentRef, cardSize } = useFitBoardCardSize();

	return (
		<div
			ref={containerRef}
			className="ft-table-surface relative h-full min-h-0 overflow-hidden pointer-events-auto"
		>
			<div
				ref={contentRef}
				className="min-h-full flex flex-col items-center justify-center gap-3 py-3 m-auto"
				style={
					{
						paddingBottom: `${HAND_MAX_HEIGHT_PX}px`,
						"--card-vw-share": `${cardSize}px`,
					} as CSSProperties
				}
			>
				<OpponentsRow />
				<div className="w-full h-px bg-white/10 max-w-md" />
				<MyBoard />
			</div>
			<CardPreviewDock />
		</div>
	);
}

// single persistent hand, interactivity from store, fallback inert
function PersistentHand() {
	const { ft, secret, myPlayer } = useFaceturnState();
	const controller = useHandControllerStore(
		(s) => s.controller as HandController<BoardTarget> | null,
	);
	if (!ft || !secret || !myPlayer) return null;
	const getCost = makeMoveCostEstimator(
		secret,
		myPlayer.hasBluffedSuccessfully,
		myPlayer.moveBaseCostReduction,
	);
	return (
		<Hand<BoardTarget>
			cardIds={secret.hand}
			getCost={getCost}
			getPlayable={controller?.getPlayable}
			selectedId={controller?.selectedId ?? null}
			armedId={controller?.armedId ?? null}
			disabled={controller?.disabled}
			onSelect={controller?.onSelect}
			dragEnabled={controller?.dragEnabled ?? false}
			getTargetAt={controller?.getTargetAt}
			isValidTarget={controller?.isValidTarget}
			onDrop={controller?.onDrop}
		/>
	);
}

// inline action content; MoveChainBar also mounted in active_turn because chain replay can still be live
function TurnActions() {
	const { ft, myPlayer } = useFaceturnState();
	if (!ft || !myPlayer) return null;

	switch (ft.phase) {
		case "active_turn":
			return (
				<div className="flex flex-col gap-3">
					<TurnActionBar />
					<ChallengeBar />
					<MoveChainBar />
				</div>
			);
		case "move_chain_window":
			return <MoveChainBar />;
		default:
			return null;
	}
}

function RailTurnStatus() {
	const { ft, playerMap } = useFaceturnState();
	if (!ft) return null;

	const activeName = ft.turn
		? (playerMap[ft.turn.activePlayerId]?.name ?? ft.turn.activePlayerId)
		: null;

	return (
		<div className="flex items-center justify-between gap-2 px-4 py-3">
			<div className="flex items-center gap-2 min-w-0">
				{ft.turn && (
					<span className="ft-eyebrow text-sm text-white/80 tabular-nums shrink-0">
						Turn {ft.turn.turnNumber}
					</span>
				)}
				{activeName && ft.phase === "active_turn" && (
					<span className="ft-eyebrow text-xs text-white/45 truncate">
						<span className="text-white/80">{activeName}</span>'s turn
					</span>
				)}
			</div>
			<PhaseTimer />
		</div>
	);
}

// player logs as plain scroll, no collapse
function RailLogs() {
	const { ft, playerMap } = useFaceturnState();
	const log = ft?.log ?? [];
	if (log.length === 0) {
		return (
			<div className="flex flex-col gap-1 px-4">
				<SectionTitle>Logs</SectionTitle>
				<p className="text-xs text-white/25 italic">Nothing yet.</p>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-1 px-4">
			<SectionTitle>Logs</SectionTitle>
			<div
				className="flex flex-col gap-1 max-h-40 lg:max-h-56 overflow-y-auto pr-1"
				style={{ touchAction: "pan-y" }}
			>
				{[...log].reverse().map((entry, i) => (
					<LogRow
						key={entry.seq}
						entry={entry}
						playerMap={playerMap}
						dim={i !== 0}
						showBreakdown={true}
					/>
				))}
			</div>
		</div>
	);
}

function RailContent() {
	return (
		<div
			className={cn("ft-panel-ink ft-rail", "flex flex-col overflow-hidden")}
		>
			<div
				className="flex flex-col gap-3 overflow-y-auto min-h-0"
				style={{ touchAction: "pan-y" }}
			>
				<RailTurnStatus />
				<RailLogs />
			</div>
			<div className="flex-1 min-h-0" />
			<div className="px-4 pb-4 shrink-0">
				<TurnActions />
			</div>
			<RailChat />
		</div>
	);
}

function HudContent() {
	return (
		<div className="flex flex-col h-full">
			<div className="pointer-events-auto">
				<PersistentHand />
			</div>
		</div>
	);
}

export function FaceTurnPlayer() {
	const { ft, playerId, canChallenge } = useFaceturnState();

	const challengeEligible = ft
		? isChallengeEligible(ft, playerId, canChallenge)
		: false;
	const sceneKind = computeSceneKind(ft, playerId, challengeEligible);
	const { visible, onExited } = usePhaseSceneQueue(sceneKind, sceneKeyOf);
	const { list: sceneList } = useExitPresence(visible, sceneKeyOf, onExited);

	if (!ft) {
		return (
			<div className="flex items-center justify-center h-dvh ft-app-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	return (
		<div
			className="relative w-full ft-app-bg overflow-hidden"
			style={{ height: "100dvh" }}
		>
			<BoardRecede
				active={sceneKind !== null}
				intensity={sceneKind?.kind === "challenge" ? "light" : "full"}
			>
				<GameScreen
					board={<BoardContent />}
					hud={<HudContent />}
					rail={<RailContent />}
				/>
			</BoardRecede>
			{sceneList.map((entry) => (
				<PlayerSceneContent
					key={entry.key}
					sceneKind={entry.value}
					isExiting={entry.isExiting}
					panelRef={entry.panelRef}
				/>
			))}
			<MoveAnnouncer />
		</div>
	);
}