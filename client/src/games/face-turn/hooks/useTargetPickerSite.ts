import { useEffect, useRef } from "react";
import type { BoardTarget } from "./boardTargetRegistry";
import {
	useTargetPickerStore,
	type TargetPickerCompleteHandler,
	type TargetPickerMode,
} from "./targetPickerStore";

export interface TargetPickerSiteSession {
	mode: TargetPickerMode;
	eligible: BoardTarget[];
	phaseTwoEligible?: BoardTarget[] | null;
	classGuess?: boolean;
	maxPicks?: number | null;
}

export function useTargetPickerSite(
	session: TargetPickerSiteSession | null,
	onComplete: TargetPickerCompleteHandler,
): void {
	const open = useTargetPickerStore((s) => s.open);
	const close = useTargetPickerStore((s) => s.close);
	const setOnComplete = useTargetPickerStore((s) => s.setOnComplete);

	const onCompleteRef = useRef(onComplete);
	useEffect(() => {
		onCompleteRef.current = onComplete;
	});

	const sessionIdentity = session ? JSON.stringify(session) : null;

	useEffect(() => {
		if (!session) return;
		open({
			mode: session.mode,
			eligible: session.eligible,
			phaseTwoEligible: session.phaseTwoEligible ?? null,
			classGuess: session.classGuess ?? false,
			maxPicks: session.maxPicks ?? null,
		});
		setOnComplete((result) => {
			onCompleteRef.current(result);
		});
		return () => {
			setOnComplete(null);
			close();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionIdentity]);
}