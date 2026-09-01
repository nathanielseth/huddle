// silently drops calls within the cooldown window
export function createCooldown(intervalMs: number): {
	ready: (now?: number) => boolean;
} {
	// use -Infinity so the first call always passes, even with timestamp 0
	let lastHitAt = -Infinity;
	return {
		ready(now = Date.now()): boolean {
			if (now - lastHitAt < intervalMs) return false;
			lastHitAt = now;
			return true;
		},
	};
}

// token bucket: short bursts allowed, sustained rate capped. paired with a short cooldown for chat.
export function createBurstLimiter(
	capacity: number,
	windowMs: number,
): { ready: (now?: number) => boolean } {
	let tokens = capacity;
	let lastRefillAt = -Infinity;
	return {
		ready(now = Date.now()): boolean {
			if (lastRefillAt === -Infinity) lastRefillAt = now;
			const elapsedMs = now - lastRefillAt;
			if (elapsedMs > 0) {
				tokens = Math.min(capacity, tokens + (elapsedMs / windowMs) * capacity);
				lastRefillAt = now;
			}
			if (tokens < 1) return false;
			tokens -= 1;
			return true;
		},
	};
}