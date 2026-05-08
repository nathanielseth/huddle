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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", rooms: store.size, uptime: process.uptime() });
});

io.on("connection", (socket) => {
  console.log(`[socket] connected ${socket.id}`);
  registerHandlers(io, socket, store, runner);
});

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

httpServer.listen(env.PORT, () => {
  console.log(`[server] running on :${env.PORT} (${env.NODE_ENV})`);
});