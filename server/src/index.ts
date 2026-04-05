import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../shared/events.js";
import { registerHandlers } from "./handlers.js";
import { RoomStore, isExpired } from "./rooms.js";

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env["CLIENT_URL"] ?? "http://localhost:5173";

// socket.io with typed events
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
	cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const store = new RoomStore();

// health check endpoint
app.get("/health", (_req, res) => {
	res.json({ status: "ok", rooms: store.size, uptime: process.uptime() });
});

// handle new socket connections
io.on("connection", (socket) => {
	console.log(`[socket] connected ${socket.id}`);
	registerHandlers(io, socket, store);
});

// cleanup expired rooms every 5 minutes
setInterval(
	() => {
		for (const [code, room] of store.entries()) {
			if (isExpired(room)) {
				store.delete(code);
				console.log(`[cleanup] expired room ${code}`);
			}
		}
	},
	1000 * 60 * 5,
);

const PORT = process.env["PORT"] ?? 3001;
httpServer.listen(PORT, () => {
	console.log(`Huddle server running on :${PORT}`);
});
