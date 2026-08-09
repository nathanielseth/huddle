import { io, type Socket } from "socket.io-client";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "@shared/core/socket-events";

const SOCKET_URL = import.meta.env.VITE_SERVER_URL ?? "";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
	SOCKET_URL,
	{
		path: "/socket.io",
		autoConnect: false,
		transports: ["websocket", "polling"],
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
	},
);