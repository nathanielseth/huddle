/**
 * Public surface of the Face Turn CPU. Everything else in this directory
 * (determinize, legal-actions, simulate, evaluate, policy, ismcts,
 * personality) is an implementation detail — the only thing callers
 * outside this directory should ever import is decideAction and the
 * difficulty type.
 *
 * Usage (once wired into the room/socket layer):
 *
 *   const action = decideAction(room.gamePayload as FaceturnServerState, cpuSeatId, "veteran");
 *   if (action) gameRunner.handleAction(room, cpuSeatId, action, io, store);
 *
 * decideAction is a pure function of (state, seat, difficulty) — it never
 * touches Room, sockets, or timers, so it's trivially unit-testable and
 * reusable outside the live server (simulation tooling, balance testing,
 * etc.) without dragging in any of that infrastructure.
 */
export { decideAction } from "./cpu-player";
export { sampleThinkMs, getTuning } from "./personality";
export type { CpuDifficulty, CpuTuning } from "./types";
