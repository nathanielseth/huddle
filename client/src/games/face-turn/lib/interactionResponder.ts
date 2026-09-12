import type { PendingInteractionView } from "@shared/games/face-turn/types";

// usually actorId, but some interactions use a different chooser
export function getInteractionResponder(pi: PendingInteractionView): string {
	if (pi.type === "choose_crew_to_turn") return pi.chooserPlayerId;
	if (pi.type === "truth_serum_reveal") return pi.targetPlayerId;
	return pi.actorId;
}
