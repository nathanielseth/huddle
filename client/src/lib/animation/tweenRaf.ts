function easeInOutQuart(t: number): number {
	return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2;
}

export function tweenRaf(
	from: number,
	to: number,
	durationMs: number,
	onUpdate: (v: number) => void,
	onComplete: () => void,
): () => void {
	const start = Date.now();
	let rafId: number;

	const tick = () => {
		const t = Math.min((Date.now() - start) / durationMs, 1);
		onUpdate(from + (to - from) * easeInOutQuart(t));
		if (t >= 1) onComplete();
		else rafId = requestAnimationFrame(tick);
	};

	rafId = requestAnimationFrame(tick);
	return () => cancelAnimationFrame(rafId);
}