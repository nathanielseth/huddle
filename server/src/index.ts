import { createServer } from "http";
import { createApp } from "./startup/app.js";
import { createSocketServer } from "./startup/socket.js";
import { registerGames } from "./startup/games.js";
import {
	startRoomCleanup,
	registerShutdownHandlers,
} from "./startup/lifecycle.js";
import { RoomRegistry } from "./room/registry.js";
import { GameRunner } from "./engine/GameRunner.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

const registry = new RoomRegistry();
const runner = new GameRunner();

registerGames(runner);

const app = createApp(registry, runner);
const httpServer = createServer(app);
const io = createSocketServer(httpServer, registry, runner);

const cleanupTimer = startRoomCleanup(io, registry, runner);
registerShutdownHandlers(httpServer, io, cleanupTimer);

httpServer.listen(env.PORT, () => {
	logger.info("server started", { port: env.PORT, env: env.NODE_ENV });
});
