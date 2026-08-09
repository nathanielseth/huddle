import { existsSync, copyFileSync } from "node:fs";

const pairs = [
	["server/.env.example", "server/.env"],
	["client/.env.example", "client/.env"],
];

for (const [example, target] of pairs) {
	if (existsSync(example) && !existsSync(target)) {
		copyFileSync(example, target);
		console.log(`[setup] created ${target}`);
	}
}