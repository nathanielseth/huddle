import { useEffect, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useBelievableLiesState } from "../hooks/useBelievableLiesState";
import {
	RESULT_STEP_PICKS_AT_MS,
	RESULT_STEP_SCORES_AT_MS,
} from "../constants";

const ABSTAIN = "__abstain__";

type RevealStep = "answers" | "picks" | "scores";

export function Result() {
	const { state, playerId, getName } = useBelievableLiesState();
	const [step, setStep] = useState<RevealStep>("answers");

	useEffect(() => {
		const t1 = setTimeout(() => { setStep("picks"); }, RESULT_STEP_PICKS_AT_MS);
		const t2 = setTimeout(() => { setStep("scores"); }, RESULT_STEP_SCORES_AT_MS);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, []);

	if (!state?.lastResult) return null;

	const { prompt, truth, answers, picks, scoreDeltas } = state.lastResult;

	const myPick = picks[playerId];
	const didAbstain = myPick === ABSTAIN || myPick === undefined;

	const pickersPerAnswer = new Map<string, string[]>();
	for (const [pickerId, answerId] of Object.entries(picks)) {
		if (answerId === ABSTAIN) continue;
		const list = pickersPerAnswer.get(answerId) ?? [];
		list.push(pickerId);
		pickersPerAnswer.set(answerId, list);
	}

	return (
		<div className="bl-screen">
			{/* Header */}
			<div className="bl-header">
				<span className="bl-eyebrow">
					Round {state.roundNumber} · Q {state.questionIndex + 1} of{" "}
					{state.totalQuestionsThisRound}
				</span>
				<span className="bl-pill bl-pill-green">Results</span>
			</div>

			{/* Prompt recap */}
			<div className="bl-prompt bl-prompt-dark bl-mb-4">
				<p className="bl-eyebrow" style={{ marginBottom: 4 }}>
					{prompt}
				</p>
			</div>

			{/* Truth banner */}
			<div className="bl-truth-banner bl-mb-5">
				<div className="bl-truth-label">The truth</div>
				<div className="bl-truth-text">{truth}</div>
			</div>

			{/* Answer list */}
			<div className="bl-stack-2">
				{answers.map((answer, i) => {
					const pickers = pickersPerAnswer.get(answer.id) ?? [];
					const isMyLie = answer.authorIds.includes(playerId);
					const iPickedIt = myPick === answer.id;

					let rowClass = "bl-answer bl-answer-static";
					if (answer.isTruth) rowClass += " bl-answer-truth";
					else if (isMyLie) rowClass += " bl-answer-lie";

					return (
						<m.div
							key={answer.id}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.08 }}
							className={rowClass}
							style={{ flexDirection: "column", alignItems: "flex-start" }}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: 10,
									width: "100%",
								}}
							>
								<span className="bl-answer-num">{i + 1}</span>
								<span style={{ flex: 1 }}>{answer.text}</span>

								{answer.isTruth && (
									<span className="bl-answer-badge">← truth</span>
								)}
								{isMyLie && !answer.isTruth && (
									<span className="bl-answer-badge">← yours</span>
								)}
								{iPickedIt && !answer.isTruth && (
									<span
										className="bl-answer-badge"
										style={{ background: "rgba(0,0,0,0.35)" }}
									>
										← you picked
									</span>
								)}
							</div>

							{!answer.isTruth && answer.authorIds.length > 0 && (
								<p
									style={{
										fontSize: 12,
										opacity: 0.55,
										marginTop: 3,
										marginLeft: 28,
									}}
								>
									by{" "}
									{answer.authorIds
										.map((id) => (id === playerId ? "you" : getName(id)))
										.join(", ")}
								</p>
							)}
							{answer.isGameLie && (
								<p
									style={{
										fontSize: 12,
										opacity: 0.4,
										marginTop: 3,
										marginLeft: 28,
									}}
								>
									game lie
								</p>
							)}

							<AnimatePresence>
								{step !== "answers" && pickers.length > 0 && (
									<m.div
										initial={{ opacity: 0, scale: 0.85 }}
										animate={{ opacity: 1, scale: 1 }}
										className="bl-pickers"
										style={{ marginLeft: 28 }}
									>
										{pickers.map((pid) => (
											<span key={pid} className="bl-picker-tag">
												{pid === playerId ? "you" : getName(pid)}
											</span>
										))}
									</m.div>
								)}
							</AnimatePresence>
						</m.div>
					);
				})}
			</div>

			{didAbstain && (
				<p
					style={{
						textAlign: "center",
						fontSize: 12,
						color: "rgba(245,240,255,0.3)",
						marginTop: 12,
					}}
				>
					You ran out of time and didn't pick.
				</p>
			)}

			{/* Score deltas */}
			<AnimatePresence>
				{step === "scores" && (
					<m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
						<div className="bl-section">This question</div>
						{Object.entries(scoreDeltas)
							.sort(([, a], [, b]) => b - a)
							.map(([pid, delta]) => (
								<div key={pid} className="bl-delta-row">
									<span className="bl-delta-name">
										{pid === playerId ? (
											<strong style={{ color: "var(--bl-white)" }}>You</strong>
										) : (
											getName(pid)
										)}
									</span>
									<span
										className={`bl-delta-val ${delta > 0 ? "bl-delta-pos" : delta < 0 ? "bl-delta-neg" : "bl-delta-zero"}`}
									>
										{delta > 0 ? `+${delta}` : delta === 0 ? "–" : delta}
									</span>
								</div>
							))}
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}