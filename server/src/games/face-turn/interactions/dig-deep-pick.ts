import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveDigDeepPick } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "dig_deep_pick" }>;

export const digDeepPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_dig_deep_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_dig_deep_pick") return null;
		const lookCount = interaction.revealedCards.length;
		resolveDigDeepPick(
			respondingPlayer,
			action.cardIds,
			lookCount,
			interaction.maxPicks ?? 1,
			state.rng,
		);
		state.pendingInteraction = null;
		return { kind: "raw_result" };
	},

	applyTimeoutDefault: () => ({ kind: "after_action" }),

	toView: (interaction) => ({
		type: "dig_deep_pick",
		actorId: interaction.actorId,
		...(interaction.maxPicks !== undefined
			? { maxPicks: interaction.maxPicks }
			: {}),
	}),
};