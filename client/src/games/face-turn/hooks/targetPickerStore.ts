import { create } from "zustand";
import type { CrewClass } from "@shared/games/face-turn/types";
import type { BoardTarget } from "./boardTargetRegistry";

export type TargetPickerMode = "single" | "multi" | "two_phase";

export type TargetPickerCompleteHandler = (result: {
	target?: BoardTarget;
	guessClass?: CrewClass;
	picks?: BoardTarget[];
	phaseOnePick?: BoardTarget;
	phaseTwoPick?: BoardTarget;
}) => void;

interface TargetPickerSession {
	mode: TargetPickerMode;
	eligible: BoardTarget[];
	// two phase: second click uses this set
	phaseTwoEligible: BoardTarget[] | null;
	phaseOnePick: BoardTarget | null;
	// single + classGuess: click opens popover instead of resolving
	classGuess: boolean;
	picks: BoardTarget[];
	maxPicks: number | null;
}

function targetsEqual(a: BoardTarget, b: BoardTarget): boolean {
	if (a.kind !== b.kind) return false;
	if (a.playerId !== b.playerId) return false;
	if ("slotIndex" in a && "slotIndex" in b) return a.slotIndex === b.slotIndex;
	return true;
}

interface TargetPickerStore {
	session: TargetPickerSession | null;
	onComplete: TargetPickerCompleteHandler | null;
	pendingClassGuessTarget: BoardTarget | null;
	setOnComplete: (handler: TargetPickerCompleteHandler | null) => void;
	open: (session: Omit<TargetPickerSession, "picks" | "phaseOnePick">) => void;
	close: () => void;
	pickTarget: (target: BoardTarget) => void;
	confirmClassGuess: (guessClass: CrewClass) => void;
	confirmMulti: () => void;
}

export const useTargetPickerStore = create<TargetPickerStore>((set, get) => ({
	session: null,
	onComplete: null,
	pendingClassGuessTarget: null,
	setOnComplete: (handler) => set({ onComplete: handler }),
	open: (session) =>
		set({
			session: { ...session, picks: [], phaseOnePick: null },
			pendingClassGuessTarget: null,
		}),
	close: () => set({ session: null, pendingClassGuessTarget: null }),

	pickTarget: (target) => {
		const { session, onComplete } = get();
		if (!session) return;

		if (session.mode === "multi") {
			const exists = session.picks.some((p) => targetsEqual(p, target));
			set({
				session: {
					...session,
					picks: exists
						? session.picks.filter((p) => !targetsEqual(p, target))
						: session.maxPicks !== null &&
							  session.picks.length >= session.maxPicks
							? session.picks
							: [...session.picks, target],
				},
			});
			return;
		}

		if (session.mode === "two_phase") {
			if (session.phaseOnePick === null) {
				// first click: commit phase one, swap to phase two eligible
				set({
					session: {
						...session,
						phaseOnePick: target,
						eligible: session.phaseTwoEligible ?? [],
					},
				});
				return;
			}
			// second click: resolve both
			onComplete?.({
				phaseOnePick: session.phaseOnePick,
				phaseTwoPick: target,
			});
			set({ session: null, pendingClassGuessTarget: null });
			return;
		}

		// single
		if (session.classGuess) {
			set({ pendingClassGuessTarget: target });
			return;
		}
		onComplete?.({ target });
		set({ session: null, pendingClassGuessTarget: null });
	},

	confirmClassGuess: (guessClass) => {
		const { pendingClassGuessTarget, onComplete } = get();
		if (!pendingClassGuessTarget) return;
		onComplete?.({ target: pendingClassGuessTarget, guessClass });
		set({ session: null, pendingClassGuessTarget: null });
	},

	confirmMulti: () => {
		const { session, onComplete } = get();
		if (!session || session.mode !== "multi") return;
		if (session.picks.length === 0) return;
		onComplete?.({ picks: session.picks });
		set({ session: null, pendingClassGuessTarget: null });
	},
}));

export function useTargetPickerSession(): TargetPickerSession | null {
	return useTargetPickerStore((s) => s.session);
}

export function usePendingClassGuessTarget(): BoardTarget | null {
	return useTargetPickerStore((s) => s.pendingClassGuessTarget);
}

export function isTargetPickerEligible(
	session: TargetPickerSession | null,
	target: BoardTarget,
): boolean {
	if (!session) return false;
	return session.eligible.some((t) => targetsEqual(t, target));
}