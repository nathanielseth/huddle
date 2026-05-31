import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fightOnce } from "./battle";
import { extractFeatures, FEATURE_NAMES } from "./features";
import { SIGMOID_STEEPNESS } from "./odds";
import { SABONG_CONSTANTS } from "./types";

const SAMPLES = 10_000;
const MC_SIMS = 3_000;
const EPOCHS = 2_000;
const LEARNING_RATE = 0.02;

const C = SABONG_CONSTANTS;
const R = C.STAT_RANGES;

interface Fighter {
	health: number;
	attack: number;
	defense: number;
	speed: number;
	critRate: number;
	determination: number;
}

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
	};
}

function runMC(a: Fighter, b: Fighter, sims: number): number {
	let wins = 0;
	for (let i = 0; i < sims; i++) {
		if (fightOnce({ id: "a", ...a }, { id: "b", ...b })) wins++;
	}
	return wins / sims;
}

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
			// SIGMOID_STEEPNESS from odds.ts
			const pred = sigmoid(score * SIGMOID_STEEPNESS);
			const y = targets[i]!;
			const err = pred - y;

			loss += -(
				y * Math.log(pred + 1e-9) +
				(1 - y) * Math.log(1 - pred + 1e-9)
			);

			for (let j = 0; j < n; j++) {
				grads[j]! += err * SIGMOID_STEEPNESS * features[i]![j]!;
			}
		}

		for (let j = 0; j < n; j++) w[j]! -= (lr * grads[j]!) / m;

		if ((epoch + 1) % 100 === 0) {
			process.stdout.write(
				`  epoch ${String(epoch + 1).padStart(4)} / ${epochs} | loss ${(loss / m).toFixed(5)}\n`,
			);
		}
	}

	return w;
}

function main(): void {
	console.log("=".repeat(60));
	console.log("Sabong heuristic weight calibration");
	console.log("=".repeat(60));
	console.log(`Samples: ${SAMPLES} | MC sims each: ${MC_SIMS}`);
	console.log(
		`Epochs: ${EPOCHS} | LR: ${LEARNING_RATE} | Steepness: ${SIGMOID_STEEPNESS}`,
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

		if ((i + 1) % 500 === 0) process.stdout.write(`  ${i + 1} / ${SAMPLES}\n`);
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
		const pred = sigmoid(score * SIGMOID_STEEPNESS);
		mse += (pred - trueRate) ** 2;
		if (pred > 0.5 === trueRate > 0.5) correct++;
	}

	console.log(`  MSE:                ${(mse / VAL).toFixed(5)}`);
	console.log(`  Direction accuracy: ${((correct / VAL) * 100).toFixed(1)}%`);

	const weightRecord = Object.fromEntries(
		FEATURE_NAMES.map((name, i) => [name, parseFloat(weights[i]!.toFixed(4))]),
	);

	const __dirname = dirname(fileURLToPath(import.meta.url));
	const outputPath = join(__dirname, "weights.json");
	writeFileSync(
		outputPath,
		JSON.stringify(weightRecord, null, "\t") + "\n",
		"utf-8",
	);

	console.log("\n" + "=".repeat(60));
	console.log(`weights.json written to: ${outputPath}`);
	console.log("\nCopy this const block into WEIGHTS in odds.ts:\n");
	console.log("export const WEIGHTS: HeuristicWeights = {");
	FEATURE_NAMES.forEach((name, i) => {
		const val = weights[i]!;
		const sign = val >= 0 ? " " : "";
		console.log(`\t${name.padEnd(16)}: ${sign}${val.toFixed(4)},`);
	});
	console.log("} as const;");
	console.log("=".repeat(60));
}

main();