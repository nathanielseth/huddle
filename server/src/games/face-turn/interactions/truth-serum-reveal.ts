import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveTruthSerumReveal } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "truth_serum_reveal" }>;

export const truthSerumRevealSpec: InteractionSpec<Interaction> = {
	// the target, not the actor, picks which face-down crew to reveal
	getResponderId: (interaction) => interaction.targetPlayerId,
	actionType: "resolve_truth_serum_reveal",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_truth_serum_reveal") return null;

		const result = resolveTruthSerumReveal(
			state,
			respondingPlayer,
			action.crewSlot,
			interaction.eligibleSlots,
		);
		if (result) {
			state.lastResolution = {
				type: "crew_class_revealed",
				actorId: interaction.actorId,
				targetPlayerId: interaction.targetPlayerId,
				revealedSlot: result.revealedSlot,
				revealedClass: result.revealedClass,
			};
		}

		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const target = state.players.get(interaction.targetPlayerId);
		const slot = interaction.eligibleSlots[0];
		if (target && slot !== undefined) {
			const result = resolveTruthSerumReveal(
				state,
				target,
				slot,
				interaction.eligibleSlots,
			);
			if (result) {
				state.lastResolution = {
					type: "crew_class_revealed",
					actorId: interaction.actorId,
					targetPlayerId: interaction.targetPlayerId,
					revealedSlot: result.revealedSlot,
					revealedClass: result.revealedClass,
				};
			}
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "truth_serum_reveal",
		actorId: interaction.actorId,
		targetPlayerId: interaction.targetPlayerId,
		eligibleSlots: interaction.eligibleSlots,
	}),
};