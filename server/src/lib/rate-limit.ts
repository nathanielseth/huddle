// silently drops calls within the cooldown window
export function createCooldown(intervalMs: number): {
	ready: (now?: number) => boolean;
} {
	// use -Infinity so the first call always passes, even with an explicit timestamp of 0 (used in tests)
	let lastHitAt = -Infinity;
	return {
		ready(now = Date.now()): boolean {
			if (now - lastHitAt < intervalMs) return false;
			lastHitAt = now;
			return true;
		},
	};
}