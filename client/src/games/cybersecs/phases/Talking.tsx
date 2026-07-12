import { m } from "motion/react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { MissionTrack } from "../components/MissionTrack";
import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";
import type { CybsecsState } from "@shared/games/cybersecs";
import type { GameTimer, Player } from "@shared/core/room";

export function Talking() {
	const { game, role, timer, players, playerId, getName } = useCybsecsState();
	if (!game) return null;

	if (role === "host") {
		return (
			<HostView game={game} timer={timer} players={players} getName={getName} />
		);
	}
	return <PlayerView game={game} timer={timer} playerId={playerId} />;
}

function HostView({
	game,
	timer,
	getName,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	players: Player[];
	getName: (id: string) => string;
}) {
	const leaderName = getName(game.playerOrder[game.leaderIndex]);
	const skipCount = game.skipVotedIds.length;
	const threshold = Math.floor(game.playerOrder.length / 2) + 1;

	return (
		<div className="flex flex-col min-h-screen px-12 py-10 gap-8">
			<MissionTrack
				missionResults={game.missionResults}
				missionIndex={game.missionIndex}
				playerCount={game.playerOrder.length}
			/>

			<div className="flex flex-col items-center gap-4 flex-1 justify-center text-center">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1} · Open Discussion
				</span>
				<h1 className="font-display text-6xl font-black uppercase text-white">
					Discuss
				</h1>
				<p className="text-white/50 text-xl">
					Leader: <span className="text-white font-bold">{leaderName}</span>
				</p>
				<p className="text-white/30 text-sm">
					{skipCount}/{threshold} voted to skip
					{skipCount > 0 && <> · {game.skipVotedIds.map(getName).join(", ")}</>}
				</p>
				{game.rejectionCount > 0 && (
					<span
						className={cn(
							"text-xs px-3 py-1 rounded-full",
							game.rejectionCount >= 4
								? "bg-red-400/20 text-red-400"
								: "bg-white/8 text-white/30",
						)}
					>
						{game.rejectionCount}/5 rejections
					</span>
				)}
			</div>

			<div className="flex flex-col gap-4">
				<div className="grid grid-cols-4 gap-2 w-full max-w-2xl mx-auto">
					{game.playerOrder.map((id) => {
						const hasSkipped = game.skipVotedIds.includes(id);
						const isLeader = game.playerOrder[game.leaderIndex] === id;
						return (
							<div
								key={id}
								className={cn(
									"px-3 py-2.5 rounded-xl border text-sm text-center transition-colors",
									hasSkipped
										? "bg-cyan-400/10 border-cyan-400/30 text-cyan-400"
										: "bg-surface border-border text-white/60",
								)}
							>
								{isLeader && <span className="mr-1">👑</span>}
								{getName(id)}
								{hasSkipped && (
									<div className="text-[10px] mt-0.5 opacity-70">Skip ✓</div>
								)}
							</div>
						);
					})}
				</div>
				<div className="w-full max-w-xs mx-auto">
					<TimerBar timer={timer} />
				</div>
			</div>
		</div>
	);
}

function PlayerView({
	game,
	timer,
	playerId,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	playerId: string;
}) {
	const hasSkipped = game.skipVotedIds.includes(playerId);
	const skipCount = game.skipVotedIds.length;
	const threshold = Math.floor(game.playerOrder.length / 2) + 1;

	function toggleSkip() {
		socket.emit("player_action", { type: "skip_vote", skip: !hasSkipped });
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-8">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1} · Open Discussion
				</p>
				<h1 className="font-display text-5xl font-black uppercase text-white leading-none">
					Discuss
				</h1>
				<TimerBar timer={timer} />
			</div>

			<p className="text-white/40 text-sm leading-relaxed">
				Talk it out. Vote to skip when everyone is ready to nominate. A majority
				is needed.
			</p>

			<div className="flex flex-col gap-4 flex-1 justify-center">
				<m.button
					type="button"
					onClick={toggleSkip}
					whileTap={{ scale: 0.97 }}
					className={cn(
						"w-full h-16 rounded-2xl border text-base font-bold transition-all cursor-pointer",
						hasSkipped
							? "bg-cyan-400/15 border-cyan-400/40 text-cyan-400"
							: "bg-surface border-border text-white/60 hover:bg-white/8",
					)}
				>
					{hasSkipped ? "✓ Voted to Skip" : "Skip to Nominations"}
				</m.button>

				<p className="text-center text-xs text-white/30 tabular-nums">
					{skipCount} / {threshold} needed
				</p>
			</div>
		</div>
	);
}