import { AnimatePresence, m } from "motion/react";
import { useBelievableLiesState } from "../hooks/useBelievableLiesState";
import { HostTimerBar } from "./HostTimerBar";
import { useHostPhaseNarration } from "./useHostPhaseNarration";
import type { BelievableLiesPhase } from "@shared/games/believable-lies/index";

const PHASE_LABEL: Record<BelievableLiesPhase, string> = {
	question_select: "Choosing category",
	lie_input: "Writing lies",
	picking: "Picking the truth",
	result: "Results",
	round_end: "Round summary",
	finished: "Game over",
};

// ─── Shared host styles (TV/monitor scale) ────────────────────────────────────

const HOST_PROMPT: React.CSSProperties = {
	width: "100%",
	background: "var(--bl-purple)",
	border: "var(--bl-border)",
	borderRadius: "var(--bl-radius-lg)",
	padding: "32px 40px",
	boxShadow: "var(--bl-shadow-lg)",
	marginBottom: 32,
};

const HOST_PROMPT_TEXT: React.CSSProperties = {
	fontFamily: "var(--bl-font)",
	fontSize: 40,
	lineHeight: 1.3,
	color: "var(--bl-white)",
};

const HOST_ANSWER: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 20,
	padding: "22px 32px",
	background: "#000",
	border: "var(--bl-border)",
	borderRadius: "var(--bl-radius)",
	boxShadow: "var(--bl-shadow-purple)",
	fontFamily: "var(--bl-font)",
	fontSize: 28,
	color: "var(--bl-white)",
};

const HOST_ANSWER_TRUTH: React.CSSProperties = {
	...HOST_ANSWER,
	background: "var(--bl-green)",
	color: "#000",
	boxShadow: "var(--bl-shadow-md)",
};

const HOST_ANSWER_NUM: React.CSSProperties = {
	fontSize: 18,
	fontFamily: "monospace",
	opacity: 0.4,
	minWidth: 28,
	flexShrink: 0,
};

// player-status row styles (LieInputHost / PickingHost), keyed by
// whether this player has completed the phase's action yet
const PLAYER_ROW_BASE: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 14,
	padding: "14px 20px",
	borderRadius: "var(--bl-radius)",
	fontFamily: "var(--bl-font)",
	fontSize: 22,
	transition: "background-color 0.3s, border-color 0.3s, color 0.3s",
};

const PLAYER_ROW_DONE: React.CSSProperties = {
	...PLAYER_ROW_BASE,
	background: "rgba(0,255,148,0.1)",
	border: "3px solid var(--bl-green)",
	color: "var(--bl-green)",
};

const PLAYER_ROW_PENDING: React.CSSProperties = {
	...PLAYER_ROW_BASE,
	background: "var(--bl-surface)",
	border: "3px solid #000",
	color: "rgba(245,240,255,0.4)",
};

const PLAYER_ROW_DOT_BASE: React.CSSProperties = {
	width: 10,
	height: 10,
	borderRadius: "50%",
	flexShrink: 0,
};

// category-choice button (QuestionSelectHost)
const CATEGORY_CHOICE: React.CSSProperties = {
	padding: "18px 36px",
	background: "var(--bl-surface)",
	border: "var(--bl-border)",
	borderRadius: "var(--bl-radius)",
	fontFamily: "var(--bl-font)",
	fontSize: 28,
	color: "rgba(245,240,255,0.7)",
	boxShadow: "var(--bl-shadow-sm)",
	cursor: "default",
};

// leaderboard row (LeaderboardHost) — background/color vary by rank,
// everything else is fixed
const LEADERBOARD_ROW_BASE: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 24,
	padding: "20px 32px",
	border: "var(--bl-border)",
	borderRadius: "var(--bl-radius)",
	boxShadow: "var(--bl-shadow-sm)",
	marginBottom: 10,
};

