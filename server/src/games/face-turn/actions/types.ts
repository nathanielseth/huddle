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

// no‑op branch shape: returns state unchanged, only refreshes timer window if
// present. Pass rejectedFor/reason when this no-op is the direct result of
// rejecting a specific player's action (illegal target, insufficient cash,
// wrong phase, etc) — this surfaces a real "action_rejected" event to that
// player instead of leaving them staring at a UI that silently did nothing
// and guessing why. Omit both for no-ops that aren't actually a rejection
// (e.g. a phase handler that legitimately has nothing to do).
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