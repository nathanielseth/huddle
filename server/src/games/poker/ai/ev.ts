export function gaussianSample(stdDev: number): number {
	const u1 = Math.random() + Number.EPSILON; // guard against log(0)
	const u2 = Math.random();
	const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	return z * stdDev;
}

// break-even equity for a call. returns 0 when callAmount is 0 (free action)
export function computePotOdds(callAmount: number, pot: number): number {
	if (callAmount <= 0) return 0;
	return callAmount / (pot + callAmount);
}

// net EV of calling: equity × (pot + callAmount) − callAmount
export function callEV(
	equity: number,
	callAmount: number,
	pot: number,
): number {
	return equity * (pot + callAmount) - callAmount;
}

// net EV of a bluff attempt: foldEquity × pot − (1 − foldEquity) × bluffCost
// second gate
export function bluffEV(
	foldEquity: number,
	pot: number,
	bluffCost: number,
): number {
	return foldEquity * pot - (1 - foldEquity) * bluffCost;
}

// stack-to-pot ratio: hero's effective stack / pot
export function stackToPotRatio(effectiveStack: number, pot: number): number {
	return pot <= 0 ? Infinity : effectiveStack / pot;
}

export const BET_FRACTIONS = [0.33, 0.67, 1.0, 1.5] as const;

export function sampleBetFraction(
	baseWeights: readonly [number, number, number, number],
	spr: number,
	streetIndex: number,
): number {
	const w: [number, number, number, number] = [
		baseWeights[0],
		baseWeights[1],
		baseWeights[2],
		baseWeights[3],
	];

	// deep-stacked: build pot regardless of hand strength
	if (spr > 6) {
		w[2] *= 1.3;
		w[3] *= 1.4;
	}

	if (streetIndex === 3) {
		w[1] *= 0.5;
		w[2] *= 1.2;
		w[3] *= 1.4;
	}

	const total = w[0] + w[1] + w[2] + w[3];
	let roll = Math.random() * total;

	for (let i = 0; i < 4; i++) {
		roll -= w[i]!;
		if (roll <= 0) return BET_FRACTIONS[i]!;
	}

	return BET_FRACTIONS[2]!;
}

// converts fraction-of-pot into concrete raise-to chip total: raiseTo = betLevel + effectivePot × fraction
export function fractionToBetAmount(
	fraction: number,
	effectivePot: number,
	betLevel: number,
): number {
	return Math.round(betLevel + effectivePot * fraction);
}

// estimates probability opponents fold to a bet
export function estimateFoldEquity(
	activeOpponents: number,
	aggression: number,
): number {
	if (activeOpponents <= 0) return 0;

	const baseRate = 0.46 - (activeOpponents - 1) * 0.14;
	const adjusted = baseRate * (0.7 + aggression * 0.6);
	return Math.max(0.04, Math.min(0.62, adjusted));
}

// range penalty for multi-way pots
export function multiWayPenalty(numOpponents: number): number {
	return Math.max(0.5, 1.0 - (numOpponents - 1) * 0.1);
}

// per-street scalar applied to sampled bet fraction in computeRaiseTo
export const STREET_SIZING_MULTIPLIER: readonly [
	number,
	number,
	number,
	number,
] = [0.78, 0.88, 1.0, 1.18] as const;