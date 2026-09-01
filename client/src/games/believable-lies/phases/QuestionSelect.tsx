import { useEffect, useState } from "react";
import { useBelievableLiesState } from "../hooks/useBelievableLiesState";
import { PHASE_DURATION_MS } from "../constants";

const CATEGORY_EMOJI: Record<string, string> = {
	History: "🏛️",
	Science: "🔬",
	Food: "🍜",
	"Pop Culture": "🎬",
	Filipino: "🇵🇭",
	Weird: "🌀",
};

function useSecsLeft(
	startsAt: number | undefined,
	durationMs: number,
): number | null {
	const [secs, setSecs] = useState<number | null>(null);

	useEffect(() => {
		if (startsAt === undefined) return;
		function tick() {
			const remaining = Math.max(0, durationMs - (Date.now() - startsAt!));
			setSecs(Math.ceil(remaining / 1000));
		}
		tick();
		const id = setInterval(tick, 500);
		return () => { clearInterval(id); };
	}, [startsAt, durationMs]);

	return secs;
}

export function QuestionSelect() {
	const { state, playerId, sendAction, getName, timer } =
		useBelievableLiesState();
	const secsLeft = useSecsLeft(
		timer?.startsAt,
		PHASE_DURATION_MS.question_select ?? 15_000,
	);

	if (!state) return null;

	const isPicker = state.pickerPlayerId === playerId;
	const pickerName = state.pickerPlayerId
		? getName(state.pickerPlayerId)
		: "Someone";
	const choices = state.categoryChoices ?? [];

	function handlePick(category: string) {
		sendAction({ type: "select_category", category });
	}

	return (
		<div className="bl-screen bl-center">
			{/* Round badge */}
			<span className="bl-eyebrow">
				Round {state.roundNumber} · Q {state.questionIndex + 1} of{" "}
				{state.totalQuestionsThisRound}
			</span>

			{isPicker ? (
				<>
					<div style={{ textAlign: "center" }}>
						<p className="bl-muted" style={{ marginBottom: 6 }}>
							You're picking the category
						</p>
						<h2 className="bl-title">What are we lying about?</h2>
					</div>

					<div className="bl-stack-3 bl-full-width">
						{choices.map((cat) => (
							<button
								key={cat}
								type="button"
								onClick={() => { handlePick(cat); }}
								className="bl-cat-btn"
							>
								<span className="bl-cat-icon">
									{CATEGORY_EMOJI[cat] ?? "❓"}
								</span>
								<span className="bl-cat-label">{cat}</span>
							</button>
						))}
					</div>
				</>
			) : (
				<>
					<div style={{ textAlign: "center" }}>
						<p className="bl-muted" style={{ marginBottom: 6 }}>
							<span style={{ color: "var(--bl-white)", opacity: 0.85 }}>
								{pickerName}
							</span>{" "}
							is choosing the category
						</p>
						<h2
							className="bl-subtitle"
							style={{ color: "rgba(245,240,255,0.5)" }}
						>
							Stand by…
						</h2>
						{secsLeft !== null && (
							<p
								style={{
									fontFamily: "monospace",
									fontSize: 12,
									color: "rgba(245,240,255,0.2)",
									marginTop: 6,
								}}
							>
								{secsLeft}s
							</p>
						)}
					</div>

					{/* Ghosted non-interactive choices */}
					<div
						className="bl-stack-3 bl-full-width"
						style={{ opacity: 0.2, pointerEvents: "none", userSelect: "none" }}
					>
						{choices.map((cat) => (
							<div
								key={cat}
								className="bl-cat-btn"
								style={{ cursor: "default" }}
							>
								<span className="bl-cat-icon">
									{CATEGORY_EMOJI[cat] ?? "❓"}
								</span>
								<span className="bl-cat-label">{cat}</span>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}