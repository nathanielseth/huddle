import type { BattleEvent } from "../../../../shared/sabong.js";
import { SABONG_CONSTANTS } from "./types.js";

const { CRIT_MULTIPLIER, MAX_TURNS, MAX_ATTACK_BOOST, MONTE_CARLO_SIMS } =
	SABONG_CONSTANTS;

// types
export interface FighterStats {
	id: string;
	health: number;
	attack: number;
	defense: number;
	speed: number;
	critRate: number;
	determination: number;
}
export interface OddsResult {
	probability: { fighter1: number; fighter2: number };
	moneyline: { fighter1: number; fighter2: number };
}
export interface BattleResult {
	winnerId: string;
	loserId: string;
	log: BattleEvent[];
}

// constants
const MOVE_ACCURACY = 0.9;
const BUFF_INCREMENT = 20;
const POWER_SCALE = Math.pow(20 / 150, 0.7);

// derived stats
interface DerivedStats {
	varRange: number; // 0.25 / (1 + speed * 0.01)
	effDef: number; // max(defense * (1 - det * 0.02), 1)
}

function deriveFighterStats(f: FighterStats): DerivedStats {
	return {
		varRange: 0.25 / (1.0 + f.speed * 0.01),
		effDef: Math.max(f.defense * (1.0 - f.determination * 0.02), 1.0),
	};
}

// move selection
type Move = "buff" | "strike" | "double_strike";

function selectMove(atBoostCap: boolean): Move {
	const roll = Math.random();
	if (!atBoostCap && roll < 0.25) return "buff";
	if (roll < 0.625) return "strike";
	return "double_strike";
}

// used in simulateBattle
function calcDamage(
	atk: number,
	critRate: number,
	varRange: number,
	effDef: number,
): [damage: number, isCrit: boolean] {
	const isCrit = Math.random() * 100 <= critRate;
	const critMult = isCrit ? CRIT_MULTIPLIER : 1.0;
	const base = (2.5 * atk * atk) / (3.5 * effDef + atk);
	const variance = 1.0 - varRange * Math.random();
	return [
		Math.max(Math.round(base * POWER_SCALE * variance * critMult), 1),
		isCrit,
	];
}
// used in mcAttack only, where we don't need isCrit
function calcDamageFast(
	atk: number,
	critRate: number,
	varRange: number,
	effDef: number,
): number {
	const critMult = Math.random() * 100 <= critRate ? CRIT_MULTIPLIER : 1.0;
	const base = (2.5 * atk * atk) / (3.5 * effDef + atk);
	return Math.max(
		Math.round(base * POWER_SCALE * (1 - varRange * Math.random()) * critMult),
		1,
	);
}

// mc attack
const _mcResult = { dmg: 0, boost: 0 };

function mcAttack(
	atk: number,
	critRate: number,
	varRange: number,
	effDef: number,
	boost: number,
): void {
	const atBoostCap = boost >= MAX_ATTACK_BOOST;
	const move = selectMove(atBoostCap);

	if (move === "buff") {
		_mcResult.dmg = 0;
		_mcResult.boost = Math.min(boost + BUFF_INCREMENT, MAX_ATTACK_BOOST);
		return;
	}

	const effectiveAtk = atk + boost;
	let dmg = 0;

	if (Math.random() <= MOVE_ACCURACY)
		dmg += calcDamageFast(effectiveAtk, critRate, varRange, effDef);
	if (move === "double_strike" && Math.random() <= MOVE_ACCURACY)
		dmg += calcDamageFast(effectiveAtk, critRate, varRange, effDef);

	_mcResult.dmg = dmg;
	_mcResult.boost = boost; // unchanged on attack moves
}

// odds conversion
function probabilityToMoneyline(p: number): number {
	if (p >= 0.5) return Math.round(-100 * (p / (1 - p)));
	return Math.round(100 * ((1 - p) / p));
}

