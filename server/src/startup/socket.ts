import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "../env";
import { logger } from "../lib/logger";
import { registerHandlers } from "../room/handlers";
import type { RoomRegistry } from "../room/registry";
import type { GameRunner } from "../engine/GameRunner";
import type { IO } from "../types";

// need 5 mb for squadoodle...
const MAX_HTTP_BUFFER_SIZE = 5 * 1024 * 1024;

export function createSocketServer(
	httpServer: HttpServer,
	registry: RoomRegistry,
	runner: GameRunner,
): IO {
	const io: IO = new Server(httpServer, {
		cors: {
			origin: env.NODE_ENV === "development" ? true : env.allowedOrigins,
			methods: ["GET", "POST"],
		},
		transports: ["websocket", "polling"],
		pingTimeout: 10_000,
		pingInterval: 25_000,
		maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
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