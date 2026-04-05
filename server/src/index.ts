import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../shared/events.js";
import { registerHandlers } from "./handlers.js";
import { isExpired, type Room } from "./rooms.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
	cors: {
		origin: process.env["CLIENT_URL"] ?? "http://localhost:5173",
		methods: ["GET", "POST"],
	},
});

app.use(cors());
app.use(express.json());

// in-memory state
const rooms = new Map<string, Room>();

// health check
app.get("/health", (_req, res) => {
	res.json({
		status: "ok",
		rooms: rooms.size,
		uptime: process.uptime(),
	});
});

// socket.io 
io.on("connection", (socket) => {
	console.log(`[socket] connected ${socket.id}`);
	registerHandlers(io, socket, rooms);
});

// room cleanup
setInterval(
	() => {
		for (const [code, room] of rooms) {
			if (isExpired(room)) {
				rooms.delete(code);
				console.log(`[cleanup] expired room ${code}`);
			}
		}
	},
	1000 * 60 * 5,
);

// start server
const PORT = process.env["PORT"] ?? 3001;

httpServer.listen(PORT, () => {
	console.log(`Huddle server running on :${PORT}`);
});
