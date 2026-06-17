import { SABONG_CONSTANTS } from "./types";

const R = SABONG_CONSTANTS.STAT_RANGES;

// per-stat value ranges for normalising raw deltas to [-1, 1].
// derived from STAT_RANGES at module load so they never drift
const SPREADS = {
	health: R.health[1] - R.health[0],
	attack: R.attack[1] - R.attack[0],
	defense: R.defense[1] - R.defense[0],
	speed: R.speed[1] - R.speed[0],
	critRate: R.critRate[1] - R.critRate[0],
	determination: R.determination[1] - R.determination[0],
} as const;

// ordered feature names — index N corresponds to index N in the weight vector.
// add or remove entries here AND retrain before deploying new weights
export const FEATURE_NAMES = [
	"health",
	"attack",
	"defense",
	"speed",
	"critRate",
	"determination",
	"health_attack",
	"attack_crit",
	"defense_health",
	"speed_attack",
	"attack_sq",
	"defense_sq",
	"health_sq",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export interface FeatureInput {
	health: number;
	attack: number;
	defense: number;
	speed: number;
	critRate: number;
	determination: number;
}

// extracts the 13-dimensional feature vector representing fighter a's advantage
// over fighter b. all values normalised to roughly [-1, 1].
// single source of truth — imported by odds.ts (prediction) and calibrate.ts (training)
export function extractFeatures(a: FeatureInput, b: FeatureInput): number[] {
	const h = (a.health - b.health) / SPREADS.health;
	const atk = (a.attack - b.attack) / SPREADS.attack;
	const d = (a.defense - b.defense) / SPREADS.defense;
	const s = (a.speed - b.speed) / SPREADS.speed;
	const c = (a.critRate - b.critRate) / SPREADS.critRate;
	const det = (a.determination - b.determination) / SPREADS.determination;

	return [
		h,
		atk,
		d,
		s,
		c,
		det,
		h * atk, // health_attack
		atk * c, // attack_crit
		d * h, // defense_health
		s * atk, // speed_attack
		atk * atk, // attack_sq
		d * d, // defense_sq
		h * h, // health_sq
	];
}