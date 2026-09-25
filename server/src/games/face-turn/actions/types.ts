import type { GameContext, EngineResult } from "../../../engine/GameEngine";
import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type { FaceturnsAction } from "../schemas";
import { makeResult } from "../action-results";

// signature all phase onAction handlers implement
// player is already looked up by dispatcher, so phase handlers don't re-check presence
export type PhaseActionHandler = (
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	playerId: string,
	action: FaceturnsAction,
	ctx: GameContext,
) => EngineResult;

// no-op branch: returns state unchanged, refreshing only the timer window if present
// pass rejectedFor/reason for a direct rejection so the player gets an "action_rejected" event instead of silence
export function noOpResult(
	state: FaceturnServerState,
	ctx: GameContext,
	rejection?: { rejectedFor: string; reason: string },
): EngineResult {
	return makeResult(state, ctx.room.timer?.duration ?? null, {
		...(rejection && {
			actionRejections: new Map([[rejection.rejectedFor, rejection.reason]]),
		}),
	});
}