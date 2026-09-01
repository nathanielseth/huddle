import { useFaceturnState } from "./hooks/useFaceturnState";
import { usePhaseSceneQueue } from "./hooks/usePhaseSceneQueue";
import { useExitPresence } from "./hooks/useExitPresence";
import { getBoardBucket } from "./lib/boardBucket";
import { computeSceneKind, sceneKeyOf } from "./lib/phaseScenePredicate";
import { GameScreen } from "./components/shell/GameScreen";
import { HostSceneContent } from "./components/scene/PhaseSceneContent";
import { PhaseBanner } from "./components/PhaseBanner";
import { MoveAnnouncer } from "./components/MoveAnnouncer";
import { PlayerBoard } from "./components/PlayerBoard";
import { CardPreviewDock } from "./components/hand/CardPreviewDock";
import { ChainStack } from "./components/move-chain/ChainStack";
import { EventDrawer } from "./components/EventDrawer";
import { useChainLeeway } from "./lib/animation/useChainLeeway";

export function FaceTurnHost() {
	const { ft, playerId } = useFaceturnState();

	const sceneKind = computeSceneKind(ft, playerId, false);
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
				board={<BoardGrid />}
				hud={<HudContent />}
				recedeActive={sceneKind !== null}
				recedeIntensity={sceneKind?.kind === "challenge" ? "light" : "full"}
			/>
			{sceneList.map((entry) => (
				<HostSceneContent
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

// every player's board, in its own scroll region
function BoardGrid() {
	const { ft, playerMap } = useFaceturnState();
	if (!ft) return null;
	const orderedIds =
		ft.turnOrder.length > 0 ? ft.turnOrder : Object.keys(ft.players);
	const bucket = getBoardBucket(orderedIds.length);

	return (
		<div className="relative h-full min-h-0">
			<div
				className="h-full min-h-0 overflow-y-auto pointer-events-auto"
				style={{
					touchAction: "pan-y",
					background:
						"radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.03), transparent 70%)",
				}}
			>
				<div
					className="grid gap-4 p-6 auto-rows-min justify-center"
					style={{
						gridTemplateColumns: `repeat(${bucket.columns}, minmax(0, ${bucket.panelMaxWidth}px))`,
					}}
				>
					{orderedIds.map((pid) => {
						const player = ft.players[pid];
						if (!player) return null;
						return (
							<PlayerBoard
								key={pid}
								player={player}
								name={playerMap[pid]?.name ?? pid}
								isActive={ft.turn?.activePlayerId === pid}
								compact={bucket.compact}
							/>
						);
					})}
				</div>
			</div>
			<CardPreviewDock />
		</div>
	);
}

function HudContent() {
	const { ft, playerMap } = useFaceturnState();
	// hooks called unconditionally; both return [] with nothing to show yet
	const leewayEntries = useChainLeeway(ft?.moveChain?.chain);
	if (!ft) return null;

	const showChain = ft.phase === "move_chain_window" && ft.moveChain !== null;
	const resolutionOrder = [...leewayEntries].reverse();

	return (
		<div className="flex flex-col h-full">
			<div className="pointer-events-auto">
				<PhaseBanner />
			</div>
			<div className="flex-1 min-h-0" />
			{showChain && ft.moveChain && (
				<div className="px-6 pb-2 pointer-events-auto flex justify-center">
					<ChainStack
						entries={resolutionOrder}
						playerMap={playerMap}
						variant="host"
						waitingOnName={
							playerMap[ft.moveChain.responderId]?.name ??
							ft.moveChain.responderId
						}
					/>
				</div>
			)}
			{(ft.pendingInteraction || ft.log.length > 0) && (
				<div className="px-6 pb-4">
					<EventDrawer
						log={ft.log}
						pendingInteraction={ft.pendingInteraction}
						playerMap={playerMap}
					/>
				</div>
			)}
		</div>
	);
}