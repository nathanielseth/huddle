import { useEffect, useState } from "react";
import type { GameTimer } from "@shared/core/room";
import type { BelievableLiesPhase } from "@shared/games/believable-lies/index";
import { PHASE_DURATION_MS } from "../constants";

interface HostTimerBarProps {
	timer: GameTimer;
	phase: BelievableLiesPhase;
}

function barColor(pct: number, phase: BelievableLiesPhase): string {
	if (pct <= 15) return "var(--bl-coral)";
	if (pct <= 35) return "var(--bl-yellow)";
	const map: Partial<Record<BelievableLiesPhase, string>> = {
		lie_input: "var(--bl-pink)",
		picking: "var(--bl-cyan)",
		result: "var(--bl-green)",
	};
	return map[phase] ?? "var(--bl-cyan)";
}

const BAR_CONTAINER: React.CSSProperties = {
	position: "fixed",
	bottom: 0,
	left: 0,
	right: 0,
	zIndex: 50,
	display: "flex",
	alignItems: "center",
	background: "rgba(10, 0, 20, 0.92)",
	backdropFilter: "blur(8px)",
	borderTop: "4px solid #000",
	height: 72,
	padding: "0 40px",
	gap: 24,
};

const SECONDS_READOUT: React.CSSProperties = {
	fontFamily: "var(--bl-font)",
	fontSize: 40,
	minWidth: 64,
	textAlign: "right",
	transition: "color 0.4s",
	flexShrink: 0,
};

const TRACK: React.CSSProperties = {
	flex: 1,
	height: 24,
	background: "rgba(255,255,255,0.08)",
	borderRadius: 12,
	overflow: "hidden",
	border: "2px solid rgba(255,255,255,0.06)",
};

const FILL_BASE: React.CSSProperties = {
	height: "100%",
	width: "100%",
	transformOrigin: "left",
	borderRadius: 12,
	transition: "transform 0.1s linear, background-color 0.4s, box-shadow 0.4s",
};

export function HostTimerBar({ timer, phase }: HostTimerBarProps) {
	const [pct, setPct] = useState(100);
	const [secs, setSecs] = useState(0);

	useEffect(() => {
		const duration = PHASE_DURATION_MS[phase];
		if (duration === undefined) return;

		const durationMs: number = duration;

		function tick() {
			const remaining = Math.max(0, durationMs - (Date.now() - timer.startsAt));
			setPct((remaining / durationMs) * 100);
			setSecs(Math.ceil(remaining / 1000));
		}

		tick();
		const id = setInterval(tick, 100);
		return () => { clearInterval(id); };
	}, [timer.startsAt, phase]);

	const duration = PHASE_DURATION_MS[phase];
	if (!duration) return null;

	const color = barColor(pct, phase);

	return (
		<div style={BAR_CONTAINER}>
			<span style={{ ...SECONDS_READOUT, color }}>{secs}</span>

			<div style={TRACK}>
				<div
					style={{
						...FILL_BASE,
						transform: `scaleX(${pct / 100})`,
						background: color,
						boxShadow: `0 0 16px ${color}, 0 0 4px ${color}`,
					}}
				/>
			</div>
		</div>
	);
}