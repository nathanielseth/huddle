import type { InteractionSpec, PendingInteraction } from "./types";
import { triggerCrewTurnedEffects } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "crew_reactivate" }>;

export const crewReactivateSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_crew_reactivate",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_crew_reactivate") return null;
		const slot = action.crewSlot as 0 | 1;
		if (!interaction.eligibleSlots.includes(slot)) return null;
		if (!respondingPlayer.crewIds[slot] || !respondingPlayer.crewTurned[slot])
			return null;
		triggerCrewTurnedEffects(state, respondingPlayer, slot);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		const slot = interaction.eligibleSlots[0];
		if (slot !== undefined)
			triggerCrewTurnedEffects(state, actor, slot as 0 | 1);
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "crew_reactivate",
		actorId: interaction.actorId,
		eligibleSlots: interaction.eligibleSlots,
	}),
};