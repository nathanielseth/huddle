import type { InteractionSpec, PendingInteraction } from "./types";
import { CREW_CLASSES } from "../../../../../shared/games/face-turn/types";
import { resolveBackgroundCheckGuess } from "../effects";
import { resolveChallenge, executePendingAction } from "../game";
import { buildStrikeResolution, afterAction } from "../action-results";

type Interaction = Extract<
	PendingInteraction,
	{ type: "background_check_guess" }
>;

export const backgroundCheckGuessSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_background_check_guess",

	// chains straight into resolveChallenge/executePendingAction and returns a full EngineResult already
	// so it's modeled as "custom" rather than the after_action/raw_result shape
	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_background_check_guess") return null;
		const target = state.players.get(interaction.targetPlayerId);
		if (!target) return null;

		resolveBackgroundCheckGuess(
			state,
			respondingPlayer,
			target,
			action.targetCrewSlot,
			action.guessClass,
			interaction.eligibleSlots,
		);

		// clear before resolveChallenge: its face-up penalty may open a new pendingInteraction, and later checks rely on that
		state.pendingInteraction = null;
		const originalPending = state.pendingAction!;

		const { actionProceeds, resolution, strikeOutcome } = resolveChallenge(
			state,
			interaction.actorId,
		);
		state.lastResolution = resolution;

		// overwrite only for crew turns, keep challenge result for executes
		if (
			strikeOutcome &&
			strikeOutcome.outcome !== "pending" &&
			strikeOutcome.outcome !== "executed"
		) {
			const challengeTargetId = actionProceeds
				? interaction.actorId
				: originalPending.actorId;
			const challengeAttackerId = actionProceeds
				? originalPending.actorId
				: interaction.actorId;
			state.lastResolution = buildStrikeResolution(
				state,
				strikeOutcome,
				challengeAttackerId,
				challengeTargetId,
				"challenge_loss",
			);
		}

		if (actionProceeds && state.pendingInteraction === null) {
			const outcome = executePendingAction(state);
			if (outcome && outcome.outcome !== "pending") {
				state.lastResolution = buildStrikeResolution(
					state,
					outcome,
					originalPending.actorId,
					originalPending.targetPlayerId ?? "",
					"strike",
				);
			}
			state.pendingAction = null;
			state.phase = "active_turn";
			return { kind: "custom", result: afterAction(state) };
		}

		if (actionProceeds && state.pendingInteraction !== null) {
			return { kind: "custom", result: afterAction(state) };
		}

		state.pendingAction = null;
		state.phase = "active_turn";
		return { kind: "custom", result: afterAction(state) };
	},

	applyTimeoutDefault(state, interaction) {
		const challenger = state.players.get(interaction.actorId)!;
		const target = state.players.get(interaction.targetPlayerId);
		if (target && interaction.eligibleSlots[0] !== undefined) {
			const randomGuess =
				CREW_CLASSES[Math.floor(state.rng() * CREW_CLASSES.length)]!;
			resolveBackgroundCheckGuess(
				state,
				challenger,
				target,
				interaction.eligibleSlots[0],
				randomGuess,
				interaction.eligibleSlots,
			);
		}
		const { resolution, strikeOutcome } = resolveChallenge(
			state,
			interaction.actorId,
		);
		state.lastResolution = resolution;

		if (
			strikeOutcome &&
			strikeOutcome.outcome !== "pending" &&
			strikeOutcome.outcome !== "executed"
		) {
			state.lastResolution = buildStrikeResolution(
				state,
				strikeOutcome,
				interaction.actorId,
				interaction.targetPlayerId,
				"challenge_loss",
			);
		}
		state.pendingAction = null;
		// timeout path always falls through to the shared afterAction call
		// at the end of onTimerExpired's pending-interaction block
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "background_check_guess",
		actorId: interaction.actorId,
		targetPlayerId: interaction.targetPlayerId,
		eligibleSlots: interaction.eligibleSlots,
	}),
};