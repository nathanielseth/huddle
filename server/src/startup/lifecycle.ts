import type { Server as HttpServer } from "http";
import { isExpired } from "../room/registry";
import type { RoomRegistry } from "../room/registry";
import type { GameRunner } from "../engine/GameRunner";
import type { IO } from "../types";
import { logger } from "../lib/logger";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

export function startRoomCleanup(
	io: IO,
	registry: RoomRegistry,
	runner: GameRunner,
): NodeJS.Timeout {
	return setInterval(() => {
		let cleaned = 0;
		for (const [code, room] of registry.entries()) {
			if (isExpired(room)) {
				runner.cancelTimer(code);
				runner.clearQueue(code);
				io.to(code).emit("room_closed");
				registry.delete(code);
				cleaned++;
			}
		}
		if (cleaned > 0) {
			logger.info("expired rooms cleaned", { count: cleaned });
		}
	}, CLEANUP_INTERVAL_MS);
}

export function registerShutdownHandlers(
	httpServer: HttpServer,
	io: IO,
	cleanupTimer: NodeJS.Timeout,
): void {
	function shutdown(signal: string): void {
		logger.info("shutdown initiated", { signal });
		clearInterval(cleanupTimer);

		const forceExit = setTimeout(() => {
			logger.error("shutdown timed out — forcing exit");
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS).unref();

		void io.close(() => {
			httpServer.close(() => {
				clearTimeout(forceExit);
				logger.info("shutdown complete");
				process.exit(0);
			});
		});
	}

	process.on("SIGTERM", () => { shutdown("SIGTERM"); });
	process.on("SIGINT", () => { shutdown("SIGINT"); });
	process.on("uncaughtException", (err) => {
		logger.error("uncaughtException", {
			error: String(err),
			stack: err.stack,
		});
		shutdown("uncaughtException");
	});
	process.on("unhandledRejection", (reason) => {
		logger.error("unhandledRejection", { reason: String(reason) });
	});
}