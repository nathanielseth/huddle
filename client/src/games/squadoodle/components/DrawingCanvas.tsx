import { useState, useRef, useReducer } from "react";
import { m } from "motion/react";
import { StrokeRenderer } from "./StrokeRenderer";
import { strokeToPath } from "../lib/drawing";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@shared/games/squadoodle/index";
import type { Stroke, InputPoint } from "@shared/games/squadoodle/index";
import { cn } from "../../../lib/utils/cn";

// ---------------------------------------------------------------------------
// Palette + sizes
// ---------------------------------------------------------------------------

const PALETTE = [
	"#111111", // black  (default)
	"#f87171", // red
	"#fb923c", // orange
	"#facc15", // yellow
	"#4ade80", // green
	"#60a5fa", // blue
	"#c084fc", // purple
	"#f472b6", // pink
	"#ffffff", // white  (eraser on white canvas)
] as const;

const SIZES = [4, 10, 20, 36] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveStroke {
	points: InputPoint[];
	color: string;
	size: number;
}

interface Props {
	/** Called when the player taps Submit with the completed strokes. */
	onSubmit: (strokes: Stroke[]) => void;
	/** Prompt text shown above the canvas ("Draw: …") */
	prompt: string;
}

// ---------------------------------------------------------------------------
// Fix: prefer-useReducer — merge strokes, liveStroke, and submitted into one
// reducer. These three are tightly coupled drawing-lifecycle state: committing
// a stroke moves points from liveStroke into strokes; submitting locks both.
// color and size are independent tool preferences and stay as useState — they
// have no causal relationship to stroke state and changing one never needs to
// atomically change the other.
// ---------------------------------------------------------------------------

type DrawingState = {
	strokes: Stroke[];
	liveStroke: LiveStroke | null;
	submitted: boolean;
};

type DrawingAction =
	| { type: "START_STROKE"; stroke: LiveStroke }
	| { type: "UPDATE_STROKE"; stroke: LiveStroke }
	| { type: "COMMIT_STROKE" }
	| { type: "UNDO" }
	| { type: "CLEAR" }
	| { type: "SUBMIT" };

const INITIAL_DRAWING: DrawingState = {
	strokes: [],
	liveStroke: null,
	submitted: false,
};

function drawingReducer(
	state: DrawingState,
	action: DrawingAction,
): DrawingState {
	if (state.submitted) return state; // lock once submitted

	switch (action.type) {
		case "START_STROKE":
			return { ...state, liveStroke: action.stroke };

		case "UPDATE_STROKE":
			return { ...state, liveStroke: action.stroke };

		case "COMMIT_STROKE": {
			const live = state.liveStroke;
			if (!live || live.points.length === 0)
				return { ...state, liveStroke: null };
			const committed: Stroke = {
				points: live.points,
				color: live.color,
				size: live.size,
			};
			return {
				...state,
				strokes: [...state.strokes, committed],
				liveStroke: null,
			};
		}

		case "UNDO":
			return { ...state, strokes: state.strokes.slice(0, -1) };

		case "CLEAR":
			return { ...state, strokes: [] };

		case "SUBMIT":
			return { ...state, submitted: true };

		default:
			return state;
	}
}

// ---------------------------------------------------------------------------
// Coordinate mapping
// ---------------------------------------------------------------------------

/**
 * Maps a PointerEvent client coordinate into the logical 800×600 canvas space.
 *
 * Uses getScreenCTM().inverse() rather than getBoundingClientRect() arithmetic
 * because preserveAspectRatio="xMidYMid meet" letterboxes the viewBox inside
 * the SVG element — the actual drawing area is smaller than the element and
 * centred within it. getBoundingClientRect() gives element dimensions, not
 * content dimensions, so the mapping is wrong. getScreenCTM() returns the
 * exact matrix the browser used to position the viewBox, so inverting it
 * gives a pixel-perfect client→SVG transform for free.
 */
