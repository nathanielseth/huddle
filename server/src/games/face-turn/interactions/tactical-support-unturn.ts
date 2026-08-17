import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveTacticalSupportUnturn } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "tactical_support_unturn_offer" }
>;

export const tacticalSupportUnturnSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_tactical_support_unturn_offer",

	resolve(state, interaction, action) {
		if (action.type !== "resolve_tactical_support_unturn_offer") return null;
		const target = state.players.get(interaction.targetPlayerId);
		if (!target) return null;
		resolveTacticalSupportUnturn(
			state,
			target,
			action.slot ?? null,
			interaction.eligibleSlots,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId);
		const target = state.players.get(interaction.targetPlayerId);
		if (actor && target) {
			// declines the offer
			resolveTacticalSupportUnturn(state, target, null, interaction.eligibleSlots);
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "tactical_support_unturn_offer",
		actorId: interaction.actorId,
		targetPlayerId: interaction.targetPlayerId,
		eligibleSlots: interaction.eligibleSlots,
	}),
};