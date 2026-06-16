import type { Server, Socket } from "socket.io";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../shared/core/socket-events";

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
