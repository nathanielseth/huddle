import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { registerHandlers } from "../room/handlers.js";
import type { RoomRegistry } from "../room/registry.js";
import type { GameRunner } from "../engine/GameRunner.js";
import type { IO } from "../types.js";

export function createSocketServer(
	httpServer: HttpServer,
	registry: RoomRegistry,
	runner: GameRunner,
): IO {
	const io: IO = new Server(httpServer, {
		cors: { origin: env.CLIENT_URL, methods: ["GET", "POST"] },
		transports: ["websocket"],
		pingTimeout: 10_000,
		pingInterval: 25_000,
	});

	io.on("connection", (socket) => {
		logger.info("socket connected", { socketId: socket.id });
		registerHandlers(io, socket, registry, runner);

		socket.on("error", (err) => {
			logger.error("socket error", {
				socketId: socket.id,
				error: String(err),
			});
		});
	});

	return io;
}
