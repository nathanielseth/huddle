import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveVoidLegsChoice } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "void_legs_choice" }>;

export const voidLegsChoiceSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_void_legs_choice",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_void_legs_choice") return null;
		resolveVoidLegsChoice(
			state,
			respondingPlayer,
			action.confirmed,
			respondingPlayer.derived.voidLegsDamage,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		resolveVoidLegsChoice(state, actor, false, actor.derived.voidLegsDamage);
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "void_legs_choice",
		actorId: interaction.actorId,
		hasCardsToDiscard: interaction.hasCardsToDiscard,
	}),
};