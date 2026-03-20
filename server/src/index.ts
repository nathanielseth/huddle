import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
	cors: {
		origin: "http://localhost:5173",
		methods: ["GET", "POST"],
	},
});

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

io.on("connection", (socket) => {
	console.log(`Socket connected: ${socket.id}`);

	socket.on("disconnect", () => {
		console.log(`Socket disconnected: ${socket.id}`);
	});
});

const PORT = process.env["PORT"] ?? 3001;
httpServer.listen(PORT, () => {
	console.log(`Huddle server running on port ${PORT}`);
});
