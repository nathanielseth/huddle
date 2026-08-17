import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveChooseOwnCrewToStrike } from "../effects";
import { buildStrikeResolution } from "../index";

type Interaction = Extract<
	PendingInteraction,
	{ type: "choose_own_crew_to_strike" }
>;

export const chooseOwnCrewToStrikeSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_choose_own_crew_to_strike",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_choose_own_crew_to_strike") return null;

		const outcome = resolveChooseOwnCrewToStrike(
			state,
			respondingPlayer,
			action.crewSlot,
			interaction.eligibleSlots,
		);
		if (!outcome) return null;

		state.lastResolution = buildStrikeResolution(
			outcome,
			interaction.actorId,
			interaction.actorId,
			"strike",
		);

		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		const slot = interaction.eligibleSlots[0];
		if (slot !== undefined) {
			const outcome = resolveChooseOwnCrewToStrike(
				state,
				actor,
				slot,
				interaction.eligibleSlots,
			);
			if (outcome) {
				state.lastResolution = buildStrikeResolution(
					outcome,
					interaction.actorId,
					interaction.actorId,
					"strike",
				);
			}
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "choose_own_crew_to_strike",
		actorId: interaction.actorId,
		eligibleSlots: interaction.eligibleSlots,
	}),
};