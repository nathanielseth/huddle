import { getCardCode, evaluate } from "@pokertools/evaluator";
import { RANK_CHARS, SUIT_CHARS } from "../lib/cards";
import { PREFLOP_EQUITY_DATA } from "./equity/table";

// integer card code for rank r [0-12, A=12] and suit s [0-3]
function cc(r: number, s: number): number {
	const rank = RANK_CHARS[r];
	const suit = SUIT_CHARS[s];
	if (rank === undefined || suit === undefined) {
		throw new RangeError(
			`cc: out-of-bounds rank=${String(r)} suit=${String(s)}`,
		);
	}
	return getCardCode(`${rank}${suit}`);
}

const CARD_TO_SUIT = new Map<number, number>();
export const CARD_TO_RANK = new Map<number, number>();

for (let r = 0; r <= 12; r++) {
	for (let s = 0; s < 4; s++) {
		const code = cc(r, s);
		CARD_TO_SUIT.set(code, s);
		CARD_TO_RANK.set(code, r);
	}
}

export interface HandType {
	readonly index: number; // 0–168
	readonly name: string; // "AA", "AKs", "AKo"
	readonly r1: number; // high rank [0-12, A=12]
	readonly r2: number; // low rank (= r1 for pairs)
	readonly suited: boolean;
	readonly isPair: boolean;
	readonly combos: ReadonlyArray<readonly [number, number]>;
}

function buildHandTypes(): HandType[] {
	const types: HandType[] = [];
	let idx = 0;

	// 13 pairs: AA=0 … 22=12 (6 combos each)
	for (let r = 12; r >= 0; r--) {
		const combos: [number, number][] = [];
		for (let s1 = 0; s1 < 4; s1++)
			for (let s2 = s1 + 1; s2 < 4; s2++) combos.push([cc(r, s1), cc(r, s2)]);
		const rank = RANK_CHARS[r];
		if (rank === undefined)
			throw new RangeError(`buildHandTypes: bad rank ${String(r)}`);
		types.push({
			index: idx++,
			name: `${rank}${rank}`,
			r1: r,
			r2: r,
			suited: false,
			isPair: true,
			combos,
		});
	}

	// 78 suited: AKs=13 … 32s=90 (4 combos each)
	for (let r1 = 12; r1 >= 1; r1--)
		for (let r2 = r1 - 1; r2 >= 0; r2--) {
			const combos: [number, number][] = [];
			for (let s = 0; s < 4; s++) combos.push([cc(r1, s), cc(r2, s)]);
			const rank1 = RANK_CHARS[r1];
			const rank2 = RANK_CHARS[r2];
			if (rank1 === undefined || rank2 === undefined) {
				throw new RangeError(
					`buildHandTypes: bad ranks ${String(r1)},${String(r2)}`,
				);
			}
			types.push({
				index: idx++,
				name: `${rank1}${rank2}s`,
				r1,
				r2,
				suited: true,
				isPair: false,
				combos,
			});
		}

	// 78 offsuit: AKo=91 … 32o=168 (12 combos each)
	for (let r1 = 12; r1 >= 1; r1--)
		for (let r2 = r1 - 1; r2 >= 0; r2--) {
			const combos: [number, number][] = [];
			for (let s1 = 0; s1 < 4; s1++)
				for (let s2 = 0; s2 < 4; s2++)
					if (s1 !== s2) combos.push([cc(r1, s1), cc(r2, s2)]);
			const rank1 = RANK_CHARS[r1];
			const rank2 = RANK_CHARS[r2];
			if (rank1 === undefined || rank2 === undefined) {
				throw new RangeError(
					`buildHandTypes: bad ranks ${String(r1)},${String(r2)}`,
				);
			}
			types.push({
				index: idx++,
				name: `${rank1}${rank2}o`,
				r1,
				r2,
				suited: false,
				isPair: false,
				combos,
			});
		}

	return types; // 13 + 78 + 78 = 169
}

export const ALL_HAND_TYPES: readonly HandType[] =
	Object.freeze(buildHandTypes());

const PREFLOP_EQUITY: ReadonlyArray<Float32Array> = Object.freeze(
	PREFLOP_EQUITY_DATA.map((row) => new Float32Array(row)),
);

export type RangeWeights = Float32Array;

export function uniformRange(): RangeWeights {
	return new Float32Array(169).fill(1.0);
}

