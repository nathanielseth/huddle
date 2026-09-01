import { m } from "motion/react";
import { useSquadoodleState } from "../hooks/useSquadoodleState";
import { StrokeRenderer } from "../components/StrokeRenderer";
import { ReactionBar } from "../components/ReactionBar";
import { socket } from "../../../lib/network/socket";
import type {
	SquadoodleState,
	ChainEntry,
	ReactionTally,
} from "@shared/games/squadoodle/index";

export function Reveal() {
	const { game, role } = useSquadoodleState();
	if (!game) return null;

	return role === "host" ? (
		<HostView game={game} />
	) : (
		<PlayerView game={game} />
	);
}

// ─── Host ────────────────────────────────────────────────────────────────────

function HostView({ game }: { game: SquadoodleState }) {
	const { chains, revealChainIndex, revealEntryIndex, reactions, playerOrder } =
		game;

	const chain = chains[revealChainIndex];
	const chainCount = playerOrder.length;

	if (!chain || revealEntryIndex === 0) {
		return (
			<div className="flex flex-col min-h-screen items-center justify-center gap-6 px-12">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Chain {revealChainIndex + 1} of {chainCount}
				</span>
				<h1 className="font-display text-7xl font-black uppercase text-white text-center">
					Next Chain
				</h1>
				<p className="text-white/30 text-center max-w-sm text-sm">
					Brace yourselves.
				</p>
				<NextButton />
			</div>
		);
	}

	const currentEntryIndex = revealEntryIndex - 1;
	const tally = reactions[revealChainIndex]?.[currentEntryIndex];

	return (
		<div className="flex flex-col min-h-screen px-10 py-8 gap-6">
			{/* Chain progress header */}
			<div className="flex items-center justify-between shrink-0">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Chain {revealChainIndex + 1} / {chainCount}
				</span>
				<ChainDots total={chain.length} revealed={revealEntryIndex} />
			</div>

			{/* Revealed entries */}
			<div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 pb-2">
				{chain.slice(0, revealEntryIndex).map((entry, i) => {
					const isCurrent = i === currentEntryIndex;
					return (
						// Fix: no-array-index-as-key — entries have no id field; use a
						// composite of type + position which is stable within a revealed
						// chain (entries are append-only, never reordered).
						<m.div
							key={`${entry.type}-${i}`}
							initial={isCurrent ? { opacity: 0, y: 16 } : false}
							animate={{ opacity: isCurrent ? 1 : 0.35, y: 0 }}
							transition={{ duration: 0.2, ease: "easeOut" }}
						>
							<EntryCard
								entry={entry}
								isCurrent={isCurrent}
								tally={reactions[revealChainIndex]?.[i]}
							/>
						</m.div>
					);
				})}
			</div>

			{/* Reaction tallies for current entry */}
			{tally && <TallyRow tally={tally} />}

			{/* Controls */}
			<div className="flex items-center justify-between shrink-0">
				{revealEntryIndex >= chain.length && chain.length > 0 && (
					<FinalComparison chain={chain} />
				)}
				<div className="ml-auto">
					<NextButton />
				</div>
			</div>
		</div>
	);
}

function NextButton() {
	return (
		<m.button
			type="button"
			onClick={() => socket.emit("player_action", { type: "next_reveal" })}
			whileTap={{ scale: 0.96 }}
			className="px-8 h-12 rounded-2xl bg-white/8 border border-white/15 text-white/70 font-semibold text-sm hover:bg-white/12 hover:text-white transition-colors cursor-pointer"
		>
			Next →
		</m.button>
	);
}

function ChainDots({ total, revealed }: { total: number; revealed: number }) {
	return (
		<div className="flex gap-1.5 items-center">
			{Array.from({ length: total }, (_, i) => (
				<span
					key={`chain-dot-${i}`}
					className={
						i < revealed
							? "w-2 h-2 rounded-full bg-indigo-400 transition-colors"
							: "w-2 h-2 rounded-full bg-white/15"
					}
				/>
			))}
		</div>
	);
}

