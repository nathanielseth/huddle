import type { FighterStats } from "./battle.js";

export interface OddsResult {
	probability: { fighter1: number; fighter2: number };
	moneyline: { fighter1: number; fighter2: number };
}
import { SABONG_CONSTANTS } from "./types.js";

// stat normalization

const R = SABONG_CONSTANTS.STAT_RANGES;

// precomputed spreads, must match calibrate.ts exactly.
const SPREADS = {
	health: R.health[1] - R.health[0], // 60
	attack: R.attack[1] - R.attack[0], // 60
	defense: R.defense[1] - R.defense[0], // 60
	speed: R.speed[1] - R.speed[0], // 50
	critRate: R.critRate[1] - R.critRate[0], // 80
	determination: R.determination[1] - R.determination[0], // 5
} as const;

// from calibrate script
export const WEIGHTS = {
	health: 0.6294,
	attack: 1.5171,
	defense: 0.8763,
	speed: 0.2849,
	critRate: 0.4038,
	determination: 0.0879,
	health_attack: 0.0009,
	attack_crit: 0.0013,
	defense_health: -0.0007,
	speed_attack: -0.0087,
	attack_sq: -0.0102,
	defense_sq: 0.0015,
	health_sq: -0.0037,
} as const;

export type HeuristicWeights = typeof WEIGHTS;

// steepness controls how sharply probability diverges from 0.5
const SIGMOID_STEEPNESS = 3.2;

// core mafs

function sigmoid(x: number): number {
	return 1.0 / (1.0 + Math.exp(-x));
}

function norm(delta: number, spread: number): number {
	return delta / spread;
}

// public api

// predicts fighter1's win probability
export function predictWinProbability(
	f1: FighterStats,
	f2: FighterStats,
	weights: HeuristicWeights = WEIGHTS,
): number {
	const h = norm(f1.health - f2.health, SPREADS.health);
	const a = norm(f1.attack - f2.attack, SPREADS.attack);
	const d = norm(f1.defense - f2.defense, SPREADS.defense);
	const s = norm(f1.speed - f2.speed, SPREADS.speed);
	const c = norm(f1.critRate - f2.critRate, SPREADS.critRate);
	const det = norm(f1.determination - f2.determination, SPREADS.determination);

	const score =
		h * weights.health +
		a * weights.attack +
		d * weights.defense +
		s * weights.speed +
		c * weights.critRate +
		det * weights.determination +
		h * a * weights.health_attack +
		a * c * weights.attack_crit +
		d * h * weights.defense_health +
		s * a * weights.speed_attack +
		a * a * weights.attack_sq +
		d * d * weights.defense_sq +
		h * h * weights.health_sq;

	return Math.min(Math.max(sigmoid(score * SIGMOID_STEEPNESS), 0.02), 0.98);
}

function probabilityToMoneyline(p: number): number {
	if (p >= 0.5) return Math.round(-100 * (p / (1 - p)));
	return Math.round(100 * ((1 - p) / p));
}

export function getMatchupOdds(
	fighter1: FighterStats,
	fighter2: FighterStats,
): OddsResult {
	const p1 = predictWinProbability(fighter1, fighter2);
	const p2 = 1 - p1;
	return {
		probability: { fighter1: p1, fighter2: p2 },
		moneyline: {
			fighter1: probabilityToMoneyline(p1),
			fighter2: probabilityToMoneyline(p2),
		},
	};
}
