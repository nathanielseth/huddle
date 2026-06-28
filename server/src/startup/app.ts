import express, { type Application } from "express";
import cors from "cors";
import type { RoomRegistry } from "../room/registry";
import type { GameRunner } from "../engine/GameRunner";

export function createApp(
	registry: RoomRegistry,
	runner: GameRunner,
): Application {
	const app = express();

	app.use(cors());
	app.use(express.json());

	app.get("/health", (_req, res) => {
		const mem = process.memoryUsage();
		res.json({
			status: "ok",
			rooms: registry.size,
			activeTimers: runner.timerCount,
			activeQueues: runner.queueSize,
			uptime: Math.floor(process.uptime()),
			memoryMB: {
				heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
				heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
				rss: Math.round(mem.rss / 1024 / 1024),
			},
		});
	});

	return app;
}
