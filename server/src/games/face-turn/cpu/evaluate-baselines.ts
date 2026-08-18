import { FACETURN_CONSTANTS as C } from "../types";
import type { FaceturnServerPlayer, FaceturnServerState } from "../types";
import { getEnemies, getTeammates, resolveCrewClass } from "../effects";
import { VOID_PIECE_IDS } from "../cards";
import type { StateScore } from "./types";

const WIN_SCORE = 1;
const LOSS_SCORE = -1;

const WEIGHTS = {
	hpDiff: 1.0,
	armorFraction: 0.15,
	cashFraction: 0.08,
	handFraction: 0.06,
	faceUpCrewThreat: 0.05,
	executionRisk: 0.35,
	poisonExposure: 0.04,
	activeMoveValue: 0.02,
	voidPieceProgress: 0.12,
};

export function evaluatePreEngineValueBaseline(
	state: FaceturnServerState,
	seat: string,
): StateScore {
	if (state.phase === "finished") {
		return terminalScore(state, seat);
	}

	const self = state.players.get(seat);
	if (!self) return 0;

	const allies = [self, ...getTeammates(state, seat)];
	const enemies = getEnemies(state, seat);
	if (enemies.length === 0) return WIN_SCORE;

	const allyScore = teamScore(state, allies);
	const enemyScore = teamScore(state, enemies);

	return clamp(allyScore - enemyScore, -1.5, 1.5);
}

function terminalScore(state: FaceturnServerState, seat: string): StateScore {
	if (state.winnerId === null) return 0;
	const winner = state.players.get(state.winnerId);
	if (!winner) return 0;
	const seatPlayer = state.players.get(seat);
	if (!seatPlayer) return 0;
	return winner.teamIndex === seatPlayer.teamIndex ? WIN_SCORE : LOSS_SCORE;
}

function teamScore(
	state: FaceturnServerState,
	team: readonly FaceturnServerPlayer[],
): number {
	if (team.length === 0) return 0;
	let total = 0;
	for (const player of team) {
		total += playerScore(state, player);
	}
	return total / team.length;
}

function playerScore(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): number {
	if (state.eliminatedPlayers.has(player.playerId)) return -1;

	const hpFraction =
		player.bossMaxHp > 0 ? player.bossHp / player.bossMaxHp : 0;
	let score = WEIGHTS.hpDiff * (hpFraction * 2 - 1);

	const armorFraction = Math.min(
		1,
		player.bossMaxHp > 0 ? player.bossArmor / player.bossMaxHp : 0,
	);
	score += WEIGHTS.armorFraction * armorFraction;

	const cashFraction = softNormalize(player.cash, 8);
	score += WEIGHTS.cashFraction * cashFraction;

	const handFraction = softNormalize(player.hand.length, C.HAND_LIMIT);
	score += WEIGHTS.handFraction * handFraction;

	score += WEIGHTS.faceUpCrewThreat * faceUpCrewThreatValue(state, player);
	score += WEIGHTS.executionRisk * executionRiskValue(player);
	score -= WEIGHTS.poisonExposure * poisonExposureValue(state, player);
	score += WEIGHTS.activeMoveValue * activeMoveCount(player);
	score += WEIGHTS.voidPieceProgress * voidPieceProgress(player);

	return score;
}

function softNormalize(value: number, reference: number): number {
	if (reference <= 0) return 0;
	return Math.min(1, value / reference);
}

function faceUpCrewThreatValue(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): number {
	let value = 0;
	for (let i = 0; i < 2; i++) {
		const slot = i as 0 | 1;
		if (!player.crewIds[slot] || !player.crewTurned[slot]) continue;
		const isStriker = resolveCrewClass(player, slot, "striker") === true;
		value += isStriker ? 0.6 : 0.4;
	}
	void state;
	return value;
}

function executionRiskValue(player: FaceturnServerPlayer): number {
	let hidden = 0;
	for (let i = 0; i < 2; i++) {
		const slot = i as 0 | 1;
		if (player.crewIds[slot] && !player.crewTurned[slot]) hidden += 1;
	}
	if (hidden === 0) return -1;
	if (hidden === 1) return -0.25;
	return 0.05;
}

function poisonExposureValue(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): number {
	let total = 0;
	for (const [sourceId, damage] of player.incomingPoison) {
		if (state.eliminatedPlayers.has(sourceId)) continue;
		total += damage;
	}
	return player.bossMaxHp > 0 ? Math.min(1, total / player.bossMaxHp) : 0;
}

function activeMoveCount(player: FaceturnServerPlayer): number {
	return player.activeMoves.filter((m) => m !== null).length / 3;
}

function voidPieceProgress(player: FaceturnServerPlayer): number {
	const owned = VOID_PIECE_IDS.filter((id) =>
		player.activeMoves.includes(id),
	).length;
	return owned / VOID_PIECE_IDS.length;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}