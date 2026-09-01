import {
	getMoveDisplay,
	getMovePostPlacementTarget,
	getMoveTargetKind,
} from "@shared/games/face-turn/card-display";
import type { FaceturnsAction } from "@shared/games/face-turn/schemas";
import type { BoardTarget } from "../hooks/boardTargetRegistry";

export type PlayMoveAction = Extract<FaceturnsAction, { type: "play_move" }>;
export type ChainPlayAction = Extract<
	FaceturnsAction,
	{ type: "chain_play_burst" | "chain_play_slow" }
>;

export interface SecondaryPick {
	slotIndex: number;
}

// shared across play_move and chain actions: same board target maps to same fields
function primaryTargetFields(
	target: BoardTarget,
): Partial<
	Pick<
		PlayMoveAction,
		"targetPlayerId" | "targetCrewSlot" | "targetActiveMoveSlot"
	>
> {
	switch (target.kind) {
		case "boss":
		case "player":
			return { targetPlayerId: target.playerId };
		case "crew":
			return {
				targetPlayerId: target.playerId,
				targetCrewSlot: target.slotIndex,
			};
		case "active":
			return {
				targetPlayerId: target.playerId,
				targetActiveMoveSlot: target.slotIndex,
			};
		case "own_board_area":
			return {};
		case "discard":
			// discard drops are intercepted before here; throw catches wiring changes
			throw new Error(`"discard" is not a valid move target`);
	}
}

function applySecondaryPick(
	base: Record<string, unknown>,
	moveId: string,
	secondaryPick: SecondaryPick | undefined,
): void {
	if (!secondaryPick) return;
	const postPlacement = getMovePostPlacementTarget(moveId);
	// field name varies per move; getMovePostPlacementTarget().field is the source of truth
	if (postPlacement?.field) {
		base[postPlacement.field] = secondaryPick.slotIndex;
	}
}

export function resolvePlayMoveAction(
	moveId: string,
	primaryTarget: BoardTarget,
	secondaryPick?: SecondaryPick,
): PlayMoveAction {
	const base: PlayMoveAction = { type: "play_move", moveId };

	if (getMoveTargetKind(moveId) === "no_target") {
		if (
			getMoveDisplay(moveId).moveType === "active" &&
			primaryTarget.kind === "active"
		) {
			Object.assign(base, { placeInActiveSlot: primaryTarget.slotIndex });
		}
		return base;
	}

	Object.assign(base, primaryTargetFields(primaryTarget));
	applySecondaryPick(base, moveId, secondaryPick);

	return base;
}

// active moves never enter a chain, so no placeInActiveSlot case here
export function resolveChainPlayAction(
	moveId: string,
	primaryTarget: BoardTarget,
	secondaryPick?: SecondaryPick,
): ChainPlayAction {
	const type =
		getMoveDisplay(moveId).moveType === "burst"
			? "chain_play_burst"
			: "chain_play_slow";
	const base = { type, moveId } as ChainPlayAction;

	if (getMoveTargetKind(moveId) === "no_target") return base;

	Object.assign(base, primaryTargetFields(primaryTarget));
	applySecondaryPick(base, moveId, secondaryPick);

	return base;
}