// client/src/games/poker/components/TableSurface.tsx
//
// Shared SVG felt/rail graphic. Both PokerTableHost (TV/big-screen) and
// PokerTablePlayer (phone) render the same physical table, but at different
// proportions: the host is landscape (wide TV), the phone table is portrait
// (tall, narrow — like a real table rotated to face you). Passing the wrong
// orientation's viewBox into a differently-shaped container just squishes the
// oval into a squat band with dead space around it, which is the bug this
// prop exists to prevent.
//
// Seat-angle math lives in ../lib/tableGeometry — import it from there
// directly (e.g. `import { getSeatPosition } from "./lib/tableGeometry"`).
// This file must export ONLY the component, or react-refresh breaks.

interface TableSurfaceProps {
	/** "landscape" (host/TV, wide) or "portrait" (phone, tall). Default landscape. */
	orientation?: "landscape" | "portrait";
}

const DIMENSIONS = {
	landscape: { width: 1000, height: 560, rx: 418, ry: 218 },
	// Portrait: width/height ≈ 0.66, matching a real table turned to face the
	// player — tall enough that seats read as "around" rather than "beside".
	portrait: { width: 640, height: 970, rx: 290, ry: 430 },
} as const;

export function TableSurface({ orientation = "landscape" }: TableSurfaceProps) {
	const { width, height, rx, ry } = DIMENSIONS[orientation];
	const cx = width / 2;
	const cy = height / 2;
	// Rail sits ~7-8% further out than the felt on both axes.
	const railRx = rx * 1.076;
	const railRy = ry * 1.076;
	const highlightRx = rx * 1.033;
	const highlightRy = ry * 1.033;
	const noiseStrokeWidth = Math.round(((rx + ry) / 2) * 0.076);
	const watermarkRx = width * 0.06;
	const watermarkRy = height * 0.033;

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			xmlns="http://www.w3.org/2000/svg"
			className="w-full h-full"
			aria-hidden="true"
		>
			<defs>
				<filter id="felt-noise" x="0%" y="0%" width="100%" height="100%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.65"
						numOctaves="3"
						stitchTiles="stitch"
						result="noise"
					/>
					<feColorMatrix type="saturate" values="0" in="noise" result="grey" />
					<feBlend
						in="SourceGraphic"
						in2="grey"
						mode="multiply"
						result="blend"
					/>
					<feComposite in="blend" in2="SourceGraphic" operator="in" />
				</filter>

				<radialGradient id="felt-gradient" cx="50%" cy="45%" r="60%">
					<stop offset="0%" stopColor="#2a5c3f" />
					<stop offset="55%" stopColor="#1a4230" />
					<stop offset="100%" stopColor="#0e2a1e" />
				</radialGradient>

				<radialGradient id="rail-gradient" cx="50%" cy="30%" r="70%">
					<stop offset="0%" stopColor="#6b4423" />
					<stop offset="40%" stopColor="#4a2e16" />
					<stop offset="100%" stopColor="#2c1a0a" />
				</radialGradient>

				<filter id="felt-shadow" x="-5%" y="-5%" width="110%" height="110%">
					<feDropShadow
						dx="0"
						dy="0"
						stdDeviation="18"
						floodColor="#000"
						floodOpacity="0.7"
					/>
				</filter>

				<clipPath id={`felt-clip-${orientation}`}>
					<ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
				</clipPath>
			</defs>

			<ellipse
				cx={cx}
				cy={cy}
				rx={railRx}
				ry={railRy}
				fill="url(#rail-gradient)"
				filter="url(#felt-shadow)"
			/>
			{/* bright highlight ellipse offset toward the top, like light catching
			    the rounded top edge of the wood rail */}
			<ellipse
				cx={cx}
				cy={cy - ry * 0.06}
				rx={railRx * 0.97}
				ry={railRy * 0.97}
				fill="none"
				stroke="rgba(255,255,255,0.10)"
				strokeWidth={Math.max(2, noiseStrokeWidth * 0.35)}
			/>
			<ellipse
				cx={cx}
				cy={cy}
				rx={highlightRx}
				ry={highlightRy}
				fill="none"
				stroke="rgba(255,255,255,0.08)"
				strokeWidth="2"
			/>
			{/* dark inner-edge line where rail meets felt, for a carved lip look */}
			<ellipse
				cx={cx}
				cy={cy}
				rx={rx * 1.012}
				ry={ry * 1.012}
				fill="none"
				stroke="rgba(0,0,0,0.5)"
				strokeWidth={Math.max(2, noiseStrokeWidth * 0.15)}
			/>
			<ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#felt-gradient)" />
			<ellipse
				cx={cx}
				cy={cy}
				rx={rx}
				ry={ry}
				fill="url(#felt-gradient)"
				filter="url(#felt-noise)"
				opacity="0.18"
				clipPath={`url(#felt-clip-${orientation})`}
			/>
			<ellipse
				cx={cx}
				cy={cy}
				rx={rx}
				ry={ry}
				fill="none"
				stroke="rgba(0,0,0,0.35)"
				strokeWidth={noiseStrokeWidth}
			/>
			<ellipse
				cx={cx}
				cy={cy}
				rx={watermarkRx}
				ry={watermarkRy}
				fill="none"
				stroke="rgba(255,255,255,0.04)"
				strokeWidth="1.5"
			/>
		</svg>
	);
}