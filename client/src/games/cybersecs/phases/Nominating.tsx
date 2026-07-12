import { useState } from "react";
import { m } from "motion/react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { MissionTrack } from "../components/MissionTrack";
import { ObfuscatorToggle } from "../components/ObfuscatorToggle";
import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";
import type { CybsecsState, CybsecsSecret } from "@shared/games/cybersecs";
import type { GameTimer } from "@shared/core/room";

function passLeadership() {
	socket.emit("player_action", { type: "pass" });
}

export function Nominating() {
	const { game, secret, role, timer, playerId, amLeader, getName } =
		useCybsecsState();
	if (!game) return null;

	if (role === "host") {
		return <HostView game={game} timer={timer} getName={getName} />;
	}
	if (amLeader) {
		return (
			<LeaderView
				game={game}
				timer={timer}
				playerId={playerId}
				secret={secret}
				getName={getName}
			/>
		);
	}
	return (
		<WaiterView game={game} timer={timer} secret={secret} getName={getName} />
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
	const leaderName = getName(game.playerOrder[game.leaderIndex]);

	return (
		<div className="flex flex-col min-h-screen px-12 py-10 gap-8">
			<MissionTrack
				missionResults={game.missionResults}
				missionIndex={game.missionIndex}
				playerCount={game.playerOrder.length}
			/>

			<div className="flex flex-col items-center gap-4 flex-1 justify-center text-center">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1} · Nominating
				</span>
				<h1 className="font-display text-6xl font-black uppercase text-white">
					Nominate
				</h1>
				<p className="text-white/50 text-xl">
					<span className="text-white font-bold">{leaderName}</span> is choosing{" "}
					<span className="text-cyan-400 font-bold">{game.teamSize}</span>{" "}
					players
				</p>
				{game.rejectionCount > 0 && (
					<span
						className={cn(
							"text-xs px-3 py-1 rounded-full font-semibold",
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
						const isLeader = game.playerOrder[game.leaderIndex] === id;
						const hasPassed = game.passedPlayerIds.includes(id);
						return (
							<div
								key={id}
								className={cn(
									"px-3 py-2.5 rounded-xl border text-sm text-center",
									isLeader
										? "bg-cyan-400/10 border-cyan-400/30 text-cyan-400"
										: "bg-surface border-border text-white/60",
								)}
							>
								{isLeader && "👑 "}
								{getName(id)}
								{hasPassed && (
									<div className="text-[10px] mt-0.5 text-white/30">passed</div>
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

function LeaderView({
	game,
	timer,
	playerId,
	secret,
	getName,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	playerId: string;
	secret: CybsecsSecret | null;
	getName: (id: string) => string;
}) {
	const [selected, setSelected] = useState<string[]>([]);

	// leader can pass if they haven't yet and there's another unpassed player
	const canPass =
		!game.passedPlayerIds.includes(playerId) &&
		game.playerOrder.filter(
			(id) => !game.passedPlayerIds.includes(id) && id !== playerId,
		).length > 0;

	function togglePlayer(id: string) {
		setSelected((prev) => {
			if (prev.includes(id)) return prev.filter((x) => x !== id);
			if (prev.length >= game.teamSize) return prev;
			return [...prev, id];
		});
	}

	function submitNomination() {
		if (selected.length !== game.teamSize) return;
		socket.emit("player_action", { type: "nominate", team: selected });
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-5">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-cyan-400">
					Mission {game.missionIndex + 1} · You're the Leader
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Pick {game.teamSize} Players
				</h1>
				<TimerBar timer={timer} />
			</div>

			<p className="text-xs text-white/40">
				{selected.length}/{game.teamSize} selected
				{game.rejectionCount > 0 && (
					<span className="ml-3 text-white/25">
						{game.rejectionCount}/5 rejections
					</span>
				)}
			</p>

			<div className="flex flex-col gap-2 flex-1">
				{game.playerOrder.map((id, i) => {
					const isSelected = selected.includes(id);
					const isMe = id === playerId;
					const isMaxed = selected.length >= game.teamSize && !isSelected;
					return (
						<m.button
							key={id}
							type="button"
							onClick={() => {
								togglePlayer(id);
							}}
							whileTap={{ scale: 0.98 }}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.04 }}
							disabled={isMaxed}
							className={cn(
								"flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all cursor-pointer",
								isSelected
									? "bg-cyan-400/15 border-cyan-400/40 text-white"
									: isMaxed
										? "bg-white/2 border-border text-white/25 cursor-not-allowed"
										: "bg-surface border-border text-white/70 hover:bg-white/8",
							)}
						>
							<div
								className={cn(
									"w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
									isSelected
										? "border-cyan-400 bg-cyan-400"
										: "border-white/20",
								)}
							>
								{isSelected && (
									<svg
										className="w-3 h-3 text-black"
										viewBox="0 0 12 12"
										fill="none"
									>
										<path
											d="M2 6l3 3 5-5"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</div>
							<span className="font-semibold text-sm flex-1">
								{getName(id)}
								{isMe && (
									<span className="ml-1.5 text-xs text-white/30">(you)</span>
								)}
							</span>
						</m.button>
					);
				})}
			</div>

			{secret && (
				<ObfuscatorToggle
					armed={secret.obfuscateArmed}
					usesLeft={secret.obfuscatorUsesLeft}
				/>
			)}

			<div className="flex gap-3">
				{canPass && (
					<button
						type="button"
						onClick={passLeadership}
						className="flex-1 h-12 rounded-xl border border-border text-sm font-bold text-white/40 hover:text-white/70 hover:bg-white/5 transition-all cursor-pointer"
					>
						Pass Leadership
					</button>
				)}
				<m.button
					type="button"
					onClick={submitNomination}
					whileTap={{ scale: 0.97 }}
					disabled={selected.length !== game.teamSize}
					className={cn(
						"h-12 rounded-xl text-sm font-bold transition-all",
						canPass ? "flex-1" : "w-full",
						selected.length === game.teamSize
							? "bg-cyan-400 text-black cursor-pointer hover:opacity-90"
							: "bg-white/5 text-white/20 cursor-not-allowed",
					)}
				>
					Nominate Team
				</m.button>
			</div>
		</div>
	);
}

function WaiterView({
	game,
	timer,
	secret,
	getName,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	secret: CybsecsSecret | null;
	getName: (id: string) => string;
}) {
	const leaderName = getName(game.playerOrder[game.leaderIndex]);

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1} · Nominating
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Nominate
				</h1>
				<TimerBar timer={timer} />
			</div>

			<div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
				<p className="text-white/50 text-lg">
					<span className="text-white font-bold">{leaderName}</span> is choosing{" "}
					{game.teamSize} players
				</p>
				{game.rejectionCount > 0 && (
					<span className="text-xs text-white/30">
						{game.rejectionCount}/5 rejections
					</span>
				)}
			</div>

			{secret && (
				<ObfuscatorToggle
					armed={secret.obfuscateArmed}
					usesLeft={secret.obfuscatorUsesLeft}
				/>
			)}
		</div>
	);
}