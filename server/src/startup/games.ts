import type { GameRunner } from "../engine/GameRunner";
import { sabongEngine } from "../games/sabong/index";
import { sussyEngine } from "../games/sussy/index";
import { believableLiesEngine } from "../games/believable-lies/index";
import { witzoneEngine } from "../games/witzone/index";
import { pokerEngine } from "../games/poker/index";
import { cybsecsEngine } from "../games/cybersecs/index";
import { squadoodleEngine } from "../games/squadoodle/index";
import { faceturnsEngine } from "../games/face-turn/index";
import { logger } from "../lib/logger";
import type { GameEngine } from "../engine/GameEngine";

const ENGINES: readonly GameEngine[] = [
	sabongEngine,
	sussyEngine,
	believableLiesEngine,
	witzoneEngine,
	pokerEngine,
	cybsecsEngine,
	squadoodleEngine,
	faceturnsEngine,
];

export function registerGames(runner: GameRunner): void {
	for (const engine of ENGINES) {
		runner.register(engine);
	}
	logger.info("game engines registered", { count: ENGINES.length });
}