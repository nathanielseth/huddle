import { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, Copy, Check } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { GAMES } from "../data/games";
import { SabongGame } from "../games/sabong/SabongGame";
import { SussyGame } from "../games/sussy/SussyGame";
import { FinishedHost, FinishedPlayer } from "../games/sabong/phases/Finished";
import { QRCodeSVG } from "qrcode.react";
import type { Player } from "@shared/types";

export function Room() {
	const navigate = useNavigate();
	const role = useGameStore((s) => s.role);
	const roomCode = useGameStore((s) => s.roomCode);
	const players = useGameStore((s) => s.players);
	const gameId = useGameStore((s) => s.gameId);
	const playerId = useGameStore((s) => s.playerId);
	const leaveRoom = useGameStore((s) => s.leaveRoom);
	const phase = useGameStore((s) => s.phase);
	const startGame = useGameStore((s) => s.startGame);

	const [copied, setCopied] = useState(false);

	if (!roomCode) return <Navigate to="/" replace />;

	const game = GAMES.find((g) => g.id === gameId) ?? null;
	const connectedCount = players.filter((p) => p.isConnected).length;
	const minPlayers = game?.playerCount[0] ?? 2;
	const canStart = connectedCount >= minPlayers;
	const isPartyLeader = players[0]?.id === playerId;

	function handleLeave() {
		leaveRoom();
		navigate("/");
	}

	function handleCopy() {
		navigator.clipboard.writeText(roomCode);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	if (phase === "in_game") {
		if (gameId === "super-sabong") return <SabongGame />;
		if (gameId === "sussy-impostors") return <SussyGame />;
	}

	if (phase === "ended") {
		if (gameId === "super-sabong") {
			return role === "host" ? <FinishedHost /> : <FinishedPlayer />;
		}
		if (gameId === "sussy-impostors") return <SussyGame />; 
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Game over.
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen bg-bg">
			{/* Top bar */}
			<div className="flex items-center justify-between px-6 py-5 border-b border-border">
				<div className="flex items-center gap-3">
					{game && (
						<span className="text-xs font-semibold tracking-[0.2em] uppercase text-white/40">
							{game.name}
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={handleLeave}
					className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest text-white/40 hover:text-white/80 hover:bg-white/5 transition-all cursor-pointer"
				>
					<LogOut size={14} />
					Leave
				</button>
			</div>

			<div className="flex flex-col flex-1 items-center justify-center gap-12 px-6 py-12">
				{role === "host" ? (
					<>
						<motion.div
							className="flex flex-col items-center gap-4"
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3 }}
						>
							<p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/40">
								Players, enter this code
							</p>
							<div className="flex items-center gap-4">
								<span className="font-display text-7xl font-black tracking-[0.12em] uppercase text-white leading-none">
									{roomCode}
								</span>
								<button
									type="button"
									onClick={handleCopy}
									className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all cursor-pointer"
									aria-label="Copy room code"
								>
									<AnimatePresence mode="wait">
										{copied ? (
											<motion.span
												key="check"
												initial={{ scale: 0.7, opacity: 0 }}
												animate={{ scale: 1, opacity: 1 }}
												exit={{ scale: 0.7, opacity: 0 }}
												transition={{ duration: 0.15 }}
											>
												<Check size={16} className="text-green-400" />
											</motion.span>
										) : (
											<motion.span
												key="copy"
												initial={{ scale: 0.7, opacity: 0 }}
												animate={{ scale: 1, opacity: 1 }}
												exit={{ scale: 0.7, opacity: 0 }}
												transition={{ duration: 0.15 }}
											>
												<Copy size={16} />
											</motion.span>
										)}
									</AnimatePresence>
								</button>
							</div>
						</motion.div>

						<motion.div
							className="flex flex-col items-center gap-3"
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.25 }}
						>
							<div className="p-3 rounded-xl bg-white">
								<QRCodeSVG
									value={`${window.location.origin}/join/${roomCode}`}
									size={120}
									level="M"
									bgColor="#ffffff"
									fgColor="#0f0f0f"
								/>
							</div>
							<p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/30">
								Scan to join
							</p>
						</motion.div>

						<PlayerList players={players} playerId={null} />

						<motion.div
							className="flex flex-col items-center gap-2"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.2, duration: 0.3 }}
						>
							<button
								type="button"
								disabled={!canStart}
								onClick={startGame}
								className={`h-12 px-12 rounded-lg text-sm font-bold tracking-widest uppercase transition-all duration-150 ${
									canStart
										? "bg-huddle text-white cursor-pointer hover:opacity-85 active:opacity-70"
										: "bg-white/5 text-white/20 cursor-not-allowed"
								}`}
							>
								Start Game
							</button>
							{!canStart && (
								<p className="text-xs text-white/30">
									Need at least {minPlayers} players to start
								</p>
							)}
						</motion.div>
					</>
				) : (
					<>
						<motion.div
							className="flex flex-col items-center gap-2"
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3 }}
						>
							<p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/40">
								Room
							</p>
							<span className="font-display text-4xl font-black tracking-[0.12em] uppercase text-white">
								{roomCode}
							</span>
						</motion.div>

						{isPartyLeader ? (
							<motion.div
								className="flex flex-col items-center gap-2"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.15, duration: 0.3 }}
							>
								<p className="text-xs font-semibold tracking-[0.2em] uppercase text-huddle">
									👑 You're the Party Leader
								</p>
								<p className="text-white/40 text-xs">
									You can start the game whenever you're ready.
								</p>
							</motion.div>
						) : (
							<motion.p
								className="text-white/50 text-sm"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.15, duration: 0.3 }}
							>
								Waiting for the host to start...
							</motion.p>
						)}

						<PlayerList players={players} playerId={playerId} />

						{isPartyLeader && (
							<motion.div
								className="flex flex-col items-center gap-2"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.2, duration: 0.3 }}
							>
								<button
									type="button"
									disabled={!canStart}
									onClick={startGame}
									className={`h-12 px-12 rounded-lg text-sm font-bold tracking-widest uppercase transition-all duration-150 ${
										canStart
											? "bg-huddle text-white cursor-pointer hover:opacity-85 active:opacity-70"
											: "bg-white/5 text-white/20 cursor-not-allowed"
									}`}
								>
									Start Game
								</button>
								{!canStart && (
									<p className="text-xs text-white/30">
										Need at least {minPlayers} players to start
									</p>
								)}
							</motion.div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

