import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveWatcherUnturn } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "watcher_unturn_offer" }
>;

export const watcherUnturnOfferSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_watcher_unturn_offer",

	resolve(state, interaction, action) {
		if (action.type !== "resolve_watcher_unturn_offer") return null;
		const actor = state.players.get(interaction.actorId);
		if (!actor) return null;

		resolveWatcherUnturn(
			state,
			actor,
			action.targetPlayerId ?? null,
			action.slot ?? null,
			interaction.eligibleTargets,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		// decline by default
		const actor = state.players.get(interaction.actorId);
		if (actor) {
			resolveWatcherUnturn(
				state,
				actor,
				null,
				null,
				interaction.eligibleTargets,
			);
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "watcher_unturn_offer",
		actorId: interaction.actorId,
		eligibleTargets: interaction.eligibleTargets,
	}),
};