import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveWatcherHide } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "watcher_hide_offer" }
>;

export const watcherHideOfferSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_watcher_hide_offer",

	resolve(state, interaction, action) {
		if (action.type !== "resolve_watcher_hide_offer") return null;
		const actor = state.players.get(interaction.actorId);
		if (!actor) return null;

		resolveWatcherHide(
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
			resolveWatcherHide(
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
		type: "watcher_hide_offer",
		actorId: interaction.actorId,
		eligibleTargets: interaction.eligibleTargets,
	}),
};