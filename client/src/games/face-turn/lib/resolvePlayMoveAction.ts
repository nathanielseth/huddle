import {
	getMoveDisplay,
	getMovePostPlacementTarget,
	getMoveTargetKind,
} from "@shared/games/face-turn/card-display";
import type { FaceturnsAction } from "@shared/games/face-turn/schemas";
import type { BoardTarget } from "../hooks/boardTargetRegistry";
import type { SecondaryPick } from "../hooks/useArmedMove";

export type PlayMoveAction = Extract<FaceturnsAction, { type: "play_move" }>;
export type ChainPlayAction = Extract<
	FaceturnsAction,
	{ type: "chain_play_burst" | "chain_play_slow" }
>;

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
	if (!postPlacement) return;
	// own_crew scope targets the caster implicitly, so only the slot matters;
	// enemy_crew scope needs the opponent's id too, since it's ambiguous otherwise
	if (postPlacement.scope === "enemy_crew") {
		base.targetPlayerId = secondaryPick.playerId;
		base.targetCrewSlot = secondaryPick.slotIndex;
	} else if (postPlacement.field) {
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
		applySecondaryPick(base, moveId, secondaryPick);
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