import type { InteractionSpec, PendingInteraction } from "./types";
import type { FaceturnServerPlayer } from "../types";
import { getEnemies } from "../effects";

type Interaction = Extract<PendingInteraction, { type: "peek_discard" }>;

function removeCardFromFirstHolder(
	players: readonly FaceturnServerPlayer[],
	cardId: string,
): FaceturnServerPlayer | null {
	for (const player of players) {
		const idx = player.hand.indexOf(cardId);
		if (idx === -1) continue;
		player.hand.splice(idx, 1);
		player.discardPile.push(cardId);
		player.totalCardsDiscarded++;
		return player;
	}
	return null;
}

export const peekDiscardSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_peek_discard",

	resolve(state, interaction, action, respondingPlayer) {
		void respondingPlayer;
		if (action.type !== "resolve_peek_discard") return null;
		const chosen = action.discardMoveId;
		if (
			chosen !== interaction.revealedCards[0] &&
			chosen !== interaction.revealedCards[1]
		)
			return null;

		const enemies = getEnemies(state, interaction.actorId);
		removeCardFromFirstHolder(enemies, chosen);
		state.pendingInteraction = null;
		return { kind: "raw_result" };
	},

	applyTimeoutDefault(state, interaction) {
		const chosen = interaction.revealedCards[0];
		const enemies = getEnemies(state, interaction.actorId);
		removeCardFromFirstHolder(enemies, chosen);
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "peek_discard",
		actorId: interaction.actorId,
	}),
};