import { SABONG_CONSTANTS } from "./types.js";

// config

const SAMPLES = 10000;
const MC_SIMS = 3000;
const EPOCHS = 2000;
const LEARNING_RATE = 0.02;
const STEEPNESS = 3.2;

// stat ranges (must match types.ts)
const C = SABONG_CONSTANTS;
const R = C.STAT_RANGES;

const SPREADS = {
	health: R.health[1] - R.health[0],
	attack: R.attack[1] - R.attack[0],
	defense: R.defense[1] - R.defense[0],
	speed: R.speed[1] - R.speed[0],
	critRate: R.critRate[1] - R.critRate[0],
	determination: R.determination[1] - R.determination[0],
} as const;

const FEATURE_NAMES = [
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

// types
interface Fighter {
	health: number;
	attack: number;
	defense: number;
	speed: number;
	critRate: number;
	determination: number;
	attackBoost: number;
}

const CRIT_MULTIPLIER = C.CRIT_MULTIPLIER;
const MAX_TURNS = C.MAX_TURNS;
const MAX_ATTACK_BOOST = C.MAX_ATTACK_BOOST;
const MOVE_ACCURACY = 0.9;
const BUFF_INCREMENT = 20;
const POWER_SCALE = Math.pow(20 / 150, 0.7);

function calcEffDef(
	defenderDefense: number,
	attackerDetermination: number,
): number {
	return Math.max(defenderDefense * (1.0 - attackerDetermination * 0.02), 1.0);
}

function varRange(f: Fighter): number {
	return 0.25 / (1.0 + f.speed * 0.01);
}

function selectMove(boost: number): "buff" | "strike" | "double_strike" {
	const roll = Math.random();
	if (boost < MAX_ATTACK_BOOST && roll < 0.25) return "buff";
	if (roll < 0.625) return "strike";
	return "double_strike";
}

// atk=effective attack, cr=critRate, vr=varRange, dd=defenderDefense, ad=attackerDetermination
function calcDmg(
	atk: number,
	cr: number,
	vr: number,
	dd: number,
	ad: number,
): number {
	const crit = Math.random() * 100 <= cr ? CRIT_MULTIPLIER : 1.0;
	const effDef = calcEffDef(dd, ad);
	const base = (2.5 * atk * atk) / (3.5 * effDef + atk);
	return Math.max(
		Math.round(base * POWER_SCALE * (1 - vr * Math.random()) * crit),
		1,
	);
}

function fightOnce(a: Fighter, b: Fighter): boolean {
	let hpA = a.health,
		hpB = b.health;
	let boostA = 0,
		boostB = 0;
	const vrA = varRange(a),
		vrB = varRange(b);

	const aFirst =
		a.speed > b.speed ? true : b.speed > a.speed ? false : Math.random() < 0.5;

	const attackTurn = (
		attackerAtk: number,
		attackerCr: number,
		attackerVr: number,
		attackerDet: number,
		defenderDef: number,
		boost: number,
	): [damage: number, newBoost: number] => {
		const move = selectMove(boost);
		if (move === "buff")
			return [0, Math.min(boost + BUFF_INCREMENT, MAX_ATTACK_BOOST)];
		const effAtk = attackerAtk + boost;
		let dmg = 0;
		if (Math.random() <= MOVE_ACCURACY)
			dmg += calcDmg(effAtk, attackerCr, attackerVr, defenderDef, attackerDet);
		if (move === "double_strike" && Math.random() <= MOVE_ACCURACY)
			dmg += calcDmg(effAtk, attackerCr, attackerVr, defenderDef, attackerDet);
		return [dmg, boost];
	};

	for (let t = 0; t < MAX_TURNS; t++) {
		if (aFirst) {
			const [dmg, nb] = attackTurn(
				a.attack,
				a.critRate,
				vrA,
				a.determination,
				b.defense,
				boostA,
			);
			boostA = nb;
			hpB -= dmg;
			if (hpB <= 0) return true;
			const [dmg2, nb2] = attackTurn(
				b.attack,
				b.critRate,
				vrB,
				b.determination,
				a.defense,
				boostB,
			);
			boostB = nb2;
			hpA -= dmg2;
			if (hpA <= 0) return false;
		} else {
			const [dmg, nb] = attackTurn(
				b.attack,
				b.critRate,
				vrB,
				b.determination,
				a.defense,
				boostB,
			);
			boostB = nb;
			hpA -= dmg;
			if (hpA <= 0) return false;
			const [dmg2, nb2] = attackTurn(
				a.attack,
				a.critRate,
				vrA,
				a.determination,
				b.defense,
				boostA,
			);
			boostA = nb2;
			hpB -= dmg2;
			if (hpB <= 0) return true;
		}
	}

	if (hpA > hpB) return true;
	if (hpB > hpA) return false;
	return Math.random() < 0.5;
}

function runMC(a: Fighter, b: Fighter, sims: number): number {
	let wins = 0;
	for (let i = 0; i < sims; i++) if (fightOnce(a, b)) wins++;
	return wins / sims;
}

// data generation
function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFighter(): Fighter {
	return {
		health: randInt(R.health[0], R.health[1]),
		attack: randInt(R.attack[0], R.attack[1]),
		defense: randInt(R.defense[0], R.defense[1]),
		speed: randInt(R.speed[0], R.speed[1]),
		critRate: randInt(R.critRate[0], R.critRate[1]),
		determination: randInt(R.determination[0], R.determination[1]),
		attackBoost: 0,
	};
}

function extractFeatures(a: Fighter, b: Fighter): number[] {
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
		h * atk,
		atk * c,
		d * h,
		s * atk,
		atk * atk,
		d * d,
		h * h,
	];
}

