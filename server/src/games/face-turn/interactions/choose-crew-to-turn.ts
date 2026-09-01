import type { InteractionSpec, PendingInteraction } from "./types";
import {
	turnCrewAtSlot,
	recomputePassives,
	triggerCrewTurnedEffects,
	applyBloodMoneyOnStrike,
} from "../effects";
import {
	buildStrikeResolution,
	runDeferredPendingAction,
} from "../action-results";

type Interaction = Extract<PendingInteraction, { type: "choose_crew_to_turn" }>;

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

		turnCrewAtSlot(state, target, slot, interaction.actorId);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, slot, interaction.causedByEnemy);

		if (interaction.isStrike) {
			const striker = state.players.get(interaction.actorId);
			if (striker) applyBloodMoneyOnStrike(state, striker);
		}

		// always set the resolution for this crew turn
		state.lastResolution = buildStrikeResolution(
			state,
			{ outcome: "crew_turned", slot },
			interaction.actorId,
			interaction.targetPlayerId,
			interaction.isStrike ? "strike" : "challenge_loss",
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
			turnCrewAtSlot(state, target, slot, interaction.actorId);
			recomputePassives(target, state);
			triggerCrewTurnedEffects(state, target, slot, interaction.causedByEnemy);

			if (interaction.isStrike) {
				const striker = state.players.get(interaction.actorId);
				if (striker) applyBloodMoneyOnStrike(state, striker);
			}

			state.lastResolution = buildStrikeResolution(
				state,
				{ outcome: "crew_turned", slot },
				interaction.actorId,
				interaction.targetPlayerId,
				interaction.isStrike ? "strike" : "challenge_loss",
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