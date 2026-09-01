import { m, AnimatePresence } from "motion/react";
import { socket } from "../../../lib/network/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { getTaskMeta } from "../constants";
import { cn } from "../../../lib/utils/cn";
import type { SussyResponse } from "@shared/games/sussy/index";

// ── Response formatter ────────────────────────────────────────────────────────

function formatResponse(
	response: SussyResponse | null,
	players: ReturnType<typeof useSussyState>["players"],
): string | null {
	if (!response) return null;
	switch (response.type) {
		case "show_of_hands":
			return response.raised ? "✋ Hand up" : "✊ Hand down";
		case "finger_pointing": {
			const name = players.find((p) => p.id === response.targetId)?.name;
			return name ? `👉 ${name}` : "👉 —";
		}
		case "numbers_game":
			return `${response.count} finger${response.count !== 1 ? "s" : ""}`;
		case "thumb_shot":
			return response.choices.map((c) => (c ? "👍" : "👎")).join("  ");
		case "face_turn":
			return response.emoji ?? "😶";
		case "glitch_in_the_chat":
			return response.answers[0] ?? "—";
	}
}

// Fix: prefer-module-scope-pure-function — castVote() only closes over the
// module-level `socket` import and receives `targetId` as a param.
// Moving it out of Voting means it is allocated once, not on every render.
function castVote(targetId: string) {
	socket.emit("player_action", { type: "cast_vote", targetId });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Voting() {
	const { sussy, role, players, playerId, myPlayer, timer } = useSussyState();
	if (!sussy) return null;

	const meta = getTaskMeta(sussy.taskType);
	const voted = Object.values(sussy.players).filter((p) => p.hasVoted).length;
	const total = players.length;
	const hasVoted = myPlayer?.hasVoted ?? false;
	const majorityId = sussy.majorityTargetId;
	const majorityName = players.find((p) => p.id === majorityId)?.name ?? null;
	const hasResponses =
		sussy.mode === "remote" || sussy.taskType === "glitch_in_the_chat";

	// ── Host view ─────────────────────────────────────────────────────────────
	if (role === "host") {
		return (
			<div className="flex flex-col min-h-screen px-8 py-10 gap-8">
				<div>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30 mb-1">
						{meta.icon} {meta.label} · Task {sussy.taskNumber}
					</p>
					<h1 className="font-display text-5xl font-black uppercase text-white">
						Who's Sussy?
					</h1>
					<div className="mt-3">
						<TimerBar timer={timer} />
					</div>
				</div>

				{/* Live majority banner */}
				<AnimatePresence>
					{majorityName && (
						<m.div
							className="px-5 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center"
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
						>
							<p className="text-amber-300 font-bold text-sm">
								⚡ Majority on{" "}
								<span className="text-white">{majorityName}</span>
							</p>
						</m.div>
					)}
				</AnimatePresence>

				<div className="flex items-end justify-between">
					<p className="text-xs font-bold tracking-widest uppercase text-white/30">
						Voted
					</p>
					<span className="font-display text-5xl font-black text-white tabular-nums">
						{voted}
						<span className="text-white/30">/{total}</span>
					</span>
				</div>

				<div className="flex flex-col gap-2">
					{players.map((p) => {
						const sp = sussy.players[p.id];
						const response = formatResponse(sp?.response ?? null, players);
						return (
							<div
								key={p.id}
								className={cn(
									"flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-300",
									sp?.hasVoted
										? "border-violet-500/40 bg-violet-500/10 text-violet-300"
										: "border-border bg-white/3 text-white/30",
								)}
							>
								<span
									className={cn(
										"w-1.5 h-1.5 rounded-full shrink-0",
										sp?.hasVoted ? "bg-violet-400" : "bg-white/20",
									)}
								/>
								<span className="flex-1">{p.name}</span>
								{response && hasResponses && (
									<span className="text-xs font-normal text-white/50 truncate max-w-30">
										{response}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	// ── Player — already voted ────────────────────────────────────────────────
	if (hasVoted) {
		return (
			<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
				<div>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
						{meta.label} · Vote
					</p>
					<div className="mt-1">
						<TimerBar timer={timer} />
					</div>
				</div>

				{/* Majority feedback */}
				<AnimatePresence>
					{majorityName && (
						<m.div
							className="px-5 py-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center"
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ type: "spring", stiffness: 300, damping: 24 }}
						>
							<p className="text-amber-300 text-sm font-bold">
								⚡ Majority reached for{" "}
								<span className="text-white">{majorityName}</span>
							</p>
							<p className="text-white/40 text-xs mt-1">
								Waiting for everyone to finish voting…
							</p>
						</m.div>
					)}
				</AnimatePresence>

				<m.div
					className="flex-1 flex flex-col items-center justify-center gap-4 text-center"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
				>
					<span className="text-5xl">🗳️</span>
					<p className="text-white/50 text-sm">
						Vote cast — waiting for others
					</p>
					<p className="text-xs text-white/25">
						{voted}/{total} voted
					</p>
				</m.div>

				{/* Responses grid */}
				{hasResponses && <ResponseGrid players={players} sussy={sussy} />}
			</div>
		);
	}

	// ── Player — voting ───────────────────────────────────────────────────────
	const targets = players.filter((p) => p.id !== playerId);

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div>
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
					{meta.label} · Vote
				</p>
				<h1 className="font-display text-3xl font-black uppercase text-white leading-tight">
					Who's the Impostor?
				</h1>
				<p className="text-xs text-white/30 mt-1">
					{voted}/{total} voted · majority needed
				</p>
				<div className="mt-3">
					<TimerBar timer={timer} />
				</div>
			</div>

			{/* Responses — show above vote targets so they can refer to them */}
			{hasResponses && <ResponseGrid players={players} sussy={sussy} />}

			<div className="flex flex-col gap-2">
				{targets.map((p, i) => (
					<m.button
						key={p.id}
						type="button"
						onClick={() => { castVote(p.id); }}
						className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-surface hover:bg-red-500/10 hover:border-red-500/30 active:scale-[0.98] transition-all cursor-pointer text-left"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: i * 0.05, duration: 0.2 }}
					>
						<div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-xs font-bold text-white/50 uppercase shrink-0">
							{p.name.slice(0, 2)}
						</div>
						<span className="flex-1 font-semibold text-white">{p.name}</span>
						<span className="text-white/20 text-sm">🫵</span>
					</m.button>
				))}
			</div>
		</div>
	);
}

// ── Response grid (remote mode / glitch only) ─────────────────────────────────

function ResponseGrid({
	players,
	sussy,
}: {
	players: ReturnType<typeof useSussyState>["players"];
	sussy: NonNullable<ReturnType<typeof useSussyState>["sussy"]>;
}) {
	const entries = players
		.map((p) => ({
			name: p.name,
			response: formatResponse(sussy.players[p.id]?.response ?? null, players),
		}))
		.filter((e) => e.response !== null);

	if (entries.length === 0) return null;

	const isGlitch = sussy.taskType === "glitch_in_the_chat";

	return (
		<div className="flex flex-col gap-2">
			<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
				{isGlitch ? `Q${sussy.taskNumber} Answers` : "Responses"}
			</p>
			{entries.map((e, i) => (
				<m.div
					key={e.name}
					className="flex gap-3 px-4 py-3 rounded-xl border border-border bg-surface"
					initial={{ opacity: 0, x: -8 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: i * 0.04 }}
				>
					<span className="text-xs font-bold text-white/30 shrink-0 w-16 truncate">
						{e.name}
					</span>
					<span className="text-sm text-white/80 leading-snug">
						{e.response}
					</span>
				</m.div>
			))}
		</div>
	);
}