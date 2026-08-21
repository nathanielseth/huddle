import type { GameContext, EngineResult } from "../../../engine/GameEngine";
import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type { FaceturnsAction } from "../schemas";
import { makeResult } from "../action-results";

// signature all phase onAction handlers implement
// player is already looked up by dispatcher, so phase handlers don’t re‑check presence
export type PhaseActionHandler = (
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	playerId: string,
	action: FaceturnsAction,
	ctx: GameContext,
) => EngineResult;

// no‑op branch shape: returns state unchanged, only refreshes timer window if present
export function noOpResult(state: FaceturnServerState, ctx: GameContext): EngineResult {
	return makeResult(state, ctx.room.timer?.duration ?? null);
}