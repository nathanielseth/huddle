import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import type {
	CpuSearchRequest,
	CpuSearchResponse,
} from "../games/face-turn/cpu/worker";
import type { FaceturnsAction } from "../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../games/face-turn/types";

// tsx loader must be registered inside the worker
// worker threads don't reliably inherit execArgv loader hooks on node 22.2+
const isTsSource = import.meta.url.endsWith(".ts");
const workerUrl = isTsSource
	? new URL("../games/face-turn/cpu/worker-bootstrap.ts", import.meta.url)
	: new URL("../games/face-turn/cpu/worker.js", import.meta.url);

interface PendingRequest {
	resolve: (action: FaceturnsAction | null) => void;
	reject: (err: Error) => void;
}

// offloads face-turn's ismcts search to worker threads to avoid blocking socket messages and timers
export class CpuSearchPool {
	private readonly workers: Worker[];
	private nextWorker = 0;
	private readonly pending = new Map<string, PendingRequest>();

	constructor(size = 2) {
		this.workers = Array.from({ length: size }, () => this.spawnWorker());
	}

	private spawnWorker(): Worker {
		const worker = new Worker(workerUrl);

		worker.on("message", (res: CpuSearchResponse) => {
			const pending = this.pending.get(res.id);
			if (!pending) return; // stale response after timeout or room teardown
			this.pending.delete(res.id);
			if (res.error) {
				pending.reject(new Error(`face-turn cpu worker: ${res.error}`));
			} else {
				pending.resolve(res.action);
			}
		});

		worker.on("error", (err: Error) => {
			this.failAllPendingFor(worker, err);
			this.replaceWorker(worker);
		});
		worker.on("exit", (code) => {
			if (code !== 0) {
				this.failAllPendingFor(
					worker,
					new Error(`face-turn cpu worker exited with code ${code}`),
				);
				this.replaceWorker(worker);
			}
		});

		return worker;
	}

	private replaceWorker(dead: Worker): void {
		const idx = this.workers.indexOf(dead);
		if (idx === -1) return;
		this.workers[idx] = this.spawnWorker();
	}

	private failAllPendingFor(_worker: Worker, err: Error): void {
		for (const [id, pending] of this.pending) {
			pending.reject(err);
			this.pending.delete(id);
		}
	}

	decide(
		state: FaceturnServerState,
		seat: string,
	): Promise<FaceturnsAction | null> {
		const id = randomUUID();
		const worker = this.workers[this.nextWorker];
		if (!worker) {
			return Promise.reject(new Error("CpuSearchPool has no workers"));
		}
		this.nextWorker = (this.nextWorker + 1) % this.workers.length;

		const { rng, ...cloneable } = state;
		void rng; // rng is a function, stripped before postMessage
		const request: CpuSearchRequest = {
			id,
			state: cloneable,
			seat,
		};

		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			worker.postMessage(request);
		});
	}

	async terminate(): Promise<void> {
		await Promise.all(this.workers.map((w) => w.terminate()));
	}
}

// spawn workers lazily on first decide call, not on import
let instance: CpuSearchPool | null = null;

export function getCpuSearchPool(): CpuSearchPool {
	if (!instance) instance = new CpuSearchPool();
	return instance;
}

export function setCpuSearchPoolForTesting(pool: CpuSearchPool | null): void {
	instance = pool;
}

export async function terminateCpuSearchPoolIfStarted(): Promise<void> {
	if (instance) await instance.terminate();
}