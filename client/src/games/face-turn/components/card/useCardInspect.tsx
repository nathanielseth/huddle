import {
	openCardInspect,
	closeCardInspect,
	type InspectCycle,
} from "./cardInspectStore";

export type { InspectCycle };

export function useCardInspect() {
	return {
		inspect: openCardInspect,
		close: closeCardInspect,
		modal: null,
	};
}