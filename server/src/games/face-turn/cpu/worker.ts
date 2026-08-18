import { parentPort } from "node:worker_threads";
import { decideAction } from "./cpu-player";
import type { FaceturnServerState } from "../types";
import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";

export type CloneableFaceturnState = Omit<FaceturnServerState, "rng">;

export interface CpuSearchRequest {
	readonly id: string;
	readonly state: CloneableFaceturnState;
	readonly seat: string;
}

export interface CpuSearchResponse {
	readonly id: string;
	readonly action: FaceturnsAction | null;
	readonly error?: string;
}

if (!parentPort) {
	throw new Error("face-turn cpu worker must be run as a worker_thread");
}

parentPort.on("message", (req: CpuSearchRequest) => {
	try {
		// rng is reconstructed here n not sent from the main thread
		const state: FaceturnServerState = { ...req.state, rng: Math.random };
		const action = decideAction(state, req.seat, Math.random);

		const response: CpuSearchResponse = { id: req.id, action };
		parentPort!.postMessage(response);
	} catch (err) {
		const response: CpuSearchResponse = {
			id: req.id,
			action: null,
			error: err instanceof Error ? err.message : String(err),
		};
		parentPort!.postMessage(response);
	}
});