import { getMovePostPlacementTarget } from "@shared/games/face-turn/card-display";
import type {
	FaceturnsState,
	CrewSlotView,
} from "@shared/games/face-turn/types";

export interface SecondaryLegalityContext {
	state: FaceturnsState;
	selfPlayerId: string;
}

export function isValidSecondaryTarget(
	moveId: string,
	slot: { playerId: string; slotIndex: number },
	ctx: SecondaryLegalityContext,
): boolean {
	const { state, selfPlayerId } = ctx;
	const postPlacement = getMovePostPlacementTarget(moveId);
	if (!postPlacement) return false;
	// only crew slot scopes reach armed; enemy_active and enemy_player have no slot pick
	if (
		postPlacement.scope !== "own_crew" &&
		postPlacement.scope !== "enemy_crew"
	) {
		return false;
	}

	const player = state.players[slot.playerId];
	if (!player || player.isEliminated) return false;

	const crewSlots: readonly CrewSlotView[] = player.crewSlots;
	const crewSlot = crewSlots[slot.slotIndex];
	if (!crewSlot || crewSlot.status === "empty") return false;

	const isSelf = slot.playerId === selfPlayerId;
	return postPlacement.scope === "own_crew" ? isSelf : !isSelf;
}