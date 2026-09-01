// replays a closed chain's resolution steps on a timer; separate from useChainLeeway
import { useEffect, useState } from "react";
import type { MoveChainResolutionView } from "@shared/games/face-turn/types";
import { useReducedMotion } from "../../../../hooks/a11y/useReducedMotion";

const STEP_MS = 500;
const REDUCED_MOTION_STEP_MS = 120;

export interface ChainReplayState {
	readonly active: boolean;
	readonly stepIndex: number | null;
	readonly resolution: MoveChainResolutionView | null;
}

const IDLE: ChainReplayState = {
	active: false,
	stepIndex: null,
	resolution: null,
};

export function useChainReplay(
	lastChainResolution: MoveChainResolutionView | null | undefined,
	eligible: boolean,
	interrupt: boolean,
): ChainReplayState {
	const reducedMotion = useReducedMotion();
	const stepMs = reducedMotion ? REDUCED_MOTION_STEP_MS : STEP_MS;

	const [state, setState] = useState<ChainReplayState>(IDLE);
	const [lastContent, setLastContent] = useState<string | null>(null);

	const resolution = lastChainResolution ?? null;
	const content = resolution ? JSON.stringify(resolution) : null;

	// interrupt cancels immediately, even over a new resolution
	if (interrupt && state.active) {
		setState(IDLE);
		setLastContent(content);
	} else if (eligible && content !== null && content !== lastContent) {
		setLastContent(content);
		setState({ active: true, stepIndex: 0, resolution });
	}

	useEffect(() => {
		if (
			!state.active ||
			state.resolution === null ||
			state.stepIndex === null
		) {
			return;
		}
		const isLastStep = state.stepIndex >= state.resolution.steps.length - 1;

		const timer = setTimeout(() => {
			setState((prev) => {
				if (
					!prev.active ||
					prev.resolution === null ||
					prev.stepIndex === null
				) {
					return prev;
				}
				if (isLastStep) return IDLE;
				return { ...prev, stepIndex: prev.stepIndex + 1 };
			});
		}, stepMs);

		return () => clearTimeout(timer);
	}, [state.active, state.resolution, state.stepIndex, stepMs]);

	return state;
}