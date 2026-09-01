import "../../board.css";
import type { PhaseSceneKind } from "../../lib/phaseScenePredicate";
import { isBoardClickInteractionType } from "../../lib/phaseScenePredicate";
import { PhaseScene } from "./PhaseScene";
import { MulliganPhase } from "../../phases/MulliganPhase";
import { RpsPhase } from "../../phases/RpsPhase";
import { RpsOrderChoicePhase } from "../../phases/RpsOrderChoicePhase";
import { DraftingPhase } from "../../phases/DraftingPhase";
import { FinishedPhase } from "../../phases/FinishedPhase";
import { ChallengeBar } from "../ChallengeBar";
import { InteractionPrompt } from "../InteractionPrompt";
import { useFaceturnState } from "../../hooks/useFaceturnState";

const PHASE_TITLE: Record<string, string> = {
	mulligan: "Mulligan",
	rps: "Rock Paper Scissors",
	rps_order_choice: "Rock Paper Scissors",
	challenge_window: "Challenge Window",
	defend_window: "Defend Window",
	defend_declared: "Defend Declared",
};

interface SceneContentProps {
	sceneKind: PhaseSceneKind;
	isExiting?: boolean;
	panelRef?: React.Ref<HTMLDivElement>;
}

export function HostSceneContent({
	sceneKind,
	isExiting,
	panelRef,
}: SceneContentProps) {
	const { ft, playerMap } = useFaceturnState();
	if (!sceneKind || !ft) return null;

	if (sceneKind.kind === "phase") {
		if (sceneKind.phase === "drafting") {
			return (
				<PhaseScene
					title={PHASE_TITLE[sceneKind.phase]}
					isExiting={isExiting}
					panelRef={panelRef}
				>
					<div className="flex gap-4 flex-wrap justify-center">
						{Object.entries(ft.draft ?? {}).map(([pid, d]) => (
							<div
								key={pid}
								className="ft-panel-ink flex flex-col items-center gap-1 px-4 py-3 rounded-xl border border-white/15"
							>
								<span className="ft-eyebrow text-sm text-white/80">
									{playerMap[pid]?.name ?? pid}
								</span>
								<span
									className={`ft-eyebrow text-xs ${
										d.isDraftLocked ? "text-emerald-400" : "text-white/30"
									}`}
								>
									{d.isDraftLocked ? "Locked" : `${d.selectedCount} picked`}
								</span>
							</div>
						))}
					</div>
				</PhaseScene>
			);
		}
		if (sceneKind.phase === "finished") {
			return (
				<PhaseScene isExiting={isExiting} panelRef={panelRef}>
					<FinishedPhase />
				</PhaseScene>
			);
		}
		// host has no per-player action, just a caption
		return (
			<PhaseScene
				title={PHASE_TITLE[sceneKind.phase]}
				isExiting={isExiting}
				panelRef={panelRef}
			>
				<p className="text-sm text-white/50 text-center">
					{sceneKind.phase === "mulligan"
						? "Players are deciding whether to keep their opening hand."
						: sceneKind.phase === "rps_order_choice"
							? "The winner is deciding who goes first."
							: "Rock Paper Scissors is deciding turn order."}
				</p>
			</PhaseScene>
		);
	}

	// host shows waiting caption for per-responder takeovers
	const waitingLabel =
		sceneKind.kind === "challenge"
			? PHASE_TITLE[sceneKind.phase]
			: "Someone is deciding something";
	return (
		<PhaseScene
			title={waitingLabel}
			backdrop={sceneKind.kind === "challenge" ? "light" : "default"}
			isExiting={isExiting}
			panelRef={panelRef}
		>
			<p className="text-sm text-white/50 text-center">
				Waiting on a player's response…
			</p>
		</PhaseScene>
	);
}

export function PlayerSceneContent({
	sceneKind,
	isExiting,
	panelRef,
}: SceneContentProps) {
	if (!sceneKind) return null;

	if (sceneKind.kind === "phase") {
		if (sceneKind.phase === "drafting") {
			return (
				<PhaseScene fullBleed isExiting={isExiting} panelRef={panelRef}>
					<DraftingPhase />
				</PhaseScene>
			);
		}
		if (sceneKind.phase === "mulligan") {
			// bare: mulligan already renders its own bordered card
			return (
				<PhaseScene bare isExiting={isExiting} panelRef={panelRef}>
					<MulliganPhase />
				</PhaseScene>
			);
		}
		if (sceneKind.phase === "rps" || sceneKind.phase === "rps_reveal") {
			// bare: rps border carries the amber accent meaning your turn
			return (
				<PhaseScene bare isExiting={isExiting} panelRef={panelRef}>
					<RpsPhase />
				</PhaseScene>
			);
		}
		if (sceneKind.phase === "rps_order_choice") {
			// bare: same amber accent signal as rps
			return (
				<PhaseScene bare isExiting={isExiting} panelRef={panelRef}>
					<RpsOrderChoicePhase />
				</PhaseScene>
			);
		}
		return (
			<PhaseScene isExiting={isExiting} panelRef={panelRef}>
				<FinishedPhase />
			</PhaseScene>
		);
	}

	if (sceneKind.kind === "challenge") {
		// bare: challenge bar branches carry their own accent border
		// light backdrop: quick prompt, keep the board legible underneath
		return (
			<PhaseScene
				bare
				backdrop="light"
				isExiting={isExiting}
				panelRef={panelRef}
			>
				<ChallengeBar />
			</PhaseScene>
		);
	}

	// board-click prompts need clicks to reach the real board card underneath the takeover backdrop
	return (
		<PhaseScene
			bare
			boardClickThrough={isBoardClickInteractionType(
				sceneKind.interaction.type,
			)}
			isExiting={isExiting}
			panelRef={panelRef}
		>
			<InteractionPrompt />
		</PhaseScene>
	);
}