import type { InteractionSpec, PendingInteraction } from "./types";
import { applyPoisonToVictim, getEnemies } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "poison_target_pick" }>;

export const poisonTargetPickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_poison_target",

	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_poison_target") return null;
		const isValidTarget = interaction.eligibleTargetIds.includes(
			action.targetPlayerId,
		);
		if (!isValidTarget) return null;
		applyPoisonToVictim(
			state,
			respondingPlayer,
			action.targetPlayerId,
			interaction.damagePerRound,
		);
		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId);
		if (actor) {
			const firstEnemy = getEnemies(state, interaction.actorId)[0];
			if (firstEnemy) {
				applyPoisonToVictim(
					state,
					actor,
					firstEnemy.playerId,
					interaction.damagePerRound,
				);
			}
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "poison_target_pick",
		actorId: interaction.actorId,
		eligibleTargetIds: interaction.eligibleTargetIds,
		damagePerRound: interaction.damagePerRound,
	}),
};