// builds a range with top topPct% of all 1326 combos, ranked by preflop equity
export function buildRangeByPercentile(
	topPct: number,
	numOpp: number,
): RangeWeights {
	const oppIdx = Math.min(Math.max(numOpp - 1, 0), 4);
	const pct = Math.max(0, Math.min(100, topPct));

	const sorted = Array.from(ALL_HAND_TYPES)
		.map((ht) => ({
			index: ht.index,
			equity: PREFLOP_EQUITY[ht.index]?.[oppIdx] ?? 0,
			n: ht.combos.length,
		}))
		.sort((a, b) => b.equity - a.equity);

	const target = Math.round((1326 * pct) / 100);
	const weights = new Float32Array(169);
	let included = 0;

	for (const { index, n } of sorted) {
		if (included >= target) break;
		const space = target - included;
		if (space >= n) {
			weights[index] = 1.0;
			included += n;
		} else {
			weights[index] = space / n;
			included = target;
		}
	}

	return weights;
}

// personality parameters for range inference
export interface RangeProfile {
	openRangePct: number;
	threeBetRangePct: number;
	coldCallPct: number;
}

function _intersectAndNormalize(
	a: RangeWeights,
	b: RangeWeights,
): RangeWeights {
	const result = new Float32Array(169);
	let maxWeight = 0;

	for (let i = 0; i < 169; i++) {
		const w = (a[i] ?? 0) * (b[i] ?? 0);
		result[i] = w;
		if (w > maxWeight) maxWeight = w;
	}

	if (maxWeight > 0) {
		for (let i = 0; i < 169; i++) result[i] = (result[i] ?? 0) / maxWeight;
	}

	return result;
}

// narrows opponent's preflop range based on observed action
export function narrowPreflopRange(
	current: RangeWeights,
	action: string,
	betToCall: number,
	bigBlind: number,
	profile: RangeProfile,
	numOpp: number,
	positionFactor: number,
): RangeWeights {
	const posMult = 0.55 + positionFactor * 0.45;

	if (action === "raise" || action === "all_in") {
		let basePct: number;

		if (betToCall <= bigBlind) {
			basePct = profile.openRangePct;
		} else if (betToCall <= bigBlind * 7) {
			basePct = profile.threeBetRangePct;
		} else {
			basePct = Math.max(3, profile.threeBetRangePct * 0.45);
		}

		const actionRange = buildRangeByPercentile(
			Math.max(3, basePct * posMult),
			numOpp,
		);

		return _intersectAndNormalize(current, actionRange);
	}

	if (action === "call") {
		const effectivePct = Math.max(8, profile.coldCallPct * posMult);
		const callRange = buildRangeByPercentile(effectivePct, numOpp);

		return _intersectAndNormalize(current, callRange);
	}

	return current;
}

// evaluates a hand type on the actual board
function _boardScore(
	ht: HandType,
	boardSet: ReadonlySet<number>,
	boardCodes: readonly number[],
): number {
	for (const [c0, c1] of ht.combos) {
		if (!boardSet.has(c0) && !boardSet.has(c1)) {
			return evaluate([c0, c1, ...boardCodes] as number[]);
		}
	}
	return 7462;
}

export interface BoardTexture {
	wetness: number;
	paired: boolean;
	monotone: boolean; // all board cards same suit (3+ cards)
}

export function computeBoardTexture(
	boardCodes: readonly number[],
): BoardTexture {
	if (boardCodes.length === 0)
		return { wetness: 0, paired: false, monotone: false };

	const n = boardCodes.length;
	const ranks = boardCodes.map((c) => CARD_TO_RANK.get(c) ?? 0);
	const suits = boardCodes.map((c) => CARD_TO_SUIT.get(c) ?? 0);

	const suitCounts = [0, 0, 0, 0];
	for (const s of suits) {
		suitCounts[s] = (suitCounts[s] ?? 0) + 1;
	}
	const maxSuit = Math.max(...suitCounts);
	const monotone = maxSuit === n && n >= 3;

	const flushness = (maxSuit - 1) / Math.max(1, n - 1);

	const sortedRanks = ranks.toSorted((a, b) => a - b);
	let connected = 0;
	for (let i = 0; i < n - 1; i++) {
		if ((sortedRanks[i + 1] ?? 0) - (sortedRanks[i] ?? 0) <= 2) connected++;
	}
	const connectivity = n > 1 ? connected / (n - 1) : 0;
	const paired = new Set(ranks).size < n;

	const wetness = Math.min(1, flushness * 0.5 + connectivity * 0.7);

	return { wetness, paired, monotone };
}

const CULL_BASE = 0.3;
const CULL_SCALE = 0.22;
const CULL_MAX = 0.65;

const CHECK_CULL_PCT = 0.2;

