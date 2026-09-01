import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveTacticalSupportHide } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "tactical_support_hide_offer" }
>;

export const tacticalSupportHideSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_tactical_support_hide_offer",

	resolve(state, interaction, action) {
		if (action.type !== "resolve_tactical_support_hide_offer") return null;
		const target = state.players.get(interaction.targetPlayerId);
		if (!target) return null;
		resolveTacticalSupportHide(
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
			resolveTacticalSupportHide(state, target, null, interaction.eligibleSlots);
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "tactical_support_hide_offer",
		actorId: interaction.actorId,
		targetPlayerId: interaction.targetPlayerId,
		eligibleSlots: interaction.eligibleSlots,
	}),
};