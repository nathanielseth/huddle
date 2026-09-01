// same useSyncExternalStore-over-matchMedia shape as useReducedMotion.ts in
// this folder — a boolean the browser itself keeps current, no resize
// listener/state dance needed.
//
// combines two queries with `or` on purpose: width alone isn't the real
// signal (a resized desktop window can be narrow with a fine mouse pointer,
// and a large-screen tablet can be touch-primary at full width) — either
// condition alone is enough to prefer tap-and-swipe over hover-revealed
// arrow buttons, which is the one thing every current caller of this hook
// actually needs to know.
import { useSyncExternalStore } from "react";

const MQ = "(max-width: 640px), (pointer: coarse)";

export function useIsCompactPointer(): boolean {
	return useSyncExternalStore(
		(cb) => {
			const mq = window.matchMedia(MQ);
			mq.addEventListener("change", cb);
			return () => {
				mq.removeEventListener("change", cb);
			};
		},
		() => window.matchMedia(MQ).matches,
		// SSR/first-paint fallback: false, same call this codebase already
		// makes in useReducedMotion — assume the roomier desktop treatment
		// until the real client-side query result is available, rather than
		// guessing compact and flashing arrow buttons in a beat later.
		() => false,
	);
}
