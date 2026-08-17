import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveChooseFromDiscard } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "choose_from_discard" }>;

export const chooseFromDiscardSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_choose_from_discard",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_choose_from_discard") return null;
		resolveChooseFromDiscard(
			respondingPlayer,
			action.cardId,
			interaction.discardPileSnapshot,
		);
		state.pendingInteraction = null;
		return { kind: "raw_result" };
	},

	applyTimeoutDefault: () => ({ kind: "after_action" }),

	toView: (interaction) => ({
		type: "choose_from_discard",
		actorId: interaction.actorId,
		discardPileSnapshot: interaction.discardPileSnapshot,
	}),
};