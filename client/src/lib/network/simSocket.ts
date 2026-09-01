import { io, type Socket } from "socket.io-client";
import type {
	SimServerToClientEvents,
	SimClientToServerEvents,
} from "@shared/dev/faceturn-sim-protocol";

// Talks to server/scripts/faceturn-sim/live/serve.ts — a standalone dev
// process (`npm run sim:live -w server`), NOT the main app server. Separate
// connection on purpose: see that file's header for why this isn't a
// namespace on the regular socket (client/src/lib/network/socket.ts).
const SIM_SERVER_URL =
	import.meta.env.VITE_SIM_SERVER_URL ?? "http://localhost:4100";

export const simSocket: Socket<SimServerToClientEvents, SimClientToServerEvents> =
	io(SIM_SERVER_URL, {
		autoConnect: false,
		transports: ["websocket", "polling"],
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
	});
