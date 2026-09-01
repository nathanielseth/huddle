import type {
	FaceturnsState,
	FaceturnsPlayerView,
} from "@shared/games/face-turn/types";

export function isPlayerExposed(player: FaceturnsPlayerView): boolean {
	// exposed when there's no face-down crew left to turn (including having
	// no crew at all), so the next strike executes the boss instead
	return player.crewSlots.every((slot) => slot.status === "face_up");
}

export function getEnemyPlayers(
	ft: FaceturnsState,
	playerId: string,
): FaceturnsPlayerView[] {
	const me = ft.players[playerId];
	if (!me) return [];
	return ft.turnOrder
		.filter((id) => id !== playerId && !ft.eliminatedPlayers.includes(id))
		.map((id) => ft.players[id])
		.filter(
			(p): p is FaceturnsPlayerView =>
				p !== undefined && p.teamIndex !== me.teamIndex,
		);
}

export function isPlayerOrTeammate(
	ft: FaceturnsState,
	candidateId: string,
	targetId: string,
): boolean {
	if (candidateId === targetId) return true;
	const candidate = ft.players[candidateId];
	const target = ft.players[targetId];
	if (!candidate || !target) return false;
	if (ft.eliminatedPlayers.includes(candidateId)) return false;
	return candidate.teamIndex === target.teamIndex;
}

export function isChallengeEligible(
	ft: FaceturnsState,
	playerId: string,
	canChallenge: boolean,
): boolean {
	// challenge window: anyone eligible. defend window: target or teammate. defend declared: original striker
	if (ft.phase === "challenge_window") return canChallenge;

	if (ft.phase === "defend_window") {
		const targetId = ft.pendingAction?.targetPlayerId;
		if (!ft.pendingAction || !targetId) return false;
		return isPlayerOrTeammate(ft, playerId, targetId);
	}

	if (ft.phase === "defend_declared") {
		// post-defend, actorId flips to the defender and targetPlayerId
		// becomes the original striker — see ChallengeBar's isOriginalStriker
		return ft.pendingAction?.targetPlayerId === playerId;
	}

	return false;
}