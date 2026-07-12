import { useState } from "react";
import { m } from "motion/react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { MissionTrack } from "../components/MissionTrack";
import { ObfuscatorToggle } from "../components/ObfuscatorToggle";
import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";
import type {
	CybsecsState,
	CybsecsSecret,
	VoteChoice,
} from "@shared/games/cybersecs";
import type { GameTimer } from "@shared/core/room";

export function Voting() {
	const { game, secret, role, timer, playerId, myPlayer, getName } =
		useCybsecsState();
	if (!game) return null;

	if (role === "host") {
		return <HostView game={game} timer={timer} getName={getName} />;
	}
	return (
		<PlayerView
			game={game}
			secret={secret}
			timer={timer}
			playerId={playerId}
			hasVoted={myPlayer?.hasVoted ?? false}
			getName={getName}
		/>
	);
}

function HostView({
	game,
	timer,
	getName,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	getName: (id: string) => string;
}) {
	const voteCount = Object.values(game.players).filter(
		(p) => p.hasVoted,
	).length;
	const total = game.playerOrder.length;

	return (
		<div className="flex flex-col min-h-screen px-12 py-10 gap-8">
			<MissionTrack
				missionResults={game.missionResults}
				missionIndex={game.missionIndex}
				playerCount={game.playerOrder.length}
			/>

			<div className="flex flex-col items-center gap-5 flex-1 justify-center text-center">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1} · Vote
				</span>
				<h1 className="font-display text-6xl font-black uppercase text-white">
					Voting
				</h1>

				<div className="flex gap-3 flex-wrap justify-center">
					{game.nominatedTeam.map((id) => (
						<span
							key={id}
							className="px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 font-semibold text-sm"
						>
							{getName(id)}
						</span>
					))}
				</div>

				<p className="font-display text-5xl font-black text-white/40 tabular-nums">
					{voteCount}
					<span className="text-white/20 text-3xl">/{total}</span>
				</p>

				{game.rejectionCount > 0 && (
					<span
						className={cn(
							"text-xs px-3 py-1 rounded-full",
							game.rejectionCount >= 4
								? "bg-red-400/20 text-red-400"
								: "bg-white/8 text-white/40",
						)}
					>
						{game.rejectionCount}/5 rejections
					</span>
				)}
			</div>

			<div className="flex flex-col gap-4">
				<div className="grid grid-cols-4 gap-2 w-full max-w-2xl mx-auto">
					{game.playerOrder.map((id) => {
						const voted = game.players[id]?.hasVoted;
						return (
							<div
								key={id}
								className={cn(
									"px-3 py-2.5 rounded-xl border text-sm text-center transition-colors",
									voted
										? "bg-white/8 border-white/20 text-white/80"
										: "bg-surface border-border text-white/30",
								)}
							>
								{getName(id)}
								{voted && (
									<div className="text-[10px] mt-0.5 text-white/50">
										✓ Voted
									</div>
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
	secret,
	timer,
	playerId,
	hasVoted,
	getName,
}: {
	game: CybsecsState;
	secret: CybsecsSecret | null;
	timer: GameTimer | null;
	playerId: string;
	hasVoted: boolean;
	getName: (id: string) => string;
}) {
	const [myVote, setMyVote] = useState<VoteChoice | null>(null);
	const submitted = hasVoted || myVote !== null;

	function vote(choice: VoteChoice) {
		socket.emit("player_action", { type: "vote", choice });
		setMyVote(choice);
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1} · Vote
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Approve?
				</h1>
				<TimerBar timer={timer} />
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">
					Proposed Team
				</p>
				{game.nominatedTeam.map((id) => (
					<div
						key={id}
						className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-400/8 border border-cyan-400/20"
					>
						<span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
						<span className="font-semibold text-sm text-white">
							{getName(id)}
							{id === playerId && (
								<span className="ml-2 text-xs text-white/30">(you)</span>
							)}
						</span>
					</div>
				))}
			</div>

			{submitted ? (
				<div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
					<div
						className={cn(
							"w-20 h-20 rounded-full flex items-center justify-center text-3xl border",
							myVote === "approve"
								? "bg-green-400/15 border-green-400/30 text-green-400"
								: myVote === "reject"
									? "bg-red-400/15 border-red-400/30 text-red-400"
									: "bg-white/8 border-border text-white/40",
						)}
					>
						{myVote === "approve" ? "✓" : myVote === "reject" ? "✗" : "✓"}
					</div>
					<p className="text-white/40 text-sm">Waiting for others…</p>
					{secret && (
						<div className="w-full max-w-xs">
							<ObfuscatorToggle
								armed={secret.obfuscateArmed}
								usesLeft={secret.obfuscatorUsesLeft}
							/>
						</div>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-3 flex-1 justify-center">
					{secret && (
						<ObfuscatorToggle
							armed={secret.obfuscateArmed}
							usesLeft={secret.obfuscatorUsesLeft}
						/>
					)}
					<div className="flex gap-3">
						<m.button
							type="button"
							onClick={() => {
								vote("approve");
							}}
							whileTap={{ scale: 0.97 }}
							className="flex-1 h-16 rounded-2xl bg-green-500/15 border border-green-500/40 text-green-400 font-display font-bold text-xl uppercase transition-all hover:bg-green-500/25 cursor-pointer"
						>
							Approve
						</m.button>
						<m.button
							type="button"
							onClick={() => {
								vote("reject");
							}}
							whileTap={{ scale: 0.97 }}
							className="flex-1 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-400 font-display font-bold text-xl uppercase transition-all hover:bg-red-500/25 cursor-pointer"
						>
							Reject
						</m.button>
					</div>
				</div>
			)}
		</div>
	);
}