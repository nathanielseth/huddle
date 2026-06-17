// returns the chain index that the player at playerIndex works on at step
export function chainForPlayer(
	playerIndex: number,
	step: number,
	playerCount: number,
): number {
	return (((playerIndex - step) % playerCount) + playerCount) % playerCount;
}

// steps 1, 3, 5, … are drawing. steps 2, 4, 6, … are guessing.
// step 0 is prompt writing (handled separately)
export function isDrawingStep(step: number): boolean {
	return step % 2 === 1;
}