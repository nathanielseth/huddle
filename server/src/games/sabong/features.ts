import { SABONG_CONSTANTS } from "./types";

const R = SABONG_CONSTANTS.STAT_RANGES;

// computed at module load to stay in sync with STAT_RANGES
const SPREADS = {
	health: R.health[1] - R.health[0],
	attack: R.attack[1] - R.attack[0],
	defense: R.defense[1] - R.defense[0],
	speed: R.speed[1] - R.speed[0],
	critRate: R.critRate[1] - R.critRate[0],
	determination: R.determination[1] - R.determination[0],
} as const;

// order must match the weight vector indices; change requires retraining before deploy
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

// canonical feature extraction used by both prediction and training
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