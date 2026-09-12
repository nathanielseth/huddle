import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveDestroyEnemyMovePick } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "destroy_enemy_move_pick" }
>;

export const destroyEnemyMovePickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_destroy_enemy_move_pick",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_destroy_enemy_move_pick") return null;
		resolveDestroyEnemyMovePick(
			state,
			respondingPlayer,
			action.targetPlayerId,
			action.targetActiveMoveSlot,
			interaction.eligibleTargets,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		const firstTarget = interaction.eligibleTargets[0]!;
		resolveDestroyEnemyMovePick(
			state,
			actor,
			firstTarget.playerId,
			firstTarget.slot,
			interaction.eligibleTargets,
		);
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "destroy_enemy_move_pick",
		actorId: interaction.actorId,
		eligibleTargets: interaction.eligibleTargets,
	}),
};
