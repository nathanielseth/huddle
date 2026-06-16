import type { BattleEvent } from "../../../../shared/games/sabong";
import { SABONG_CONSTANTS } from "./types";

const { CRIT_MULTIPLIER, MAX_TURNS, MAX_ATTACK_BOOST } = SABONG_CONSTANTS;

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

const MOVE_ACCURACY = 0.9;
const BUFF_INCREMENT = 20;

// normalises damage so fighters at midpoint stat ranges deal intended damage
const DAMAGE_REF_ATTACK = 20;
const DAMAGE_REF_DEFENSE = 150;
const POWER_SCALE = Math.pow(DAMAGE_REF_ATTACK / DAMAGE_REF_DEFENSE, 0.7);

// higher speed → tighter variance → more consistent damage output
function varRange(speed: number): number {
	return 0.25 / (1.0 + speed * 0.01);
}

// attacker's determination shreds a fraction of defender's defense.
// max determination (5) reduces effective defense by 10%
function effectiveDefense(defense: number, determination: number): number {
	return Math.max(defense * (1.0 - determination * 0.02), 1.0);
}

type Move = "buff" | "strike" | "double_strike";

function selectMove(atBoostCap: boolean): Move {
	const roll = Math.random();
	if (!atBoostCap && roll < 0.25) return "buff";
	if (roll < 0.625) return "strike";
	return "double_strike";
}

function calcDamage(
	atk: number,
	critRate: number,
	vr: number,
	defenderDefense: number,
	attackerDetermination: number,
): [damage: number, isCrit: boolean] {
	const isCrit = Math.random() * 100 <= critRate;
	const critMult = isCrit ? CRIT_MULTIPLIER : 1.0;
	const effDef = effectiveDefense(defenderDefense, attackerDetermination);
	const base = (2.5 * atk * atk) / (3.5 * effDef + atk);
	const variance = 1.0 - vr * Math.random();
	return [
		Math.max(Math.round(base * POWER_SCALE * variance * critMult), 1),
		isCrit,
	];
}

interface TurnResult {
	outcome: "ko" | "continue";
	attackerBoost: number;
	defenderHp: number;
}

// pure function — all state passed in and returned, no mutations
function execMove(
	turn: number,
	attacker: FighterStats,
	attackerVr: number,
	attackerBoost: number,
	defender: FighterStats,
	defenderHp: number,
	log: BattleEvent[],
): TurnResult {
	const atBoostCap = attackerBoost >= MAX_ATTACK_BOOST;
	const move = selectMove(atBoostCap);

	if (move === "buff") {
		const newBoost = Math.min(attackerBoost + BUFF_INCREMENT, MAX_ATTACK_BOOST);
		log.push({
			type: "buff",
			turn,
			attackerId: attacker.id,
			newAttackBoost: newBoost,
		});
		return { outcome: "continue", attackerBoost: newBoost, defenderHp };
	}

	const effectiveAtk = attacker.attack + attackerBoost;
	let currentDefHp = defenderHp;

	// first hit
	if (Math.random() <= MOVE_ACCURACY) {
		const [dmg, isCrit] = calcDamage(
			effectiveAtk,
			attacker.critRate,
			attackerVr,
			defender.defense,
			attacker.determination,
		);
		currentDefHp = Math.max(currentDefHp - dmg, 0);
		log.push({
			type: "move",
			turn,
			attackerId: attacker.id,
			move,
			damage: dmg,
			crit: isCrit,
			defenderHp: currentDefHp,
		});
		if (currentDefHp <= 0)
			return { outcome: "ko", attackerBoost, defenderHp: 0 };
	} else {
		log.push({ type: "miss", turn, attackerId: attacker.id, move });
	}

	// second hit — double_strike only, each accuracy roll independent
	if (move === "double_strike" && Math.random() <= MOVE_ACCURACY) {
		const [dmg, isCrit] = calcDamage(
			effectiveAtk,
			attacker.critRate,
			attackerVr,
			defender.defense,
			attacker.determination,
		);
		currentDefHp = Math.max(currentDefHp - dmg, 0);
		log.push({
			type: "move",
			turn,
			attackerId: attacker.id,
			move: "double_strike",
			damage: dmg,
			crit: isCrit,
			defenderHp: currentDefHp,
		});
		if (currentDefHp <= 0)
			return { outcome: "ko", attackerBoost, defenderHp: 0 };
	}

	return { outcome: "continue", attackerBoost, defenderHp: currentDefHp };
}

export function simulateBattle(
	fighter1: FighterStats,
	fighter2: FighterStats,
): BattleResult {
	const log: BattleEvent[] = [];

	// faster fighter goes first, ties broken by coin flip
	const f1First =
		fighter1.speed !== fighter2.speed
			? fighter1.speed > fighter2.speed
			: Math.random() < 0.5;

	const [first, second] = f1First ? [fighter1, fighter2] : [fighter2, fighter1];
	const [firstVr, secondVr] = f1First
		? [varRange(fighter1.speed), varRange(fighter2.speed)]
		: [varRange(fighter2.speed), varRange(fighter1.speed)];

	let hpOfFirst = first.health;
	let hpOfSecond = second.health;
	let boostFirst = 0;
	let boostSecond = 0;

	let winnerId: string | null = null;

	for (let turn = 1; turn <= MAX_TURNS; turn++) {
		// first fighter attacks second
		const r1 = execMove(
			turn,
			first,
			firstVr,
			boostFirst,
			second,
			hpOfSecond,
			log,
		);
		boostFirst = r1.attackerBoost;
		hpOfSecond = r1.defenderHp;
		if (r1.outcome === "ko") {
			winnerId = first.id;
			break;
		}

		// second fighter attacks first
		const r2 = execMove(
			turn,
			second,
			secondVr,
			boostSecond,
			first,
			hpOfFirst,
			log,
		);
		boostSecond = r2.attackerBoost;
		hpOfFirst = r2.defenderHp;
		if (r2.outcome === "ko") {
			winnerId = second.id;
			break;
		}
	}

	// timeout: resolve by HP advantage or coin flip
	if (winnerId === null) {
		if (hpOfFirst !== hpOfSecond) {
			winnerId = hpOfFirst > hpOfSecond ? first.id : second.id;
			log.push({ type: "timeout", winnerId, reason: "hp_advantage" });
		} else {
			winnerId = Math.random() < 0.5 ? first.id : second.id;
			log.push({ type: "timeout", winnerId, reason: "coinflip" });
		}
	} else {
		log.push({
			type: "ko",
			loserId: winnerId === first.id ? second.id : first.id,
		});
	}

	return {
		winnerId: winnerId!,
		loserId: winnerId === fighter1.id ? fighter2.id : fighter1.id,
		log,
	};
}

// convenience wrapper for monte carlo simulations. uses canonical simulateBattle
export function fightOnce(a: FighterStats, b: FighterStats): boolean {
	return simulateBattle(a, b).winnerId === a.id;
}