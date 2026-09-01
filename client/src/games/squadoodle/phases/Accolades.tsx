import { m } from "motion/react";
import { useSquadoodleState } from "../hooks/useSquadoodleState";
import { StrokeRenderer } from "../components/StrokeRenderer";
import { ReactionBar } from "../components/ReactionBar";
import { socket } from "../../../lib/network/socket";
import type {
	SquadoodleState,
	Accolade,
	AccoladeKind,
	ChainEntry,
} from "@shared/games/squadoodle/index";

const ACCOLADE_META: Record<
	AccoladeKind,
	{ label: string; emoji: string; description: string }
> = {
	most_hearted_drawing: {
		label: "Most Loved",
		emoji: "❤️",
		description: "The drawing that melted the most hearts",
	},
	funniest_guess: {
		label: "Funniest Caption",
		emoji: "😂",
		description: "The guess that got the most laughs",
	},
	most_chaotic_chain: {
		label: "Most Chaotic",
		emoji: "🔥",
		description: "The chain that drifted furthest from reality",
	},
	most_trashed_drawing: {
		label: "Certified Garbage",
		emoji: "🗑️",
		description: "The drawing the crowd collectively disowned",
	},
};

export function Accolades() {
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
	const { accolades, chains } = game;

	return (
		<div className="flex flex-col min-h-screen px-12 py-10 gap-10">
			<div className="text-center shrink-0">
				<h1 className="font-display text-7xl font-black uppercase text-white">
					Accolades
				</h1>
				<p className="text-white/30 mt-2 text-sm">
					The people have spoken via emoji.
				</p>
			</div>

			{accolades.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-white/20">
						No reactions were given. Very serious group.
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-8 flex-1">
					{accolades.map((accolade, i) => (
						<AccoladeCard
							key={`${accolade.kind}-${accolade.chainIndex}`}
							accolade={accolade}
							chains={chains}
							delay={i * 0.15}
						/>
					))}
				</div>
			)}

			<div className="flex justify-center shrink-0">
				<m.button
					type="button"
					onClick={() => socket.emit("player_action", { type: "play_again" })}
					whileTap={{ scale: 0.97 }}
					className="px-10 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-display font-bold text-xl uppercase tracking-wide hover:bg-indigo-500/30 transition-colors cursor-pointer"
				>
					Play Again
				</m.button>
			</div>
		</div>
	);
}

function AccoladeCard({
	accolade,
	chains,
	delay,
}: {
	accolade: Accolade;
	chains: SquadoodleState["chains"];
	delay: number;
}) {
	const meta = ACCOLADE_META[accolade.kind];
	const chain = chains[accolade.chainIndex];

	// Resolve the specific entry if applicable.
	const entry: ChainEntry | null =
		accolade.entryIndex !== null
			? (chain?.[accolade.entryIndex] ?? null)
			: null;

	return (
		<m.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay, duration: 0.4, ease: "easeOut" }}
			className="flex gap-6 items-start p-6 rounded-2xl bg-white/4 border border-white/8"
		>
			{/* Emoji badge */}
			<div className="text-5xl shrink-0 leading-none mt-1">{meta.emoji}</div>

			<div className="flex flex-col gap-3 flex-1 min-w-0">
				<div>
					<p className="text-xs font-bold tracking-[0.25em] uppercase text-white/30">
						{meta.label}
					</p>
					<p className="text-white/50 text-sm">{meta.description}</p>
				</div>

				{/* Show the winning entry inline */}
				{entry && (
					<div className="rounded-xl overflow-hidden border border-white/10 max-w-md">
						{entry.type === "drawing" ? (
							<StrokeRenderer
								strokes={entry.strokes}
								className="w-full aspect-4/3 bg-[#1a1a2e]"
							/>
						) : (
							<div className="px-4 py-3 bg-white/5">
								<p className="text-white font-semibold italic">
									"{entry.text}"
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</m.div>
	);
}

// ─── Player ──────────────────────────────────────────────────────────────────

function PlayerView({ game }: { game: SquadoodleState }) {
	// During accolades the TV is static — let players react to whatever's showing.
	// We point reactions at chain 0 / entry 0 as a best-effort; the server will
	// ignore out-of-bounds reactions gracefully (revealEntryIndex is always
	// past the last entry at this point, so no react action goes through in the
	// reveal phase's bounds check — but accolades phase doesn't gate reactions).
	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6 items-center justify-center text-center">
			<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Accolades
			</span>
			<h1 className="font-display text-4xl font-black uppercase text-white">
				🏆 GGs
			</h1>
			<p className="text-white/30 text-sm max-w-xs">
				The host is reading out the winners. React to what you see on screen!
			</p>
			<ReactionBar
				chainIndex={game.revealChainIndex}
				entryIndex={Math.max(0, game.revealEntryIndex - 1)}
			/>
		</div>
	);
}