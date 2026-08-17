import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveChooseDiscardCount } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "choose_discard_count" }>;

export const chooseDiscardCountSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_choose_discard_count",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_choose_discard_count") return null;
		resolveChooseDiscardCount(
			state,
			respondingPlayer,
			action.count,
			interaction.maxCount,
			interaction.targetPlayerId,
			interaction.damagePerCard,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		// timeout default resolves with count 0 (discards nothing)
		resolveChooseDiscardCount(
			state,
			actor,
			0,
			interaction.maxCount,
			interaction.targetPlayerId,
			interaction.damagePerCard,
		);
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "choose_discard_count",
		actorId: interaction.actorId,
		maxCount: interaction.maxCount,
		targetPlayerId: interaction.targetPlayerId,
		damagePerCard: interaction.damagePerCard,
	}),
};