function toLogical(
	e: React.PointerEvent,
	svgRef: React.RefObject<SVGSVGElement | null>,
): InputPoint | null {
	const svg = svgRef.current;
	if (!svg) return null;

	const ctm = svg.getScreenCTM();
	if (!ctm) return null;

	const pt = svg.createSVGPoint();
	pt.x = e.clientX;
	pt.y = e.clientY;
	const svgPt = pt.matrixTransform(ctm.inverse());

	return {
		x: svgPt.x,
		y: svgPt.y,
		pressure: e.pressure > 0 ? e.pressure : 0.5,
	};
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrawingCanvas({ onSubmit, prompt }: Props) {
	const svgRef = useRef<SVGSVGElement | null>(null);

	// Fix: prefer-useReducer — drawing lifecycle state in one reducer.
	const [drawing, dispatch] = useReducer(drawingReducer, INITIAL_DRAWING);
	const { strokes, liveStroke, submitted } = drawing;

	// color and size are independent tool preferences — left as useState.
	const [color, setColor] = useState<string>(PALETTE[0]);
	const [size, setSize] = useState<number>(SIZES[1]);

	// Track the current live stroke in a ref so pointer handlers always close
	// over the latest value without needing it in their dep arrays.
	const liveRef = useRef<LiveStroke | null>(null);

	// ---------------------------------------------------------------------------
	// Pointer handlers
	// ---------------------------------------------------------------------------

	function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
		if (submitted) return;
		e.currentTarget.setPointerCapture(e.pointerId);

		const pt = toLogical(e, svgRef);
		if (!pt) return;

		const stroke: LiveStroke = { points: [pt], color, size };
		liveRef.current = stroke;
		dispatch({ type: "START_STROKE", stroke });
	}

	function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
		if (!liveRef.current || e.buttons !== 1) return;

		const pt = toLogical(e, svgRef);
		if (!pt) return;

		const updated: LiveStroke = {
			...liveRef.current,
			points: [...liveRef.current.points, pt],
		};
		liveRef.current = updated;
		dispatch({ type: "UPDATE_STROKE", stroke: updated });
	}

	function handlePointerUp() {
		if (!liveRef.current) return;
		liveRef.current = null;
		dispatch({ type: "COMMIT_STROKE" });
	}

	// ---------------------------------------------------------------------------
	// Toolbar actions
	// ---------------------------------------------------------------------------

	function undo() {
		dispatch({ type: "UNDO" });
	}

	function clear() {
		dispatch({ type: "CLEAR" });
	}

	function submit() {
		if (submitted) return;
		dispatch({ type: "SUBMIT" });
		onSubmit(strokes);
	}

	// ---------------------------------------------------------------------------
	// Live path for StrokeRenderer
	// ---------------------------------------------------------------------------

	const livePath = liveStroke
		? {
				d: strokeToPath({ ...liveStroke, points: liveStroke.points }, false),
				color: liveStroke.color,
				size: liveStroke.size,
			}
		: null;

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	return (
		<div className="flex flex-col h-full gap-3 select-none">
			{/* Prompt */}
			<p className="text-xs font-bold tracking-[0.2em] uppercase text-white/30 shrink-0">
				Draw:{" "}
				<span className="text-white/80 normal-case tracking-normal font-semibold">
					{prompt}
				</span>
			</p>

			{/* Canvas */}
			<div className="relative flex-1 rounded-2xl overflow-hidden border border-black/10 bg-white">
				<StrokeRenderer
					strokes={strokes}
					livePath={livePath}
					className="absolute inset-0 w-full h-full cursor-crosshair"
				/>
				<svg
					ref={svgRef}
					viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
					preserveAspectRatio="xMidYMid meet"
					className="absolute inset-0 w-full h-full cursor-crosshair"
					style={{ touchAction: "none" }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
				/>
			</div>

			{/* Toolbar */}
			<div className="flex flex-col gap-2 shrink-0">
				{/* Palette */}
				<div className="flex gap-1.5 flex-wrap">
					{PALETTE.map((c) => (
						<button
							key={c}
							type="button"
							aria-label={c}
							onClick={() => { setColor(c); }}
							className={cn(
								"w-7 h-7 rounded-full border-2 transition-transform",
								color === c
									? "border-white scale-110"
									: c === "#ffffff"
										? "border-white/40 scale-100 opacity-70"
										: "border-transparent scale-100 opacity-70",
							)}
							style={{ background: c }}
						/>
					))}
				</div>

				{/* Sizes + actions */}
				<div className="flex items-center gap-2">
					{/* Size picker */}
					<div className="flex items-center gap-1.5">
						{SIZES.map((s) => (
							<button
								key={s}
								type="button"
								aria-label={`Size ${s}`}
								onClick={() => { setSize(s); }}
								className={cn(
									"flex items-center justify-center w-8 h-8 rounded-full border transition-colors",
									size === s
										? "border-white/60 bg-white/10"
										: "border-white/10 bg-transparent",
								)}
							>
								<span
									className="rounded-full bg-white"
									style={{
										width: Math.max(3, s / 4),
										height: Math.max(3, s / 4),
									}}
								/>
							</button>
						))}
					</div>

					<div className="flex-1" />

					{/* Undo */}
					<button
						type="button"
						onClick={undo}
						disabled={strokes.length === 0 || submitted}
						className="px-3 h-8 rounded-xl text-xs font-semibold text-white/50 border border-white/10 hover:border-white/30 hover:text-white/80 disabled:opacity-30 transition-colors"
					>
						Undo
					</button>

					{/* Clear */}
					<button
						type="button"
						onClick={clear}
						disabled={strokes.length === 0 || submitted}
						className="px-3 h-8 rounded-xl text-xs font-semibold text-white/50 border border-white/10 hover:border-red-400/50 hover:text-red-400 disabled:opacity-30 transition-colors"
					>
						Clear
					</button>
				</div>

				{/* Submit */}
				<m.button
					type="button"
					onClick={submit}
					disabled={submitted}
					whileTap={{ scale: 0.97 }}
					className="w-full h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-display font-bold text-lg uppercase tracking-wide disabled:opacity-40 transition-all hover:bg-indigo-500/30 cursor-pointer"
				>
					{submitted ? "Submitted ✓" : "Submit Drawing"}
				</m.button>
			</div>
		</div>
	);
}