function PlayerList({
	players,
	playerId,
}: {
	players: Player[];
	playerId: string | null;
}) {
	return (
		<motion.div
			className="flex flex-col gap-3 w-full max-w-sm"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: 0.1, duration: 0.3 }}
		>
			<p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/40">
				Players{" "}
				<span className="text-white/20">
					{players.filter((p) => p.isConnected).length}/{players.length}
				</span>
			</p>

			<AnimatePresence>
				{players.length === 0 ? (
					<motion.p
						key="empty"
						className="text-sm text-white/25 py-4 text-center"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						No players yet
					</motion.p>
				) : (
					players.map((player, index) => (
						<motion.div
							key={player.id}
							className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/4 border border-border"
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 10 }}
							transition={{ duration: 0.2 }}
						>
							<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/8 text-xs font-bold text-white/60 shrink-0 uppercase">
								{index === 0 ? "👑" : player.name.slice(0, 2)}
							</div>
							<span className="flex-1 text-sm font-medium text-white">
								{player.name}
								{player.id === playerId && (
									<span className="ml-2 text-xs text-white/30">(you)</span>
								)}
							</span>
							<span
								className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
									player.isConnected ? "bg-green-400" : "bg-white/20"
								}`}
							/>
						</motion.div>
					))
				)}
			</AnimatePresence>
		</motion.div>
	);
}
