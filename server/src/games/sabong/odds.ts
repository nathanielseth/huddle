import type { FighterStats } from "./battle";
import { extractFeatures, FEATURE_NAMES } from "./features";

export interface OddsResult {
	probability: { fighter1: number; fighter2: number };
	moneyline: { fighter1: number; fighter2: number };
}

export type HeuristicWeights = Record<(typeof FEATURE_NAMES)[number], number>;

export const WEIGHTS: HeuristicWeights = {
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

const DEFAULT_WEIGHT_VECTOR: number[] = FEATURE_NAMES.map((n) => WEIGHTS[n]);
export const SIGMOID_STEEPNESS = 3.2;

function sigmoid(x: number): number {
	return 1.0 / (1.0 + Math.exp(-x));
}

function dotProduct(a: number[], b: number[]): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
	return sum;
}

// converts american moneyline to decimal payout multiplier
export function moneylineToDecimal(ml: number): number {
	if (ml > 0) return 1 + ml / 100;
	if (ml < 0) return 1 + 100 / Math.abs(ml);
	return 2.0; // unreachable in normal operation; safe fallback
}

function probabilityToMoneyline(p: number): number {
	if (p >= 0.5) return Math.round(-100 * (p / (1 - p)));
	return Math.round(100 * ((1 - p) / p));
}

// predicts fighter1's win probability using calibrated logistic model.
// clamped to [0.02, 0.98] so moneyline conversion never divides by zero
export function predictWinProbability(
	f1: FighterStats,
	f2: FighterStats,
	weights: HeuristicWeights = WEIGHTS,
): number {
	const wv =
		weights === WEIGHTS
			? DEFAULT_WEIGHT_VECTOR
			: FEATURE_NAMES.map((n) => weights[n]);
	const score = dotProduct(extractFeatures(f1, f2), wv);
	return Math.min(Math.max(sigmoid(score * SIGMOID_STEEPNESS), 0.02), 0.98);
}

// returns probability and american moneyline odds for a matchup.
// probability is authoritative; moneyline carries integer-rounding loss
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