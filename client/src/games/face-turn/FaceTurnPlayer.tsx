import { Fragment, type CSSProperties } from "react";
import { useFaceturnState } from "./hooks/useFaceturnState";
import { useFitBoardCardSize } from "./hooks/useFitBoardCardSize";
import { usePhaseSceneQueue } from "./hooks/usePhaseSceneQueue";
import { useExitPresence } from "./hooks/useExitPresence";
import { computeSceneKind, sceneKeyOf } from "./lib/phaseScenePredicate";
import { isChallengeEligible } from "./lib/challengeEligibility";
import { LogRow } from "./components/EventDrawer";
import { RailChat } from "./components/RailChat";
import { GameScreen } from "./components/shell/GameScreen";
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

const MAX_PER_ROW = 3;

function useTableRows(): string[][] {
	const { ft, playerId } = useFaceturnState();
	if (!ft) return [];

	const order =
		ft.turnOrder.length > 0 ? ft.turnOrder : Object.keys(ft.players);
	const orderIndex = new Map(order.map((id, i) => [id, i]));
	const byTurnOrder = (a: string, b: string) =>
		(orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0);

	if (ft.mode === "teams") {
		const myTeam = ft.teams.find((team) => team.includes(playerId));
		const otherTeams = ft.teams.filter((team) => team !== myTeam);
		const allyRow = [
			playerId,
			...(myTeam ?? []).filter((id) => id !== playerId).sort(byTurnOrder),
		];
		const enemyRows = otherTeams.map((team) => [...team].sort(byTurnOrder));
		return [...enemyRows, allyRow];
	}

	if (ft.mode === "duel") {
		const enemyId = order.find((id) => id !== playerId);
		return enemyId ? [[enemyId], [playerId]] : [[playerId]];
	}

	// ffa: chunk everyone into rows of at most 3, in turn order, then move
	// whichever row has you to the end so you're always on the bottom
	const others = order.filter((id) => id !== playerId);
	const rest = [...others, playerId];
	const rows: string[][] = [];
	for (let i = 0; i < rest.length; i += MAX_PER_ROW) {
		rows.push(rest.slice(i, i + MAX_PER_ROW));
	}
	const myRowIndex = rows.findIndex((row) => row.includes(playerId));
	if (myRowIndex !== -1 && myRowIndex !== rows.length - 1) {
		const [myRow] = rows.splice(myRowIndex, 1);
		rows.push(myRow);
	}
	return rows;
}

// horizontal row of boards, always full size — no compact/mini treatment
function TableRow({ playerIds }: { playerIds: string[] }) {
	const { ft, secret, playerId, playerMap } = useFaceturnState();
	if (!ft) return null;

	return (
		<div className="flex flex-wrap justify-center gap-3 px-2 w-full">
			{playerIds.map((id) => {
				const p = ft.players[id];
				if (!p) return null;
				const mine = id === playerId;
				return (
					<PlayerBoard
						key={id}
						player={p}
						name={playerMap[id]?.name ?? (mine ? "You" : id)}
						isActive={ft.turn?.activePlayerId === id}
						isMe={mine}
						knownCrewAssignments={mine ? secret?.crewAssignments : undefined}
					/>
				);
			})}
		</div>
	);
}

const HAND_MAX_HEIGHT_PX = 240;

function BoardContent() {
	const { containerRef, contentRef, cardSize } = useFitBoardCardSize();
	const rows = useTableRows();

	return (
		<div
			ref={containerRef}
			className="ft-table-surface relative h-full min-h-0 overflow-hidden pointer-events-auto"
		>
			<div
				ref={contentRef}
				className="min-h-full flex flex-col items-stretch justify-center gap-3 py-3 m-auto"
				style={
					{
						paddingBottom: `${HAND_MAX_HEIGHT_PX}px`,
						"--card-vw-share": `${cardSize}px`,
					} as CSSProperties
				}
			>
				{rows.map((row, i) => (
					<Fragment key={row.join(",")}>
						<TableRow playerIds={row} />
						{i === rows.length - 2 && (
							<div className="w-full h-px bg-white/10 max-w-md self-center" />
						)}
					</Fragment>
				))}
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
				className="flex flex-col gap-1 max-h-40 lg:max-h-56 overflow-y-auto ft-scroll pr-1"
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
				className="flex flex-col gap-3 overflow-y-auto ft-scroll min-h-0"
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
			<GameScreen
				board={<BoardContent />}
				hud={<HudContent />}
				rail={<RailContent />}
				recedeActive={sceneKind !== null}
				recedeIntensity={sceneKind?.kind === "challenge" ? "light" : "full"}
			/>
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