function EntryCard({
	entry,
	isCurrent,
	tally,
}: {
	entry: ChainEntry;
	isCurrent: boolean;
	tally: ReactionTally | undefined;
}) {
	const ringClass = isCurrent ? "ring-2 ring-indigo-400/60" : "ring-0";

	if (entry.type === "prompt" || entry.type === "guess") {
		return (
			<div
				className={`rounded-2xl bg-white/6 border border-white/10 px-6 py-4 ${ringClass} transition-all`}
			>
				<p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-1">
					{entry.type === "prompt" ? "Original Prompt" : "Guess"}
				</p>
				<p className="text-white font-semibold text-lg leading-snug">
					{entry.text}
				</p>
				{tally && isCurrent && <InlineTally tally={tally} />}
			</div>
		);
	}

	return (
		<div
			className={`rounded-2xl overflow-hidden border border-black/10 ${ringClass} bg-white transition-all`}
		>
			<StrokeRenderer strokes={entry.strokes} className="w-full aspect-4/3" />
			{tally && isCurrent && (
				<div className="px-4 pb-3">
					<InlineTally tally={tally} />
				</div>
			)}
		</div>
	);
}

function InlineTally({ tally }: { tally: ReactionTally }) {
	const items = [
		{ emoji: "🔥", count: tally.fire },
		{ emoji: "😂", count: tally.laugh },
		{ emoji: "❤️", count: tally.heart },
		{ emoji: "🗑️", count: tally.trash },
	];
	const hasAny = items.some((i) => i.count > 0);
	if (!hasAny) return null;

	return (
		<div className="flex gap-3 mt-2">
			{items.map(({ emoji, count }) =>
				count > 0 ? (
					<span key={emoji} className="text-sm text-white/60">
						{emoji} {count}
					</span>
				) : null,
			)}
		</div>
	);
}

function TallyRow({ tally }: { tally: ReactionTally }) {
	return (
		<m.div
			key={`${tally.fire}-${tally.laugh}-${tally.heart}`}
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			className="flex gap-6 justify-center shrink-0"
		>
			{[
				{ emoji: "🔥", count: tally.fire },
				{ emoji: "😂", count: tally.laugh },
				{ emoji: "❤️", count: tally.heart },
				{ emoji: "🗑️", count: tally.trash },
			].map(({ emoji, count }) => (
				<span
					key={emoji}
					className="font-display text-2xl font-bold text-white/70"
				>
					{emoji} <span className="tabular-nums">{count}</span>
				</span>
			))}
		</m.div>
	);
}

function FinalComparison({ chain }: { chain: readonly ChainEntry[] }) {
	const first = chain[0];
	const last = chain[chain.length - 1];
	if (!first || !last || first === last) return null;

	const firstText =
		first.type === "prompt" || first.type === "guess" ? first.text : null;
	const lastText =
		last.type === "guess" || last.type === "prompt" ? last.text : null;

	if (!firstText || !lastText) return null;

	return (
		<m.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex gap-4 items-center text-sm max-w-lg"
		>
			<span className="text-indigo-300 font-semibold shrink-0">Started:</span>
			<span className="text-white/60 italic">"{firstText}"</span>
			<span className="text-white/20 shrink-0">→</span>
			<span className="text-white/60 italic">"{lastText}"</span>
			<span className="text-white/40 font-semibold shrink-0">:Ended</span>
		</m.div>
	);
}

// ─── Player ──────────────────────────────────────────────────────────────────

function PlayerView({ game }: { game: SquadoodleState }) {
	const { revealChainIndex, revealEntryIndex } = game;
	const entryIndex = revealEntryIndex - 1;

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6 items-center justify-center text-center">
			<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Chain {revealChainIndex + 1} · Reveal
			</span>
			<h1 className="font-display text-4xl font-black uppercase text-white">
				React!
			</h1>
			<p className="text-white/30 text-sm max-w-xs">
				Tap an emoji to react to whatever's showing on screen right now.
			</p>

			{entryIndex >= 0 ? (
				<ReactionBar chainIndex={revealChainIndex} entryIndex={entryIndex} />
			) : (
				<p className="text-white/20 text-sm">Waiting for the next entry…</p>
			)}
		</div>
	);
}