// logistic regression
function sigmoid(x: number): number {
	return 1.0 / (1.0 + Math.exp(-x));
}

function dotProduct(a: number[], b: number[]): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
	return sum;
}

function fitWeights(
	features: number[][],
	targets: number[],
	epochs: number,
	lr: number,
): number[] {
	const n = features[0]!.length;
	const m = features.length;
	const w = new Array<number>(n).fill(0.0);

	for (let epoch = 0; epoch < epochs; epoch++) {
		const grads = new Array<number>(n).fill(0.0);
		let loss = 0;

		for (let i = 0; i < m; i++) {
			const score = dotProduct(features[i]!, w);
			const pred = sigmoid(score * STEEPNESS);
			const y = targets[i]!;
			const err = pred - y;

			loss += -(
				y * Math.log(pred + 1e-9) +
				(1 - y) * Math.log(1 - pred + 1e-9)
			);

			for (let j = 0; j < n; j++) {
				grads[j]! += err * STEEPNESS * features[i]![j]!;
			}
		}

		for (let j = 0; j < n; j++) w[j]! -= (lr * grads[j]!) / m;

		if ((epoch + 1) % 100 === 0) {
			const avgLoss = loss / m;
			process.stdout.write(
				`  epoch ${String(epoch + 1).padStart(4)} / ${epochs} | loss ${avgLoss.toFixed(5)}\n`,
			);
		}
	}

	return w;
}

// main
async function main(): Promise<void> {
	console.log("=".repeat(60));
	console.log("Sabong heuristic weight calibration");
	console.log("=".repeat(60));
	console.log(`Samples: ${SAMPLES} | MC sims each: ${MC_SIMS}`);
	console.log(
		`Epochs: ${EPOCHS} | LR: ${LEARNING_RATE} | Steepness: ${STEEPNESS}`,
	);
	console.log();

	// generate training data
	console.log(`Generating ${SAMPLES} training samples...`);
	const features: number[][] = [];
	const targets: number[] = [];

	for (let i = 0; i < SAMPLES; i++) {
		const a = randomFighter();
		const b = randomFighter();
		const winRate = runMC(a, b, MC_SIMS);
		features.push(extractFeatures(a, b));
		targets.push(winRate);

		if ((i + 1) % 500 === 0) {
			process.stdout.write(`  ${i + 1} / ${SAMPLES}\n`);
		}
	}

	console.log(`\nFitting weights (${EPOCHS} epochs)...\n`);
	const weights = fitWeights(features, targets, EPOCHS, LEARNING_RATE);

	// validation
	console.log("\nValidation (200 held-out samples)...");
	let mse = 0;
	let correct = 0;
	const VAL = 200;

	for (let i = 0; i < VAL; i++) {
		const a = randomFighter();
		const b = randomFighter();
		const trueRate = runMC(a, b, MC_SIMS);
		const score = dotProduct(extractFeatures(a, b), weights);
		const pred = sigmoid(score * STEEPNESS);
		mse += (pred - trueRate) ** 2;
		if (pred > 0.5 === trueRate > 0.5) correct++;
	}

	console.log(`  MSE: ${(mse / VAL).toFixed(5)}`);
	console.log(`  Direction accuracy: ${((correct / VAL) * 100).toFixed(1)}%`);

	// output
	console.log("\n" + "=".repeat(60));
	console.log("Paste this into heuristic.ts → WEIGHTS:");
	console.log("=".repeat(60));
	console.log("export const WEIGHTS = {");
	FEATURE_NAMES.forEach((name, i) => {
		const val = weights[i]!;
		const sign = val >= 0 ? " " : "";
		console.log(`\t${name}: ${sign}${val.toFixed(4)},`);
	});
	console.log("} as const;");
	console.log("=".repeat(60));
}

main().catch(console.error);
