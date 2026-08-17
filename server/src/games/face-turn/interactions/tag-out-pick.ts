import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveTagOutPick } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "tag_out_pick" }>;

export const tagOutPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_tag_out_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_tag_out_pick") return null;
		const teammate = state.players.get(interaction.teammateId);
		if (!teammate) return null;
		resolveTagOutPick(
			state,
			respondingPlayer,
			teammate,
			action.ownSlot,
			action.teammateSlot,
			interaction.ownEligibleSlots,
			interaction.teammateEligibleSlots,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		const teammate = state.players.get(interaction.teammateId);
		const ownSlot = interaction.ownEligibleSlots[0];
		const teammateSlot = interaction.teammateEligibleSlots[0];
		if (teammate && ownSlot !== undefined && teammateSlot !== undefined) {
			resolveTagOutPick(
				state,
				actor,
				teammate,
				ownSlot,
				teammateSlot,
				interaction.ownEligibleSlots,
				interaction.teammateEligibleSlots,
			);
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "tag_out_pick",
		actorId: interaction.actorId,
		teammateId: interaction.teammateId,
		ownEligibleSlots: interaction.ownEligibleSlots,
		teammateEligibleSlots: interaction.teammateEligibleSlots,
	}),
};