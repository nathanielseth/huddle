import { useState } from "react";
import { m } from "motion/react";
import { useBelievableLiesState } from "../hooks/useBelievableLiesState";

export function Picking() {
	const { state, playerId, sendAction, getName } = useBelievableLiesState();
	const [optimisticPickId, setOptimisticPickId] = useState<string | null>(null);

	if (!state?.answers) return null;

	const myView = state.players[playerId];
	const hasPicked = (myView?.hasPicked ?? false) || optimisticPickId !== null;
	const playerList = Object.values(state.players);
	const pickedCount = playerList.filter((p) => p.hasPicked).length;

	function handlePick(answerId: string) {
		if (hasPicked) return;
		setOptimisticPickId(answerId);
		sendAction({ type: "pick_answer", answerId });
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
					{pickedCount}/{playerList.length} picked
				</span>
			</div>

			{/* Timer */}
			<div className="bl-timer">
				<div className="bl-timer-track">
					<div
						className="bl-timer-fill bl-timer-fill-pink"
						style={{ width: "100%" }}
					/>
				</div>
			</div>

			{/* Prompt */}
			<div className="bl-prompt bl-prompt-dark bl-mb-5">
				<div className="bl-eyebrow bl-eyebrow-cyan" style={{ marginBottom: 8 }}>
					Which one is true?
				</div>
				<p className="bl-prompt-text">{state.currentPrompt}</p>
			</div>

			{/* Answers */}
			<div className="bl-stack-2" style={{ flex: 1 }}>
				{state.answers.map((answer, i) => {
					const isSelected = optimisticPickId === answer.id;

					return (
						<m.button
							key={answer.id}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: i * 0.06 }}
							onClick={() => { handlePick(answer.id); }}
							disabled={hasPicked}
							className={[
								"bl-answer",
								isSelected ? "bl-answer-selected" : "",
								hasPicked && !isSelected ? "bl-answer-disabled" : "",
							].join(" ")}
						>
							<span className="bl-answer-num">{i + 1}</span>
							{answer.text}
						</m.button>
					);
				})}
			</div>

			{/* Waiting strip */}
			{hasPicked && (
				<m.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className="bl-waiting"
				>
					<p className="bl-waiting-text">Waiting for everyone…</p>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
						{playerList.map((p) => (
							<div
								key={p.playerId}
								className={`bl-player-chip${p.hasPicked ? " bl-player-chip-done" : ""}`}
							>
								<span className="bl-player-chip-dot" />
								{p.playerId === playerId ? "You" : getName(p.playerId)}
							</div>
						))}
					</div>
				</m.div>
			)}
		</div>
	);
}