import type { GameRunner } from "../engine/GameRunner.js";
import { sabongEngine } from "../games/sabong/index.js";
import { sussyEngine } from "../games/sussy/index.js";
import { believableLiesEngine } from "../games/believable-lies/index.js";
import { witzoneEngine } from "../games/witzone/index.js";
import { pokerEngine } from "../games/poker/index.js";
import { logger } from "../lib/logger.js";
import type { GameEngine } from "../engine/GameEngine.js";

const ENGINES: readonly GameEngine[] = [
	sabongEngine,
	sussyEngine,
	believableLiesEngine,
	witzoneEngine,
	pokerEngine,
];

export function registerGames(runner: GameRunner): void {
	for (const engine of ENGINES) {
		runner.register(engine);
	}
	logger.info("game engines registered", { count: ENGINES.length });
}