function QuestionSelectHost() {
	const { state, getName } = useBelievableLiesState();
	if (!state) return null;

	const pickerName = state.pickerPlayerId ? getName(state.pickerPlayerId) : "—";

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 48,
			}}
		>
			<div style={{ textAlign: "center" }}>
				<p className="bl-eyebrow" style={{ fontSize: 14, marginBottom: 12 }}>
					Picker
				</p>
				<p
					style={{
						fontFamily: "var(--bl-font)",
						fontSize: 72,
						color: "var(--bl-yellow)",
						lineHeight: 1,
					}}
				>
					{pickerName}
				</p>
			</div>

			{state.categoryChoices && state.categoryChoices.length > 0 && (
				<div
					style={{
						display: "flex",
						gap: 20,
						flexWrap: "wrap",
						justifyContent: "center",
					}}
				>
					{state.categoryChoices.map((cat) => (
						<div key={cat} style={CATEGORY_CHOICE}>
							{cat}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function LieInputHost() {
	const { state, getName } = useBelievableLiesState();
	if (!state) return null;

	const playerList = Object.values(state.players);
	const submitted = playerList.filter((p) => p.hasSubmittedLie);

	return (
		<div
			style={{
				display: "flex",
				gap: 48,
				width: "100%",
				alignItems: "flex-start",
			}}
		>
			{/* Left: prompt */}
			<div style={{ flex: 2 }}>
				<div style={HOST_PROMPT}>
					<div
						className="bl-eyebrow bl-eyebrow-yellow"
						style={{ fontSize: 13, marginBottom: 16 }}
					>
						Fill in the blank
					</div>
					<p style={HOST_PROMPT_TEXT}>{state.currentPrompt}</p>
				</div>
			</div>

			{/* Right: player status */}
			<div style={{ flex: 1, minWidth: 280 }}>
				<p className="bl-eyebrow" style={{ fontSize: 13, marginBottom: 16 }}>
					{submitted.length} / {playerList.length} submitted
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					{playerList.map((p) => (
						<div
							key={p.playerId}
							style={p.hasSubmittedLie ? PLAYER_ROW_DONE : PLAYER_ROW_PENDING}
						>
							<span
								style={{
									...PLAYER_ROW_DOT_BASE,
									background: p.hasSubmittedLie
										? "var(--bl-green)"
										: "rgba(245,240,255,0.2)",
								}}
							/>
							<span style={{ flex: 1 }}>{getName(p.playerId)}</span>
							{p.hasSubmittedLie && (
								<span style={{ fontSize: 13, opacity: 0.6 }}>ready ✓</span>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function PickingHost() {
	const { state, getName } = useBelievableLiesState();
	if (!state?.answers) return null;

	const playerList = Object.values(state.players);
	const pickedCount = playerList.filter((p) => p.hasPicked).length;

	return (
		<div
			style={{
				display: "flex",
				gap: 48,
				width: "100%",
				alignItems: "flex-start",
			}}
		>
			{/* Left: prompt + answers — clearly visible on the TV */}
			<div style={{ flex: 2 }}>
				<div style={{ ...HOST_PROMPT, background: "var(--bl-surface)" }}>
					<div
						className="bl-eyebrow bl-eyebrow-cyan"
						style={{ fontSize: 13, marginBottom: 16 }}
					>
						Which one is true?
					</div>
					<p style={HOST_PROMPT_TEXT}>{state.currentPrompt}</p>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					{state.answers.map((answer, i) => (
						<m.div
							key={answer.id}
							initial={{ opacity: 0, x: -12 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.07 }}
							style={HOST_ANSWER}
						>
							<span style={HOST_ANSWER_NUM}>{i + 1}</span>
							{answer.text}
						</m.div>
					))}
				</div>
			</div>

			{/* Right: who's picked */}
			<div style={{ flex: 1, minWidth: 280 }}>
				<p className="bl-eyebrow" style={{ fontSize: 13, marginBottom: 16 }}>
					{pickedCount} / {playerList.length} picked
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					{playerList.map((p) => (
						<div
							key={p.playerId}
							style={p.hasPicked ? PLAYER_ROW_DONE : PLAYER_ROW_PENDING}
						>
							<span
								style={{
									...PLAYER_ROW_DOT_BASE,
									background: p.hasPicked
										? "var(--bl-green)"
										: "rgba(245,240,255,0.2)",
								}}
							/>
							{getName(p.playerId)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function ResultHost() {
	const { state, getName } = useBelievableLiesState();
	if (!state?.lastResult) return null;

	const { prompt, truth, answers, picks, scoreDeltas } = state.lastResult;

	const pickersPerAnswer = new Map<string, string[]>();
	for (const [pickerId, answerId] of Object.entries(picks)) {
		if (answerId === "__abstain__") continue;
		const list = pickersPerAnswer.get(answerId) ?? [];
		list.push(getName(pickerId));
		pickersPerAnswer.set(answerId, list);
	}

	return (
		<div
			style={{
				display: "flex",
				gap: 48,
				width: "100%",
				alignItems: "flex-start",
			}}
		>
			{/* Left: truth + answers */}
			<div style={{ flex: 2 }}>
				{/* Truth banner */}
				<div
					style={{
						background: "var(--bl-green)",
						color: "#000",
						border: "var(--bl-border)",
						borderRadius: "var(--bl-radius-lg)",
						padding: "24px 36px",
						boxShadow: "var(--bl-shadow-lg)",
						marginBottom: 28,
					}}
				>
					<p
						style={{
							fontSize: 14,
							opacity: 0.55,
							marginBottom: 4,
							letterSpacing: 2,
							textTransform: "uppercase",
						}}
					>
						{prompt}
					</p>
					<div style={{ fontFamily: "var(--bl-font)", fontSize: 42 }}>
						The truth: {truth}
					</div>
				</div>

				{/* Answer list */}
				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					{answers.map((answer, i) => {
						const pickers = pickersPerAnswer.get(answer.id) ?? [];
						return (
							<m.div
								key={answer.id}
								initial={{ opacity: 0, x: -12 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: i * 0.08 }}
								style={answer.isTruth ? HOST_ANSWER_TRUTH : HOST_ANSWER}
							>
								<span style={HOST_ANSWER_NUM}>{i + 1}</span>
								<span style={{ flex: 1 }}>{answer.text}</span>
								{answer.isTruth && (
									<span style={{ fontSize: 14, opacity: 0.6, marginLeft: 8 }}>
										← truth
									</span>
								)}
								{!answer.isTruth && answer.authorIds.length > 0 && (
									<span style={{ fontSize: 14, opacity: 0.45 }}>
										by {answer.authorIds.map((id) => getName(id)).join(", ")}
									</span>
								)}
								{pickers.length > 0 && (
									<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
										{pickers.map((name) => (
											<span
												key={name}
												style={{
													fontSize: 14,
													padding: "4px 12px",
													borderRadius: 20,
													background: answer.isTruth
														? "rgba(0,0,0,0.2)"
														: "rgba(255,255,255,0.15)",
												}}
											>
												{name}
											</span>
										))}
									</div>
								)}
							</m.div>
						);
					})}
				</div>
			</div>

			{/* Right: score deltas */}
			<div style={{ flex: 1, minWidth: 280 }}>
				<p className="bl-eyebrow" style={{ fontSize: 13, marginBottom: 16 }}>
					This question
				</p>
				{Object.entries(scoreDeltas)
					.sort(([, a], [, b]) => b - a)
					.map(([pid, delta]) => (
						<div
							key={pid}
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "12px 0",
								borderBottom: "1px solid rgba(255,255,255,0.07)",
							}}
						>
							<span
								style={{
									fontFamily: "var(--bl-font)",
									fontSize: 22,
									color: "rgba(245,240,255,0.7)",
								}}
							>
								{getName(pid)}
							</span>
							<span
								style={{
									fontFamily: "monospace",
									fontSize: 24,
									fontWeight: 700,
									color:
										delta > 0
											? "var(--bl-green)"
											: delta < 0
												? "var(--bl-coral)"
												: "rgba(245,240,255,0.25)",
								}}
							>
								{delta > 0 ? `+${delta}` : delta === 0 ? "–" : delta}
							</span>
						</div>
					))}
			</div>
		</div>
	);
}

function LeaderboardHost() {
	const { state, getName } = useBelievableLiesState();
	if (!state) return null;

	const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
	const MEDALS = ["🥇", "🥈", "🥉"];

	const ROW_BG: Record<number, string> = {
		0: "var(--bl-yellow)",
		1: "var(--bl-purple)",
		2: "var(--bl-pink)",
	};

	return (
		<div style={{ width: "100%", maxWidth: 720 }}>
			{sorted.map((p, rank) => (
				<m.div
					key={p.playerId}
					initial={{ opacity: 0, x: -16 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: rank * 0.07 }}
					style={{
						...LEADERBOARD_ROW_BASE,
						background: ROW_BG[rank] ?? "var(--bl-surface)",
						color: rank <= 2 && rank !== 1 ? "#000" : "var(--bl-white)",
					}}
				>
					<span
						style={{
							fontSize: 36,
							width: 44,
							textAlign: "center",
							flexShrink: 0,
						}}
					>
						{MEDALS[rank] ?? `${rank + 1}`}
					</span>
					<span style={{ flex: 1, fontFamily: "var(--bl-font)", fontSize: 32 }}>
						{getName(p.playerId)}
					</span>
					<span
						style={{ fontFamily: "monospace", fontSize: 36, letterSpacing: -1 }}
					>
						{p.score.toLocaleString()}
					</span>
				</m.div>
			))}
		</div>
	);
}

// ─── Host root ────────────────────────────────────────────────────────────────

export function BelievableLiesHost() {
	const { state, timer } = useBelievableLiesState();

	const contentKey = state
		? state.phase === "result" ||
			state.phase === "lie_input" ||
			state.phase === "picking"
			? `${state.phase}-r${state.roundNumber}-q${state.questionIndex}`
			: state.phase
		: "no-state";

	// notifyCategorySelected is intentionally unused here — see the doc
	// comment on useHostPhaseNarration. There's no point in this
	// component's render where "category X was just picked" is
	// observable from state; that event only exists transiently on the
	// server/socket layer. Wire notifyCategorySelected in there once a
	// "category_selected" event (or similar) is emitted, rather than
	// trying to fake it from a state diff here.
	useHostPhaseNarration(state, contentKey);

	if (!state) return null;

	const phaseLabel = PHASE_LABEL[state.phase];

	return (
		<div
			style={{ display: "flex", flexDirection: "column", minHeight: "100svh" }}
		>
			{/* Top bar */}
			<div className="bl-topbar">
				<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
					<span
						style={{
							fontFamily: "var(--bl-font)",
							fontSize: 22,
							color: "var(--bl-yellow)",
						}}
					>
						Believable Lies
					</span>
					<span style={{ color: "rgba(245,240,255,0.2)" }}>·</span>
					<span
						style={{
							fontSize: 13,
							letterSpacing: 2,
							textTransform: "uppercase",
							color: "rgba(245,240,255,0.5)",
						}}
					>
						{phaseLabel}
					</span>
					{state.phase !== "finished" && state.phase !== "round_end" && (
						<>
							<span style={{ color: "rgba(245,240,255,0.15)" }}>·</span>
							<span style={{ fontSize: 13, color: "rgba(245,240,255,0.3)" }}>
								Round {state.roundNumber} · Q{state.questionIndex + 1}/
								{state.totalQuestionsThisRound}
							</span>
						</>
					)}
				</div>
			</div>

			{/* Phase content — paddingBottom leaves room for the fixed 56px timer bar */}
			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: "48px 80px 120px",
				}}
			>
				<AnimatePresence mode="wait">
					<m.div
						key={contentKey}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18 }}
						style={{ width: "100%", maxWidth: 1400 }}
					>
						{state.phase === "question_select" && <QuestionSelectHost />}
						{state.phase === "lie_input" && <LieInputHost />}
						{state.phase === "picking" && <PickingHost />}
						{state.phase === "result" && <ResultHost />}
						{state.phase === "round_end" && <LeaderboardHost />}
						{state.phase === "finished" && (
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 32,
								}}
							>
								<p style={{ fontSize: 80 }}>🏆</p>
								<LeaderboardHost />
							</div>
						)}
					</m.div>
				</AnimatePresence>
			</div>

			{/* Full-width bottom timer bar — shown for all timed phases */}
			{timer &&
				(state.phase === "question_select" ||
					state.phase === "lie_input" ||
					state.phase === "picking" ||
					state.phase === "result") && (
					<HostTimerBar timer={timer} phase={state.phase} />
				)}
		</div>
	);
}