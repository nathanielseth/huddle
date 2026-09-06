import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { useFaceturnState } from "./hooks/useFaceturnState";
import { useFitBoardCardSize } from "./hooks/useFitBoardCardSize";
import { useIsDesktopRail } from "./hooks/useIsDesktopRail";
import { usePhaseSceneQueue } from "./hooks/usePhaseSceneQueue";
import { useExitPresence } from "./hooks/useExitPresence";
import {
	computeSceneKind,
	sceneKeyOf,
	sceneRecedeIntensity,
} from "./lib/phaseScenePredicate";
import { isChallengeEligible } from "./lib/challengeEligibility";
import { LogFeed } from "./components/EventDrawer";
import { RailChat, ChatFeed } from "./components/RailChat";
import { GameScreen } from "./components/shell/GameScreen";
import { PlayerSceneContent } from "./components/scene/PhaseSceneContent";
import { RailHeader } from "./components/RailHeader";
import { EventAnnouncer } from "./components/EventAnnouncer";
import { PlayerBoard } from "./components/PlayerBoard";
import { RailMoveArea } from "./components/RailMoveArea";
import { PassButton } from "./components/PassButton";
import { TurnActionBar } from "./components/turn-action-bar/TurnActionBar";
import { ChainMoveSection } from "./components/turn-action-bar/ChainMoveSection";
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

// desktop row grouping: enemies top, allies bottom; ffa chunks into rows and moves mine to bottom
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

	// ffa: chunk into rows of 3, then move my row to bottom
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

// single persistent hand, interactivity from store, inert fallback
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

// headless controllers only; RailMoveArea is always live and renders drop zone, chain stack, armed preview, pass/end
function TurnActions() {
	const { ft, myPlayer } = useFaceturnState();
	if (!ft || !myPlayer) return null;

	switch (ft.phase) {
		case "active_turn":
			return <TurnActionBar />;
		case "move_chain_window":
			return <ChainMoveSection />;
		default:
			return null;
	}
}

const LOGS_HEIGHT_PX = 176;

function RailLogs() {
	const { ft, playerMap } = useFaceturnState();
	const log = ft?.log ?? [];

	return (
		<div className="hidden lg:flex shrink-0 flex-col gap-1 px-4 py-3 border-b border-white/10">
			<SectionTitle>Logs</SectionTitle>
			<LogFeed
				log={log}
				playerMap={playerMap}
				style={{ height: LOGS_HEIGHT_PX }}
			/>
		</div>
	);
}

function RailContent() {
	return (
		<div className={cn("ft-panel-ink ft-rail", "flex flex-col")}>
			<RailHeader />
			<RailLogs />
			<TurnActions />
			<RailMoveArea />
			<RailChat />
		</div>
	);
}

// mobile layout: strip, focused board, own board, controls, hand. logs/chat are sheets
function ChatBubbleIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path
				d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function LogListIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path
				d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function SheetToggleButton({
	label,
	icon,
	onClick,
}: {
	label: string;
	icon: ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/85 transition-all cursor-pointer"
		>
			{icon}
		</button>
	);
}

// bottom sheet, covers screen including hand
function MobileSheet({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end">
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className="absolute inset-0 bg-black/60"
			/>
			<div className="relative ft-panel-ink rounded-t-2xl border-t border-white/10 flex flex-col max-h-[75dvh]">
				<div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
					<SectionTitle>{title}</SectionTitle>
					<button
						type="button"
						onClick={onClose}
						className="ft-eyebrow text-[11px] text-white/40 hover:text-white/70 cursor-pointer"
					>
						Close
					</button>
				</div>
				<div className="flex-1 min-h-0 flex flex-col px-4 py-3">{children}</div>
			</div>
		</div>
	);
}

function useOtherPlayerIds(): string[] {
	const { ft, playerId } = useFaceturnState();
	if (!ft) return [];
	const order =
		ft.turnOrder.length > 0 ? ft.turnOrder : Object.keys(ft.players);
	return order.filter((id) => id !== playerId);
}

function useMyTeamIndex(): number | null {
	const { ft, playerId } = useFaceturnState();
	if (!ft || ft.mode !== "teams") return null;
	const idx = ft.teams.findIndex((team) => team.includes(playerId));
	return idx === -1 ? null : idx;
}

function RosterChip({
	id,
	name,
	isActive,
	isAlly,
	focused,
	onClick,
}: {
	id: string;
	name: string;
	isActive: boolean;
	isAlly: boolean;
	focused: boolean;
	onClick: () => void;
}) {
	const { ft } = useFaceturnState();
	const p = ft?.players[id];
	if (!p) return null;

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all cursor-pointer",
				focused
					? "border-amber-400/70 bg-amber-400/10"
					: isAlly
						? "border-sky-400/30 bg-sky-400/5"
						: "border-white/10 bg-white/5",
				p.isEliminated && "opacity-40 grayscale",
			)}
		>
			{isActive && (
				<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
			)}
			<span
				className={cn(
					"ft-eyebrow text-xs truncate max-w-23",
					isActive ? "text-amber-200" : "text-white/75",
				)}
			>
				{name}
			</span>
			<span className="text-[10px] text-white/40 tabular-nums shrink-0">
				₱{p.cash}
			</span>
		</button>
	);
}

