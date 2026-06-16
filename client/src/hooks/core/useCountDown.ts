import { useEffect, useState } from "react";
import type { GameTimer } from "@shared/core/room";

export function useCountdown(timer: GameTimer | null): number {
	const startsAt = timer?.startsAt;
	const duration = timer?.duration;

	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (startsAt === undefined || duration === undefined) return;

		const id = setInterval(() => {
			const current = Date.now();
			setNow(current);

			if (current >= startsAt + duration) {
				clearInterval(id);
			}
		}, 250);

		return () => clearInterval(id);
	}, [startsAt, duration]);

	if (startsAt === undefined || duration === undefined) {
		return 0;
	}

	const remaining = startsAt + duration - now;
	return Math.max(remaining, 0);
}
