import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../shared/events.js";
import { registerHandlers } from "./room/handlers.js";
import { RoomStore, isExpired } from "./room/rooms.js";
import { EngineRunner } from "./engine/engineRunner.js";
import { sabongEngine } from "./games/sabong/index.js";
import { sussyEngine } from "./games/sussy/index.js";
import { believableLiesEngine } from "./games/believable-lies/index.js";
import { witzoneEngine } from "./games/witzone/index.js";
import { env } from "./env.js";

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
	cors: { origin: env.CLIENT_URL, methods: ["GET", "POST"] },
	pingTimeout: 10_000,
	pingInterval: 25_000,
});

app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json());

const store = new RoomStore();
const runner = new EngineRunner();

runner.register(sabongEngine);
runner.register(sussyEngine);
runner.register(believableLiesEngine);
runner.register(witzoneEngine);

app.get("/health", (_req, res) => {
	const mem = process.memoryUsage();
	res.json({
		status: "ok",
		rooms: store.size,
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

io.on("connection", (socket) => {
	console.log(`[socket] connected ${socket.id}`);
	registerHandlers(io, socket, store, runner);
});

const cleanupInterval = setInterval(
	() => {
		let cleaned = 0;
		for (const [code, room] of store.entries()) {
			if (isExpired(room)) {
				runner.cancelTimer(code);
				runner.clearQueue(code);
				store.delete(code);
				cleaned++;
			}
		}
		if (cleaned > 0) {
			console.log(`[cleanup] removed ${cleaned} expired room(s)`);
		}
	},
	1000 * 60 * 5,
);

function shutdown(signal: string): void {
	console.log(`[server] ${signal} received — shutting down gracefully`);
	clearInterval(cleanupInterval);

	io.close(() => {
		httpServer.close(() => {
			console.log("[server] all connections closed, exiting cleanly");
			process.exit(0);
		});
	});

	setTimeout(() => {
		console.error("[server] forced exit — shutdown timed out");
		process.exit(1);
	}, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
	console.error("[server] uncaughtException — server continuing:", err);
});
process.on("unhandledRejection", (reason) => {
	console.error("[server] unhandledRejection — server continuing:", reason);
});

httpServer.listen(env.PORT, () => {
	console.log(`[server] running on :${env.PORT} (${env.NODE_ENV})`);
});