// monte carlo odds
export function getMatchupOdds(
	fighter1: FighterStats,
	fighter2: FighterStats,
	iterations: number = MONTE_CARLO_SIMS,
): OddsResult {
	const d1 = deriveFighterStats(fighter1);
	const d2 = deriveFighterStats(fighter2);

	// hoist to locals
	const h1 = fighter1.health,
		a1 = fighter1.attack,
		cr1 = fighter1.critRate,
		s1 = fighter1.speed;
	const h2 = fighter2.health,
		a2 = fighter2.attack,
		cr2 = fighter2.critRate,
		s2 = fighter2.speed;
	const vr1 = d1.varRange,
		ed1 = d1.effDef;
	const vr2 = d2.varRange,
		ed2 = d2.effDef;
 
	const f1AlwaysFirst = s1 > s2;
	const f2AlwaysFirst = s2 > s1;

	let fighter1Wins = 0;

	for (let i = 0; i < iterations; i++) {
		let hp1 = h1,
			hp2 = h2,
			boost1 = 0,
			boost2 = 0;
		let fighter1Won = false;

		const fighter1GoesFirst = f1AlwaysFirst
			? true
			: f2AlwaysFirst
				? false
				: Math.random() < 0.5;

		for (let turn = 0; turn < MAX_TURNS; turn++) {
			if (fighter1GoesFirst) {
				mcAttack(a1, cr1, vr1, ed2, boost1);
				boost1 = _mcResult.boost;
				hp2 -= _mcResult.dmg;
				if (hp2 <= 0) {
					fighter1Won = true;
					break;
				}

				mcAttack(a2, cr2, vr2, ed1, boost2);
				boost2 = _mcResult.boost;
				hp1 -= _mcResult.dmg;
				if (hp1 <= 0) break;
			} else {
				mcAttack(a2, cr2, vr2, ed1, boost2);
				boost2 = _mcResult.boost;
				hp1 -= _mcResult.dmg;
				if (hp1 <= 0) break;

				mcAttack(a1, cr1, vr1, ed2, boost1);
				boost1 = _mcResult.boost;
				hp2 -= _mcResult.dmg;
				if (hp2 <= 0) {
					fighter1Won = true;
					break;
				}
			}
		}

		// timeout
		if (!fighter1Won && hp1 > 0 && hp2 > 0) {
			if (hp1 > hp2) fighter1Won = true;
			else if (hp1 === hp2) fighter1Won = Math.random() < 0.5;
		}

		if (fighter1Won) fighter1Wins++;
	}

	const p1 = fighter1Wins / iterations;
	const p2 = 1 - p1;

	return {
		probability: { fighter1: p1, fighter2: p2 },
		moneyline: {
			fighter1: probabilityToMoneyline(p1),
			fighter2: probabilityToMoneyline(p2),
		},
	};
}

