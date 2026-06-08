import { createServer } from "http";
import { createApp } from "./startup/app";
import { createSocketServer } from "./startup/socket";
import { registerGames } from "./startup/games";
import {
	startRoomCleanup,
	registerShutdownHandlers,
} from "./startup/lifecycle";
import { RoomRegistry } from "./room/registry";
import { GameRunner } from "./engine/GameRunner";
import { env } from "./env";
import { logger } from "./lib/logger";

const registry = new RoomRegistry();
const runner = new GameRunner();

registerGames(runner);

const app = createApp(registry, runner);
const httpServer = createServer(app);
const io = createSocketServer(httpServer, registry, runner);

const cleanupTimer = startRoomCleanup(io, registry, runner);
registerShutdownHandlers(httpServer, io, cleanupTimer);

httpServer.listen(env.PORT, "0.0.0.0", () => {
	logger.info("server started", { port: env.PORT, env: env.NODE_ENV });
});
