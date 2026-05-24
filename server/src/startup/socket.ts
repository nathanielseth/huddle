import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "../env";
import { logger } from "../lib/logger";
import { registerHandlers } from "../room/handlers";
import type { RoomRegistry } from "../room/registry";
import type { GameRunner } from "../engine/GameRunner";
import type { IO } from "../types";

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
