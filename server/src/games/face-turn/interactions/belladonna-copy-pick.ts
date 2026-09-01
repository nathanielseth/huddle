import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveBelladonnaCopyPick } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "belladonna_copy_pick" }
>;

export const belladonnaCopyPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_belladonna_copy_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_belladonna_copy_pick") return null;
		resolveBelladonnaCopyPick(
			state,
			respondingPlayer,
			action.confirmed,
			action.targetPlayerId ?? null,
			action.targetActiveMoveSlot ?? null,
			interaction.eligibleTargets,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	// optional turned-effect, like bear_bones_bonus_strike: timing out declines
	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		resolveBelladonnaCopyPick(
			state,
			actor,
			false,
			null,
			null,
			interaction.eligibleTargets,
		);
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "belladonna_copy_pick",
		actorId: interaction.actorId,
		eligibleTargets: interaction.eligibleTargets,
	}),
};
