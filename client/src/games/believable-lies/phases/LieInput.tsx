import { useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useBelievableLiesState } from "../hooks/useBelievableLiesState";

const MAX_LIE_LENGTH = 80;

export function LieInput() {
	const { state, playerId, sendAction, getName } = useBelievableLiesState();
	const [text, setText] = useState("");

	if (!state) return null;

	const myView = state.players[playerId];
	const hasSubmitted = myView?.hasSubmittedLie ?? false;
	const playerList = Object.values(state.players);
	const submitted = playerList.filter((p) => p.hasSubmittedLie);

	const charsLeft = MAX_LIE_LENGTH - text.length;
	const isOverLimit = charsLeft < 0;

	function handleSubmit() {
		const trimmed = text.trim();
		if (!trimmed || isOverLimit) return;
		sendAction({ type: "submit_lie", text: trimmed });
		setText("");
	}

	return (
		<div className="bl-screen">
			{/* Header */}
			<div className="bl-header">
				<span className="bl-eyebrow">
					Round {state.roundNumber} · Q {state.questionIndex + 1} of{" "}
					{state.totalQuestionsThisRound}
				</span>
				<span className="bl-eyebrow">
					{submitted.length}/{playerList.length} ready
				</span>
			</div>

			{/* Timer */}
			<div className="bl-timer">
				<div className="bl-timer-track">
					{/* width driven by parent — HostTimerBar handles host; player sees the raw bar */}
					<div className="bl-timer-fill" style={{ width: "100%" }} />
				</div>
			</div>

			{/* Prompt */}
			<div className="bl-prompt bl-mb-5">
				<div
					className="bl-eyebrow bl-eyebrow-yellow"
					style={{ marginBottom: 8 }}
				>
					Fill in the blank
				</div>
				<p className="bl-prompt-text">{state.currentPrompt}</p>
			</div>

			{/* Input area / submitted state */}
			<AnimatePresence mode="wait">
				{hasSubmitted ? (
					<m.div
						key="submitted"
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						className="bl-waiting"
					>
						<div className="bl-waiting-icon">✓</div>
						<p className="bl-waiting-text">
							Lie submitted. Waiting for others…
						</p>
						<div className="bl-dots">
							{playerList.map((p) => (
								<div
									key={p.playerId}
									className={`bl-dot${p.hasSubmittedLie ? " bl-dot-done" : ""}`}
								/>
							))}
						</div>
					</m.div>
				) : (
					<m.div
						key="input"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="bl-stack-2"
					>
						<input
							type="text"
							aria-label="Type your lie"
							value={text}
							onChange={(e) => { setText(e.target.value); }}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !isOverLimit && text.trim())
									handleSubmit();
							}}
							placeholder="Type your lie…"
							maxLength={MAX_LIE_LENGTH + 10}
							className="bl-input"
						/>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
							}}
						>
							<span
								style={{
									fontFamily: "monospace",
									fontSize: 12,
									color: isOverLimit
										? "var(--bl-coral)"
										: charsLeft <= 15
											? "rgba(245,240,255,0.5)"
											: "transparent",
								}}
							>
								{charsLeft} left
							</span>
							<button
								type="button"
								onClick={handleSubmit}
								disabled={!text.trim() || isOverLimit}
								className="bl-btn bl-btn-pink"
							>
								Submit
							</button>
						</div>
					</m.div>
				)}
			</AnimatePresence>

			{/* Player strip */}
			<div
				className="bl-mt-auto"
				style={{
					paddingTop: 20,
					borderTop: "1px solid rgba(255,255,255,0.08)",
				}}
			>
				<div className="bl-eyebrow" style={{ marginBottom: 8 }}>
					Players
				</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
					{playerList.map((p) => (
						<div
							key={p.playerId}
							className={`bl-player-chip${p.hasSubmittedLie ? " bl-player-chip-done" : ""}`}
						>
							<span className="bl-player-chip-dot" />
							{getName(p.playerId)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}