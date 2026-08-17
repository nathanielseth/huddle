import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveTooBigSwapPick } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "too_big_swap_pick" }>;

export const tooBigSwapPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_too_big_swap_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_too_big_swap_pick") return null;
		resolveTooBigSwapPick(
			state,
			respondingPlayer,
			interaction.ownSlot,
			action.targetPlayerId,
			action.crewSlot,
			interaction.eligibleTargets,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	// mandatory turned‑effect
	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		const firstTarget = interaction.eligibleTargets[0];
		if (firstTarget) {
			resolveTooBigSwapPick(
				state,
				actor,
				interaction.ownSlot,
				firstTarget.playerId,
				firstTarget.slot,
				interaction.eligibleTargets,
			);
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "too_big_swap_pick",
		actorId: interaction.actorId,
		ownSlot: interaction.ownSlot,
		eligibleTargets: interaction.eligibleTargets,
	}),
};