import { useSyncExternalStore } from "react";

const MQ = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
	return useSyncExternalStore(
		(cb) => {
			const mq = window.matchMedia(MQ);
			mq.addEventListener("change", cb);
			return () => mq.removeEventListener("change", cb);
		},
		() => window.matchMedia(MQ).matches,
		() => false,
	);
}