import type { BattleEvent } from "../../../../shared/sabong.js";
import { SABONG_CONSTANTS } from "./types.js";

const { CRIT_MULTIPLIER, MAX_TURNS, MAX_ATTACK_BOOST } = SABONG_CONSTANTS;

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
	varRange: number;
}

function deriveFighterStats(f: FighterStats): DerivedStats {
	return {
		varRange: 0.25 / (1.0 + f.speed * 0.01),
	};
}

function calcEffDef(
	defenderDefense: number,
	attackerDetermination: number,
): number {
	return Math.max(defenderDefense * (1.0 - attackerDetermination * 0.02), 1.0);
}

// move selection

type Move = "buff" | "strike" | "double_strike";

function selectMove(atBoostCap: boolean): Move {
	const roll = Math.random();
	if (!atBoostCap && roll < 0.25) return "buff";
	if (roll < 0.625) return "strike";
	return "double_strike";
}

// damage calculation

function calcDamage(
	atk: number,
	critRate: number,
	varRange: number,
	defenderDefense: number,
	attackerDetermination: number,
): [damage: number, isCrit: boolean] {
	const isCrit = Math.random() * 100 <= critRate;
	const critMult = isCrit ? CRIT_MULTIPLIER : 1.0;
	const effDef = calcEffDef(defenderDefense, attackerDetermination);
	const base = (2.5 * atk * atk) / (3.5 * effDef + atk);
	const variance = 1.0 - varRange * Math.random();
	return [
		Math.max(Math.round(base * POWER_SCALE * variance * critMult), 1),
		isCrit,
	];
}

export function simulateBattle(
	fighter1: FighterStats,
	fighter2: FighterStats,
): BattleResult {
	const d1 = deriveFighterStats(fighter1);
	const d2 = deriveFighterStats(fighter2);

	const log: BattleEvent[] = [];
	let winnerId: string | null = null;

	// ref objects let execmove mutate hp/boost without returning them
	const hp1Ref = { v: fighter1.health };
	const hp2Ref = { v: fighter2.health };
	const boost1Ref = { v: 0 };
	const boost2Ref = { v: 0 };

	const execMove = (
		turn: number,
		attacker: FighterStats,
		attackerBoost: { v: number },
		attackerDerived: DerivedStats,
		defender: FighterStats,
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
				defender.defense,
				attacker.determination,
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

		// second hit (double_strike only, both rolls are independent)
		if (move === "double_strike" && Math.random() <= MOVE_ACCURACY) {
			const [dmg, isCrit] = calcDamage(
				effectiveAtk,
				attacker.critRate,
				attackerDerived.varRange,
				defender.defense,
				attacker.determination,
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

	// speed tie 50/50
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

	outer: for (let turn = 1; turn <= MAX_TURNS; turn++) {
		if (
			execMove(
				turn,
				first,
				firstBoost,
				firstDerived,
				second,
				firstDefHp,
				secondDerived,
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
				first,
				secondDefHp,
				firstDerived,
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
