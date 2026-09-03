import type { InteractionSpec, PendingInteraction } from "./types";
import type { CrewTurnCause } from "../../../../../shared/games/face-turn/log";
import {
	turnCrewAtSlot,
	recomputePassives,
	triggerCrewTurnedEffects,
	applyBloodMoneyOnStrike,
	maybeTriggerRazorStabGrant,
} from "../effects";
import {
	buildStrikeResolution,
	runDeferredPendingAction,
} from "../action-results";

type Interaction = Extract<PendingInteraction, { type: "choose_crew_to_turn" }>;

function strikeResolutionViaFrom(
	via: CrewTurnCause,
): "strike" | "face_turn" | "challenge_loss" {
	if (via.reason === "challenge_loss") return "challenge_loss";
	if (via.reason === "face_turn") return "face_turn";
	return "strike";
}

export const chooseCrewToTurnSpec: InteractionSpec<Interaction> = {
	// chooser player: attacker unless void arms flips
	getResponderId: (interaction) => interaction.chooserPlayerId,
	actionType: "resolve_choose_crew_to_turn",

	resolve(state, interaction, action) {
		if (action.type !== "resolve_choose_crew_to_turn") return null;
		const target = state.players.get(interaction.targetPlayerId);
		if (!target) return null;
		const slot = action.crewSlot as 0 | 1;
		if (!interaction.eligibleSlots.includes(slot)) return null;
		if (!target.crewIds[slot] || target.crewTurned[slot]) return null;

		turnCrewAtSlot(state, target, slot, interaction.actorId, interaction.via);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, slot, interaction.causedByEnemy);

		if (interaction.isStrike) {
			const striker = state.players.get(interaction.actorId);
			if (striker) {
				applyBloodMoneyOnStrike(state, striker);
				maybeTriggerRazorStabGrant(striker);
			}
		}

		// always set the resolution for this crew turn
		state.lastResolution = buildStrikeResolution(
			state,
			{ outcome: "crew_turned", slot },
			interaction.actorId,
			interaction.targetPlayerId,
			strikeResolutionViaFrom(interaction.via),
		);

		state.pendingInteraction = null;

		// if this was a deferred penalty, run the original class action
		if (interaction.deferredActionPending && state.pendingAction) {
			runDeferredPendingAction(state);
		}

		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const target = state.players.get(interaction.targetPlayerId);
		if (target && interaction.eligibleSlots[0] !== undefined) {
			const slot = interaction.eligibleSlots[0] as 0 | 1;
			turnCrewAtSlot(state, target, slot, interaction.actorId, interaction.via);
			recomputePassives(target, state);
			triggerCrewTurnedEffects(state, target, slot, interaction.causedByEnemy);

			if (interaction.isStrike) {
				const striker = state.players.get(interaction.actorId);
				if (striker) {
					applyBloodMoneyOnStrike(state, striker);
					maybeTriggerRazorStabGrant(striker);
				}
			}

			state.lastResolution = buildStrikeResolution(
				state,
				{ outcome: "crew_turned", slot },
				interaction.actorId,
				interaction.targetPlayerId,
				strikeResolutionViaFrom(interaction.via),
			);
		}

		if (interaction.deferredActionPending && state.pendingAction) {
			runDeferredPendingAction(state);
		}

		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "choose_crew_to_turn",
		actorId: interaction.actorId,
		targetPlayerId: interaction.targetPlayerId,
		chooserPlayerId: interaction.chooserPlayerId,
		eligibleSlots: interaction.eligibleSlots,
		isStrike: interaction.isStrike,
	}),
};