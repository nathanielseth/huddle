import { AnimatePresence, m } from "motion/react";
import { useBelievableLiesState } from "./hooks/useBelievableLiesState";
import { BelievableLiesPlayer } from "./BelievableLiesPlayer";
import { BelievableLiesHost } from "./host/BelievableLiesHost";
import { MemphisBg } from "./MemphisBg";
import "./believable-lies.css";

export function BelievableLies() {
	const { state, isHost } = useBelievableLiesState();

	if (!state) {
		return (
			<div className="bl-root">
				<MemphisBg />
				<div className="bl-content bl-center" style={{ minHeight: "100svh" }}>
					<span
						style={{
							fontFamily: "var(--bl-font)",
							color: "rgba(245,240,255,0.25)",
							fontSize: 13,
							letterSpacing: 3,
							textTransform: "uppercase",
						}}
					>
						Loading…
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="bl-root">
			<MemphisBg />
			<div className="bl-content">
				<AnimatePresence mode="wait">
					{isHost ? (
						<m.div
							key="host"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							<BelievableLiesHost />
						</m.div>
					) : (
						<m.div
							key="player"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							<BelievableLiesPlayer />
						</m.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}