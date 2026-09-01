import type { InteractionSpec, PendingInteraction } from "./types";
import { getEnemies, stealCashFromVictim } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "bear_bones_steal_pick" }
>;

export const bearBonesStealPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_bear_bones_steal_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_bear_bones_steal_pick") return null;
		const isValidTarget = interaction.eligibleTargetIds.includes(
			action.targetPlayerId,
		);
		if (!isValidTarget) return null;
		stealCashFromVictim(
			respondingPlayer,
			action.targetPlayerId,
			interaction.amount,
			state,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId);
		if (actor) {
			const firstEnemy = getEnemies(state, interaction.actorId)[0];
			if (firstEnemy) {
				stealCashFromVictim(
					actor,
					firstEnemy.playerId,
					interaction.amount,
					state,
				);
			}
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "bear_bones_steal_pick",
		actorId: interaction.actorId,
		eligibleTargetIds: interaction.eligibleTargetIds,
		amount: interaction.amount,
	}),
};