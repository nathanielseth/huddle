import type {
	FaceturnsState,
	PendingInteractionView,
} from "@shared/games/face-turn/types";
import { getInteractionResponder } from "../hooks/useFaceturnState";

// single source for phase takeover decisions
// every pendingInteraction type must appear here or its prompt never mounts and the server timeout auto-resolves it
const TAKEOVER_INTERACTION_TYPES = new Set<PendingInteractionView["type"]>([
	"peek_discard",
	"choose_discard_count",
	"choose_from_discard",
	"dig_deep_pick",
	"tactical_support_hide_offer",
	"void_legs_choice",
	"truth_serum_reveal",
	"crew_reactivate",
	"choose_crew_to_turn",
	"poison_target_pick",
	"switch_up_pick",
	"bear_bones_bonus_strike",
	"background_check_guess",
	"watcher_hide_offer",
	"lighthouse_disable_pick",
	"tag_out_pick",
	"too_big_swap_pick",
	"belladonna_copy_pick",
	"watcher_steal_pick",
]);

// these need clicks to pass through to the board instead of being handled inside the prompt
const BOARD_CLICK_INTERACTION_TYPES = new Set<PendingInteractionView["type"]>([
	"crew_reactivate",
	"choose_crew_to_turn",
	"tactical_support_hide_offer",
	"watcher_hide_offer",
	"too_big_swap_pick",
	"truth_serum_reveal",
	"switch_up_pick",
	"tag_out_pick",
	"lighthouse_disable_pick",
	"background_check_guess",
]);

const TAKEOVER_PHASES = new Set<FaceturnsState["phase"]>([
	"mulligan",
	"rps",
	"rps_reveal",
	"rps_order_choice",
	"drafting",
	"finished",
]);

// challenge phases blocking for eligible responder, not pendingInteraction-driven
const TAKEOVER_CHALLENGE_PHASES = new Set<FaceturnsState["phase"]>([
	"challenge_window",
	"defend_window",
	"defend_declared",
]);

export type PhaseSceneKind =
	| { kind: "phase"; phase: FaceturnsState["phase"] }
	| { kind: "interaction"; interaction: PendingInteractionView }
	| { kind: "challenge"; phase: FaceturnsState["phase"] }
	| null;

export function computeSceneKind(
	ft: FaceturnsState | null,
	playerId: string,
	challengeEligible: boolean,
): PhaseSceneKind {
	if (!ft) return null;

	if (TAKEOVER_PHASES.has(ft.phase)) {
		return { kind: "phase", phase: ft.phase };
	}

	if (TAKEOVER_CHALLENGE_PHASES.has(ft.phase) && challengeEligible) {
		return { kind: "challenge", phase: ft.phase };
	}

	const pi = ft.pendingInteraction;
	if (
		pi &&
		getInteractionResponder(pi) === playerId &&
		TAKEOVER_INTERACTION_TYPES.has(pi.type)
	) {
		return { kind: "interaction", interaction: pi };
	}

	return null;
}

export function isTakeoverInteractionType(
	type: PendingInteractionView["type"],
): boolean {
	return TAKEOVER_INTERACTION_TYPES.has(type);
}

export function isBoardClickInteractionType(
	type: PendingInteractionView["type"],
): boolean {
	return BOARD_CLICK_INTERACTION_TYPES.has(type);
}

export function sceneRecedeIntensity(
	sceneKind: PhaseSceneKind,
): "full" | "light" {
	if (!sceneKind) return "full";
	if (sceneKind.kind === "challenge") return "light";
	if (
		sceneKind.kind === "interaction" &&
		isBoardClickInteractionType(sceneKind.interaction.type)
	) {
		return "light";
	}
	return "full";
}

// stable key for AnimatePresence, changes only when the moment changes
export function sceneKeyOf(sceneKind: PhaseSceneKind): string {
	if (!sceneKind) return "none";
	if (sceneKind.kind === "phase") {
		const phase = sceneKind.phase === "rps_reveal" ? "rps" : sceneKind.phase;
		return `phase:${phase}`;
	}
	if (sceneKind.kind === "challenge") return `challenge:${sceneKind.phase}`;
	const pi = sceneKind.interaction;
	// key on responder not actor, because truth_serum_reveal/choose_crew_to_turn responders differ
	return `interaction:${pi.type}:${getInteractionResponder(pi)}`;
}