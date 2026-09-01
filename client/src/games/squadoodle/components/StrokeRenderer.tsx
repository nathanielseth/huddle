import { strokeToPath } from "../lib/drawing";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@shared/games/squadoodle/index";
import type { Stroke } from "@shared/games/squadoodle/index";

interface Props {
	strokes: readonly Stroke[];
	/** Extra path for the currently-in-progress stroke (optional). */
	livePath?: { d: string; color: string; size: number } | null;
	className?: string;
}

export function StrokeRenderer({ strokes, livePath, className }: Props) {
	const paths = strokes.map((stroke) => ({
		d: strokeToPath(stroke, true),
		color: stroke.color,
	}));

	return (
		<svg
			viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
			preserveAspectRatio="xMidYMid meet"
			className={className}
			style={{ touchAction: "none" }}
		>
			{paths.map((p, i) =>
				p.d ? <path key={i} d={p.d} fill={p.color} stroke="none" /> : null,
			)}

			{livePath?.d && (
				<path d={livePath.d} fill={livePath.color} stroke="none" />
			)}
		</svg>
	);
}