// full battle sim
export function simulateBattle(
	fighter1: FighterStats,
	fighter2: FighterStats,
): BattleResult {
	const d1 = deriveFighterStats(fighter1);
	const d2 = deriveFighterStats(fighter2);

	const log: BattleEvent[] = [];
	let winnerId: string | null = null;

	// ref objects
	const hp1Ref = { v: fighter1.health };
	const hp2Ref = { v: fighter2.health };
	const boost1Ref = { v: 0 };
	const boost2Ref = { v: 0 };

	const execMove = (
		turn: number,
		attacker: FighterStats,
		attackerBoost: { v: number },
		attackerDerived: DerivedStats,
		defenderHp: { v: number },
		defenderDerived: DerivedStats,
	): "ko" | "continue" => {
		const atBoostCap = attackerBoost.v >= MAX_ATTACK_BOOST;
		const move = selectMove(atBoostCap);

		if (move === "buff") {
			attackerBoost.v = Math.min(
				attackerBoost.v + BUFF_INCREMENT,
				MAX_ATTACK_BOOST,
			);
			log.push({
				type: "buff",
				turn,
				attackerId: attacker.id,
				newAttackBoost: attackerBoost.v,
			});
			return "continue";
		}

		const effectiveAtk = attacker.attack + attackerBoost.v;

		// first hit
		if (Math.random() <= MOVE_ACCURACY) {
			const [dmg, isCrit] = calcDamage(
				effectiveAtk,
				attacker.critRate,
				attackerDerived.varRange,
				defenderDerived.effDef,
			);
			defenderHp.v = Math.max(defenderHp.v - dmg, 0);
			log.push({
				type: "move",
				turn,
				attackerId: attacker.id,
				move,
				damage: dmg,
				crit: isCrit,
				defenderHp: defenderHp.v,
			});
			if (defenderHp.v <= 0) return "ko";
		} else {
			log.push({ type: "miss", turn, attackerId: attacker.id, move });
		}

		// second hit (double_strike only)
		if (move === "double_strike" && Math.random() <= MOVE_ACCURACY) {
			const [dmg, isCrit] = calcDamage(
				effectiveAtk,
				attacker.critRate,
				attackerDerived.varRange,
				defenderDerived.effDef,
			);
			defenderHp.v = Math.max(defenderHp.v - dmg, 0);
			log.push({
				type: "move",
				turn,
				attackerId: attacker.id,
				move: "double_strike",
				damage: dmg,
				crit: isCrit,
				defenderHp: defenderHp.v,
			});
			if (defenderHp.v <= 0) return "ko";
		}

		return "continue";
	};

	const fighter1GoesFirst =
		fighter1.speed > fighter2.speed
			? true
			: fighter2.speed > fighter1.speed
				? false
				: Math.random() < 0.5;

	const first = fighter1GoesFirst ? fighter1 : fighter2;
	const second = fighter1GoesFirst ? fighter2 : fighter1;
	const firstBoost = fighter1GoesFirst ? boost1Ref : boost2Ref;
	const secondBoost = fighter1GoesFirst ? boost2Ref : boost1Ref;
	const firstDerived = fighter1GoesFirst ? d1 : d2;
	const secondDerived = fighter1GoesFirst ? d2 : d1;
	const firstDefHp = fighter1GoesFirst ? hp2Ref : hp1Ref;
	const secondDefHp = fighter1GoesFirst ? hp1Ref : hp2Ref;
	const firstDefDerived = fighter1GoesFirst ? d2 : d1;
	const secondDefDerived = fighter1GoesFirst ? d1 : d2;

	outer: for (let turn = 1; turn <= MAX_TURNS; turn++) {
		if (
			execMove(
				turn,
				first,
				firstBoost,
				firstDerived,
				firstDefHp,
				firstDefDerived,
			) === "ko"
		) {
			winnerId = first.id;
			break outer;
		}
		if (
			execMove(
				turn,
				second,
				secondBoost,
				secondDerived,
				secondDefHp,
				secondDefDerived,
			) === "ko"
		) {
			winnerId = second.id;
			break outer;
		}
	}

	// timeout resolution
	if (winnerId === null) {
		if (hp1Ref.v > hp2Ref.v) {
			winnerId = fighter1.id;
			log.push({
				type: "timeout",
				winnerId: fighter1.id,
				reason: "hp_advantage",
			});
		} else if (hp2Ref.v > hp1Ref.v) {
			winnerId = fighter2.id;
			log.push({
				type: "timeout",
				winnerId: fighter2.id,
				reason: "hp_advantage",
			});
		} else {
			winnerId = Math.random() < 0.5 ? fighter1.id : fighter2.id;
			log.push({ type: "timeout", winnerId, reason: "coinflip" });
		}
	} else {
		log.push({
			type: "ko",
			loserId: winnerId === fighter1.id ? fighter2.id : fighter1.id,
		});
	}

	return {
		winnerId,
		loserId: winnerId === fighter1.id ? fighter2.id : fighter1.id,
		log,
	};
}
