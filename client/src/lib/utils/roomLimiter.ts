const RATE_WINDOW_MS = 30_000;
const MAX_CREATES = 4;

const recentCreateTimestamps: number[] = [];

const ANGRY_MESSAGES = [
	"HOY! Tigilan mo yan!",
	"You're being limited, mf!",
	"Spam pa more!",
	"YOU MUST LEARN PATIENCE!",
];
let angryIndex = 0;

export function checkCreateRateLimit(): boolean {
	const now = Date.now();
	const cutoff = now - RATE_WINDOW_MS;
	while (
		recentCreateTimestamps.length > 0 &&
		recentCreateTimestamps[0] < cutoff
	) {
		recentCreateTimestamps.shift();
	}
	if (recentCreateTimestamps.length >= MAX_CREATES) return false;
	recentCreateTimestamps.push(now);
	return true;
}

export function nextAngryMessage(): string {
	return ANGRY_MESSAGES[angryIndex++ % ANGRY_MESSAGES.length];
}
