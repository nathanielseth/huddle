import {
	getMoveDisplay,
	getMoveTargetKind,
} from "@shared/games/face-turn/card-display";
import type { FaceturnsState } from "@shared/games/face-turn/types";
import type { BoardTarget } from "../hooks/boardTargetRegistry";
import { useDraggedMoveId } from "../hooks/draggedMoveStore";
import { useFaceturnState } from "../hooks/useFaceturnState";

export interface LegalityContext {
	state: FaceturnsState;
	selfPlayerId: string;
}

export function isValidMoveTarget(
	moveId: string,
	candidate: BoardTarget,
	ctx: LegalityContext,
): boolean {
	const { state, selfPlayerId } = ctx;

	if (candidate.kind !== "own_board_area") {
		const candidatePlayer = state.players[candidate.playerId];
		if (!candidatePlayer || candidatePlayer.isEliminated) return false;
	}

	// fail closed so an in-progress drag doesn't break if the move is unknown
	let kind: ReturnType<typeof getMoveTargetKind>;
	try {
		kind = getMoveTargetKind(moveId);
	} catch (err) {
		console.error(
			`[face-turn] isValidMoveTarget: no MoveTargetKind for "${moveId}"`,
			err,
		);
		return false;
	}
	const selfPlayer = state.players[selfPlayerId];
	if (!selfPlayer) return false;

	const isSelf = candidate.playerId === selfPlayerId;
	const sameTeam =
		candidate.kind === "own_board_area"
			? true
			: state.players[candidate.playerId].teamIndex === selfPlayer.teamIndex;

	switch (kind) {
		case "enemy_boss":
			return candidate.kind === "boss" && !sameTeam;
		case "enemy_crew":
			return candidate.kind === "crew" && !sameTeam;
		case "enemy_active":
			return candidate.kind === "active" && !sameTeam;
		case "enemy_player":
			return !sameTeam && candidate.kind !== "own_board_area";
		case "ally_crew":
			return candidate.kind === "crew" && sameTeam;
		case "ally_player":
			return (
				sameTeam &&
				candidate.kind !== "own_board_area" &&
				candidate.kind !== "discard"
			);
		case "ally_teammate":
			return (
				sameTeam &&
				!isSelf &&
				candidate.kind !== "own_board_area" &&
				candidate.kind !== "discard"
			);
		case "ally_self":
			return isSelf && candidate.kind !== "discard";
		case "no_target": {
			if (getMoveDisplay(moveId).moveType === "active") {
				if (candidate.kind !== "active" || !isSelf) return false;
				const slot =
					state.players[selfPlayerId].activeMoveSlots[candidate.slotIndex];
				return slot !== undefined && slot.moveId === null;
			}
			// whole board is one drop zone for non-active no_target moves; registry always prefers specific kind over own_board_area
			return isSelf && candidate.kind !== "discard";
		}
	}
}

// only board wrapper should glow for non-active no_target moves, not individual cells
export function useIsLegalDropTarget(target: BoardTarget): boolean {
	const draggedMoveId = useDraggedMoveId();
	const { ft, playerId } = useFaceturnState();

	if (!draggedMoveId || !ft) return false;

	try {
		if (
			getMoveTargetKind(draggedMoveId) === "no_target" &&
			getMoveDisplay(draggedMoveId).moveType !== "active" &&
			target.kind !== "own_board_area"
		) {
			return false;
		}
	} catch {
		// unresolvable move id, let isValidMoveTarget fail closed
	}

	return isValidMoveTarget(draggedMoveId, target, {
		state: ft,
		selfPlayerId: playerId,
	});
}