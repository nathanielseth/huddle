// client/src/games/poker/lib/tableGeometry.ts
//
// Pure seat-angle math, split out of TableSurface.tsx so that file can export
// only the TableSurface component (react-refresh requires component files to
// export components only).
//
// Fractions must match TableSurface's DIMENSIONS per orientation, or seats
// won't hug the rail edge the felt is actually drawn at.

export type TableOrientation = "landscape" | "portrait";

const RX_FRAC: Record<TableOrientation, number> = {
	landscape: 0.418, // 418 / 1000
	portrait: 0.453, // 290 / 640
};
const RY_FRAC: Record<TableOrientation, number> = {
	landscape: 0.389, // 218 / 560
	portrait: 0.443, // 430 / 970
};

/**
 * Position for seat `index` of `total`, hugging the rail edge.
 * `rotationOffset` (radians) rotates the whole ring — pass an offset that
 * puts a chosen seat at the bottom (Math.PI / 2) so "my" seat always reads
 * as the near/bottom position on a phone screen.
 */
export function getSeatPosition(
	index: number,
	total: number,
	rotationOffset = 0,
	orientation: TableOrientation = "landscape",
): { left: string; top: string; transform: string } {
	const angle = (index / total) * 2 * Math.PI - Math.PI / 2 + rotationOffset;
	const left = 50 + RX_FRAC[orientation] * 107 * Math.cos(angle);
	const top = 50 + RY_FRAC[orientation] * 107 * Math.sin(angle);
	return {
		left: `${left}%`,
		top: `${top}%`,
		transform: "translate(-50%, -50%)",
	};
}

/**
 * Given a seat order and "my" id, rotate the ring so my seat lands at the
 * bottom (angle = +90°, i.e. Math.PI/2 in the coordinate system above).
 */
export function getRotationOffsetForSeat(
	mySeatIdx: number,
	total: number,
): number {
	const myNaturalAngle = (mySeatIdx / total) * 2 * Math.PI - Math.PI / 2;
	return Math.PI / 2 - myNaturalAngle;
}

/**
 * Position for a player's current-bet chip stack, just off their own seat —
 * NOT attached to the seat badge itself (so it still reads as a chip on the
 * felt, not more text in the name plate), but close enough that ownership is
 * obvious without a connecting line.
 *
 * Same angle as the seat (radially aligned with its owner). `radiusPct`
 * controls how far inside the seat's own radius the chip sits — smaller
 * badges (mobile) can use a value close to the seat's own radius; larger
 * badges (host) need a smaller value so the chip clears the badge box
 * instead of overlapping its edge. Callers should tune this against their
 * own badge footprint rather than sharing one constant across very
 * differently-sized badges.
 */
export function getBetChipPosition(
	index: number,
	total: number,
	rotationOffset = 0,
	orientation: TableOrientation = "landscape",
	radiusPct = 85,
): { left: string; top: string; transform: string } {
	const angle = (index / total) * 2 * Math.PI - Math.PI / 2 + rotationOffset;
	const left = 50 + RX_FRAC[orientation] * radiusPct * Math.cos(angle);
	const top = 50 + RY_FRAC[orientation] * radiusPct * Math.sin(angle);
	return {
		left: `${left}%`,
		top: `${top}%`,
		transform: "translate(-50%, -50%)",
	};
}