import { getStroke } from "perfect-freehand";
import type { StrokeOptions } from "perfect-freehand";
import type { InputPoint, Stroke } from "@shared/games/squadoodle/index";

// ---------------------------------------------------------------------------
// Stroke rendering options
// ---------------------------------------------------------------------------

/**
 * Base options passed to getStroke(). Size is overridden per-stroke from
 * Stroke.size. These are tuned for a natural felt-tip feel.
 */
const BASE_OPTIONS = {
	thinning: 0.5,
	smoothing: 0.5,
	streamline: 0.5,
	simulatePressure: false, // we capture real pressure via PointerEvent
	easing: (t: number) => t,
	start: { cap: true, taper: 0 },
	end: { cap: true, taper: 0 },
	last: true,
} as const satisfies Omit<StrokeOptions, "size">;

function strokeOptions(size: number): StrokeOptions {
	return { ...BASE_OPTIONS, size };
}

// ---------------------------------------------------------------------------
// SVG path generation
// ---------------------------------------------------------------------------

/**
 * Converts a perfect-freehand outline point array into an SVG path `d` string.
 *
 * Uses quadratic Bézier curves (Q…T) for smooth rendering. The algorithm is
 * the canonical one from the perfect-freehand README, typed strictly.
 * Returns an empty string for degenerate strokes (< 4 outline points).
 */
function getSvgPathFromStroke(outlinePoints: number[][]): string {
	const len = outlinePoints.length;
	if (len < 4) return "";

	// Safe: len ≥ 4 guarantees indices 0, 1, 2 all exist.
	const a = outlinePoints[0] as [number, number];
	const b = outlinePoints[1] as [number, number];
	const c = outlinePoints[2] as [number, number];

	const avg = (u: number, v: number) => ((u + v) / 2).toFixed(2);
	const fmt = (n: number) => n.toFixed(2);

	let d =
		`M${fmt(a[0])},${fmt(a[1])} ` +
		`Q${fmt(b[0])},${fmt(b[1])} ` +
		`${avg(b[0], c[0])},${avg(b[1], c[1])} T`;

	for (let i = 2; i < len - 1; i++) {
		// Safe: loop bound ensures i and i+1 are valid.
		const p = outlinePoints[i] as [number, number];
		const q = outlinePoints[i + 1] as [number, number];
		d += `${avg(p[0], q[0])},${avg(p[1], q[1])} `;
	}

	return d + "Z";
}

// ---------------------------------------------------------------------------
// Public helper — convert one Stroke to a renderable SVG path string
// ---------------------------------------------------------------------------

/**
 * Runs a Stroke's InputPoints through perfect-freehand and returns the SVG
 * path `d` string. Returns an empty string for empty or degenerate strokes.
 *
 * Pass `last: false` while the stroke is still in progress (live rendering
 * during drawing) so perfect-freehand doesn't close the end cap prematurely.
 */
export function strokeToPath(stroke: Stroke, isComplete = true): string {
	if (stroke.points.length === 0) return "";

	const outline = getStroke(
		// perfect-freehand accepts object points natively
		stroke.points as InputPoint[],
		{ ...strokeOptions(stroke.size), last: isComplete },
	);

	return getSvgPathFromStroke(outline);
}