// horizontal scrolling strip, costs same vertical space for any player count
function MobileRoster({
	focusedId,
	onFocus,
}: {
	focusedId: string | null;
	onFocus: (id: string | null) => void;
}) {
	const { ft, playerMap } = useFaceturnState();
	const ids = useOtherPlayerIds();
	const myTeamIndex = useMyTeamIndex();
	if (!ft || ids.length === 0) return null;

	return (
		<div
			className="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto ft-scroll border-b border-white/10"
			style={{ touchAction: "pan-x" }}
		>
			{ids.map((id) => {
				const teamIndex =
					ft.mode === "teams"
						? ft.teams.findIndex((team) => team.includes(id))
						: null;
				const isAlly =
					ft.mode === "teams" &&
					myTeamIndex !== null &&
					teamIndex === myTeamIndex;
				return (
					<RosterChip
						key={id}
						id={id}
						name={playerMap[id]?.name ?? id}
						isActive={ft.turn?.activePlayerId === id}
						isAlly={isAlly}
						focused={focusedId === id}
						onClick={() => onFocus(focusedId === id ? null : id)}
					/>
				);
			})}
		</div>
	);
}

function MobileBoardArea({ focusedId }: { focusedId: string | null }) {
	const { containerRef, contentRef, cardSize } = useFitBoardCardSize();
	const { ft, secret, playerId, playerMap } = useFaceturnState();
	if (!ft) return null;

	const me = ft.players[playerId];
	const focused = focusedId ? ft.players[focusedId] : null;

	return (
		<div
			ref={containerRef}
			className="ft-table-surface relative flex-1 min-h-0 overflow-y-auto ft-scroll pointer-events-auto"
			style={{ touchAction: "pan-y" }}
		>
			<div
				ref={contentRef}
				className="flex flex-col gap-3 py-3 px-2"
				style={{ "--card-vw-share": `${cardSize}px` } as CSSProperties}
			>
				{focused && focusedId && (
					<PlayerBoard
						player={focused}
						name={playerMap[focusedId]?.name ?? focusedId}
						isActive={ft.turn?.activePlayerId === focusedId}
						isMe={false}
					/>
				)}
				{me && (
					<PlayerBoard
						player={me}
						name={playerMap[playerId]?.name ?? "You"}
						isActive={ft.turn?.activePlayerId === playerId}
						isMe
						knownCrewAssignments={secret?.crewAssignments}
					/>
				)}
			</div>
			<CardPreviewDock />
		</div>
	);
}

function MobileActionStrip() {
	return (
		<div className="shrink-0 ft-panel-ink border-t border-white/10">
			<TurnActions />
			<RailMoveArea />
		</div>
	);
}

function MobileScreen() {
	const { ft, playerMap } = useFaceturnState();
	const [focusedId, setFocusedId] = useState<string | null>(null);
	const [sheet, setSheet] = useState<"logs" | "chat" | null>(null);

	if (!ft) return null;

	return (
		<div className="relative w-full h-full flex flex-col overflow-hidden">
			<RailHeader
				extraActions={
					<>
						<SheetToggleButton
							label="Logs"
							icon={<LogListIcon className="w-4 h-4" />}
							onClick={() => setSheet("logs")}
						/>
						<SheetToggleButton
							label="Chat"
							icon={<ChatBubbleIcon className="w-4 h-4" />}
							onClick={() => setSheet("chat")}
						/>
					</>
				}
			/>
			<MobileRoster focusedId={focusedId} onFocus={setFocusedId} />
			<MobileBoardArea focusedId={focusedId} />
			<MobileActionStrip />
			<div className="pointer-events-auto shrink-0">
				<PersistentHand />
			</div>
			<div className="pointer-events-none fixed right-4 bottom-28 z-40 flex justify-end pr-4">
				<PassButton />
			</div>

			{sheet === "logs" && (
				<MobileSheet title="Logs" onClose={() => setSheet(null)}>
					<LogFeed
						log={ft.log}
						playerMap={playerMap}
						className="flex-1 min-h-0"
					/>
				</MobileSheet>
			)}
			{sheet === "chat" && (
				<MobileSheet title="Chat" onClose={() => setSheet(null)}>
					<ChatFeed />
				</MobileSheet>
			)}
		</div>
	);
}

function HudContent() {
	return (
		<div className="flex flex-col h-full">
			<div className="pointer-events-auto">
				<PersistentHand />
			</div>
			<div className="pointer-events-none fixed right-4 bottom-28 lg:right-(--rail-inset) z-40 flex justify-end pr-4">
				<PassButton />
			</div>
		</div>
	);
}

export function FaceTurnPlayer() {
	const { ft, playerId, canChallenge } = useFaceturnState();
	const isDesktop = useIsDesktopRail();

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
			{isDesktop ? (
				<GameScreen
					board={<BoardContent />}
					hud={<HudContent />}
					rail={<RailContent />}
					recedeActive={sceneKind !== null}
					recedeIntensity={sceneRecedeIntensity(sceneKind)}
				/>
			) : (
				<MobileScreen />
			)}
			{sceneList.map((entry) => (
				<PlayerSceneContent
					key={entry.key}
					sceneKind={entry.value}
					isExiting={entry.isExiting}
					panelRef={entry.panelRef}
				/>
			))}
			<EventAnnouncer />
		</div>
	);
}