function _cull(
	result: Float32Array,
	scored: readonly { index: number; score: number }[],
	pct: number,
	removeWeakest: boolean,
): void {
	const totalCombos = ALL_HAND_TYPES.reduce(
		(s, ht) => s + ht.combos.length * (result[ht.index] ?? 0),
		0,
	);
	const target = totalCombos * pct;
	let removed = 0;

	const order = removeWeakest ? [...scored].reverse() : [...scored];

	for (const { index } of order) {
		if (removed >= target) break;
		const ht = ALL_HAND_TYPES[index];
		if (!ht) continue;

		const combos = ht.combos.length * (result[index] ?? 0);
		if (combos <= 0) continue;

		const space = target - removed;
		if (space >= combos) {
			result[index] = 0;
			removed += combos;
		} else {
			result[index] = (result[index] ?? 0) * ((combos - space) / combos);
			removed = target;
		}
	}
}

export function narrowPostflopRange(
	current: RangeWeights,
	action: string,
	boardCodes: readonly number[],
	betFraction = 0.5,
): RangeWeights {
	if (boardCodes.length === 0) return new Float32Array(current);

	const result = new Float32Array(current);
	const boardSet = new Set<number>(boardCodes);

	const scored: { index: number; score: number }[] = [];
	for (const ht of ALL_HAND_TYPES) {
		if ((result[ht.index] ?? 0) <= 0) continue;
		scored.push({
			index: ht.index,
			score: _boardScore(ht, boardSet, boardCodes),
		});
	}
	scored.sort((a, b) => a.score - b.score);

	if (action === "raise" || action === "all_in") {
		const { wetness } = computeBoardTexture(boardCodes);
		const adjustedBase = CULL_BASE * (1 - wetness * 0.5);
		const clamped = Math.max(0.2, Math.min(betFraction, 3));
		const cullPct = Math.min(CULL_MAX, adjustedBase + clamped * CULL_SCALE);
		_cull(result, scored, cullPct, true);
	} else if (action === "check") {
		_cull(result, scored, CHECK_CULL_PCT, false);
	} else if (action === "call") {
		const clamped = Math.max(0.2, Math.min(betFraction, 2.0));
		_cull(result, scored, 0.1 + clamped * 0.08, false);
	}

	return result;
}

export interface WeightedCombo {
	c0: number;
	c1: number;
	weight: number;
}

function buildWeightedCombos(
	range: RangeWeights,
	blocked: ReadonlySet<number>,
): WeightedCombo[] {
	const result: WeightedCombo[] = [];
	let totalWeight = 0;

	for (const ht of ALL_HAND_TYPES) {
		const w = range[ht.index] ?? 0;
		if (w <= 0) continue;
		for (const [c0, c1] of ht.combos) {
			if (blocked.has(c0) || blocked.has(c1)) continue;
			result.push({ c0, c1, weight: w });
			totalWeight += w;
		}
	}

	if (totalWeight > 0) {
		for (const combo of result) combo.weight /= totalWeight;
	}

	return result;
}

export interface ComboAlias {
	readonly combos: readonly WeightedCombo[];
	readonly prob: Float64Array;
	readonly alias: Int32Array;
}

export function buildComboAlias(
	range: RangeWeights,
	blocked: ReadonlySet<number>,
): ComboAlias {
	const combos = buildWeightedCombos(range, blocked);
	const n = combos.length;

	if (n === 0) {
		return { combos, prob: new Float64Array(0), alias: new Int32Array(0) };
	}

	const prob = new Float64Array(n);
	const alias = new Int32Array(n);
	const scaled = new Float64Array(n);
	const small: number[] = [];
	const large: number[] = [];

	for (let i = 0; i < n; i++) {
		scaled[i] = (combos[i]?.weight ?? 0) * n;
		((scaled[i] ?? 0) < 1 ? small : large).push(i);
	}

	while (small.length > 0 && large.length > 0) {
		const s = small.pop();
		const l = large.pop();
		// both are guaranteed non-undefined
		if (s === undefined || l === undefined) break;
		prob[s] = scaled[s] ?? 0;
		alias[s] = l;
		scaled[l] = (scaled[l] ?? 0) + (scaled[s] ?? 0) - 1;
		((scaled[l] ?? 0) < 1 ? small : large).push(l);
	}
	for (const i of small) prob[i] = 1;
	for (const i of large) prob[i] = 1;

	return { combos, prob, alias };
}

export function sampleComboAlias(ca: ComboAlias): [number, number] | null {
	if (ca.combos.length === 0) return null;
	const i = (Math.random() * ca.combos.length) | 0;
	const targetIndex =
		Math.random() < (ca.prob[i] ?? 0) ? i : (ca.alias[i] ?? 0);
	const combo = ca.combos[targetIndex];
	if (!combo) return null;

	return [combo.c0, combo.c1];
}