import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveSwitchUpPick } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "switch_up_pick" }>;

export const switchUpPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_switch_up_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_switch_up_pick") return null;
		resolveSwitchUpPick(
			state,
			respondingPlayer,
			action.hideSlot,
			action.turnSlot,
			interaction.faceUpSlots,
			interaction.faceDownSlots,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		const hideSlot = interaction.faceUpSlots[0];
		const turnSlot = interaction.faceDownSlots[0];
		if (hideSlot !== undefined && turnSlot !== undefined) {
			resolveSwitchUpPick(
				state,
				actor,
				hideSlot,
				turnSlot,
				interaction.faceUpSlots,
				interaction.faceDownSlots,
			);
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "switch_up_pick",
		actorId: interaction.actorId,
		faceUpSlots: interaction.faceUpSlots,
		faceDownSlots: interaction.faceDownSlots,
	}),
};