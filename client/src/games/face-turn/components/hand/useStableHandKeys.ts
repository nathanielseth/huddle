import { useRef } from "react";

let nextInstanceId = 0;

export function useStableHandKeys(cardIds: readonly string[]): string[] {
	const poolsRef = useRef(new Map<string, string[]>());
	const consumed = new Map<string, number>();
	const keys: string[] = new Array(cardIds.length);

	for (let i = 0; i < cardIds.length; i++) {
		const moveId = cardIds[i]!;
		const pool = poolsRef.current.get(moveId);
		const used = consumed.get(moveId) ?? 0;
		keys[i] =
			pool && used < pool.length
				? pool[used]!
				: `${moveId}#${nextInstanceId++}`;
		consumed.set(moveId, used + 1);
	}

	const nextPools = new Map<string, string[]>();
	for (let i = 0; i < cardIds.length; i++) {
		const moveId = cardIds[i]!;
		const arr = nextPools.get(moveId);
		if (arr) arr.push(keys[i]!);
		else nextPools.set(moveId, [keys[i]!]);
	}
	poolsRef.current = nextPools;

	return keys;
}