import { io, type Socket } from "socket.io-client";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "@shared/core/socket-events";

const SOCKET_URL =
	(import.meta.env.VITE_SERVER_URL as string | undefined) ??
	`${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
	SOCKET_URL,
	{
		autoConnect: false,
		transports: ["websocket", "polling"],
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
	},
);