import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveWatcherStealPick } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "watcher_steal_pick" }>;

export const watcherStealPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_watcher_steal_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_watcher_steal_pick") return null;

		const stole = resolveWatcherStealPick(
			state,
			respondingPlayer,
			interaction.targetPlayerId,
			action.cardId,
			interaction.revealedCards,
		);
		if (!stole) return null;

		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		resolveWatcherStealPick(
			state,
			actor,
			interaction.targetPlayerId,
			interaction.revealedCards[0],
			interaction.revealedCards,
		);
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "watcher_steal_pick",
		actorId: interaction.actorId,
		targetPlayerId: interaction.targetPlayerId,
	}),
};