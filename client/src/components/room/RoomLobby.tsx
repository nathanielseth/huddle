import {
	Suspense,
	useState,
	type ComponentType,
	type LazyExoticComponent,
} from "react";
import { useNavigate } from "react-router";
import { m, AnimatePresence } from "motion/react";
import { LogOut, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useGameStore } from "../../app/store";
import { GAMES } from "../../data/games";
import { GAME_REGISTRY } from "../../app/registry";
import { PlayerList } from "./PlayerList";

export function RoomLobby() {
	const navigate = useNavigate();
	const role = useGameStore((s) => s.role);
	const roomCode = useGameStore((s) => s.roomCode);
	const players = useGameStore((s) => s.players);
	const gameId = useGameStore((s) => s.gameId);
	const playerId = useGameStore((s) => s.playerId);
	const leaveRoom = useGameStore((s) => s.leaveRoom);
	const startGame = useGameStore((s) => s.startGame);
	const kickPlayer = useGameStore((s) => s.kickPlayer);
	const addCpuSeat = useGameStore((s) => s.addCpuSeat);
	const removeCpuSeat = useGameStore((s) => s.removeCpuSeat);
	const joinAsPlayer = useGameStore((s) => s.joinAsPlayer);
	const leavePlayerSeat = useGameStore((s) => s.leavePlayerSeat);

	const [copied, setCopied] = useState(false);

	const isHostSeated = players.some((p) => p.id === playerId);

	const game = GAMES.find((g) => g.id === gameId) ?? null;
	const gameEntry = GAME_REGISTRY.find((g) => g.id === gameId) ?? null;
	const connectedCount = players.filter((p) => p.isConnected).length;
	const minPlayers = game?.playerCount[0] ?? 2;
	const canStart = connectedCount >= minPlayers;
	const isPartyLeader = players[0]?.id === playerId;

	function handleLeave() {
		leaveRoom();
		void navigate("/");
	}

	function handleCopy() {
		void navigator.clipboard.writeText(roomCode);
		setCopied(true);
		setTimeout(() => {
			setCopied(false);
		}, 2000);
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
					{game?.beta && (
						<span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20">
							Beta
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
					<HostLobby
						roomCode={roomCode}
						copied={copied}
						onCopy={handleCopy}
						players={players}
						canStart={canStart}
						minPlayers={minPlayers}
						onStart={startGame}
						onKick={kickPlayer}
						ConfigPanel={gameEntry?.config ?? null}
						supportsCpuSeats={game?.supportsCpuSeats ?? false}
						onAddCpu={addCpuSeat}
						onRemoveCpu={removeCpuSeat}
						hostPlayerId={playerId}
						isHostSeated={isHostSeated}
						onJoinAsPlayer={joinAsPlayer}
						onLeavePlayerSeat={leavePlayerSeat}
					/>
				) : (
					<GuestLobby
						roomCode={roomCode}
						players={players}
						playerId={playerId}
						canStart={canStart}
						minPlayers={minPlayers}
						isPartyLeader={isPartyLeader}
						onStart={startGame}
					/>
				)}
			</div>
		</div>
	);
}

// host view

import type { Player } from "@shared/core/room";

interface HostLobbyProps {
	roomCode: string;
	copied: boolean;
	onCopy: () => void;
	players: Player[];
	canStart: boolean;
	minPlayers: number;
	onStart: () => void;
	onKick: (id: string) => void;
	ConfigPanel: LazyExoticComponent<ComponentType> | null;
	supportsCpuSeats: boolean;
	onAddCpu: () => void;
	onRemoveCpu: (id: string) => void;
	hostPlayerId: string;
	isHostSeated: boolean;
	onJoinAsPlayer: (name: string) => void;
	onLeavePlayerSeat: () => void;
}

function HostLobby({
	roomCode,
	copied,
	onCopy,
	players,
	canStart,
	minPlayers,
	onStart,
	onKick,
	ConfigPanel,
	supportsCpuSeats,
	onAddCpu,
	onRemoveCpu,
	hostPlayerId,
	isHostSeated,
	onJoinAsPlayer,
	onLeavePlayerSeat,
}: HostLobbyProps) {
	return (
		<>
			<m.div
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
						onClick={onCopy}
						className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all cursor-pointer"
						aria-label="Copy room code"
					>
						<AnimatePresence mode="wait">
							{copied ? (
								<m.span
									key="check"
									initial={{ scale: 0.7, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0.7, opacity: 0 }}
									transition={{ duration: 0.15 }}
								>
									<Check size={16} className="text-green-400" />
								</m.span>
							) : (
								<m.span
									key="copy"
									initial={{ scale: 0.7, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0.7, opacity: 0 }}
									transition={{ duration: 0.15 }}
								>
									<Copy size={16} />
								</m.span>
							)}
						</AnimatePresence>
					</button>
				</div>
			</m.div>

			<m.div
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
			</m.div>

			<PlayerList
				players={players}
				playerId={hostPlayerId}
				onKick={onKick}
				onRemoveCpu={onRemoveCpu}
			/>

			<HostSeatControl
				isHostSeated={isHostSeated}
				onJoin={onJoinAsPlayer}
				onLeave={onLeavePlayerSeat}
			/>

			{supportsCpuSeats && (
				<button
					type="button"
					onClick={onAddCpu}
					className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 hover:text-white/80 transition-all cursor-pointer"
				>
					+ Add CPU Player
				</button>
			)}

			{ConfigPanel && (
				<Suspense fallback={null}>
					<ConfigPanel />
				</Suspense>
			)}

			<StartButton
				canStart={canStart}
				minPlayers={minPlayers}
				onStart={onStart}
			/>
		</>
	);
}

// lets the host join the player seats (or step back out) without leaving their host controls
function HostSeatControl({
	isHostSeated,
	onJoin,
	onLeave,
}: {
	isHostSeated: boolean;
	onJoin: (name: string) => void;
	onLeave: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState("");

	if (isHostSeated) {
		return (
			<button
				type="button"
				onClick={onLeave}
				className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 hover:text-white/80 transition-all cursor-pointer"
			>
				Leave Player Seat
			</button>
		);
	}

	if (editing) {
		return (
			<form
				className="flex items-center gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					const trimmed = name.trim();
					if (!trimmed) return;
					onJoin(trimmed);
					setEditing(false);
					setName("");
				}}
			>
				<input
					autoFocus
					value={name}
					onChange={(e) => {
						setName(e.target.value.slice(0, 10));
					}}
					placeholder="Your name"
					className="w-32 h-9 px-3 rounded-lg text-xs font-semibold bg-white/5 border border-border text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
				/>
				<button
					type="submit"
					disabled={!name.trim()}
					className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest text-white bg-huddle hover:opacity-85 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
				>
					Join
				</button>
			</form>
		);
	}

	return (
		<button
			type="button"
			onClick={() => {
				setEditing(true);
			}}
			className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 hover:text-white/80 transition-all cursor-pointer"
		>
			Join as Player
		</button>
	);
}

// guest view

interface GuestLobbyProps {
	roomCode: string;
	players: Player[];
	playerId: string;
	canStart: boolean;
	minPlayers: number;
	isPartyLeader: boolean;
	onStart: () => void;
}

function GuestLobby({
	roomCode,
	players,
	playerId,
	canStart,
	minPlayers,
	isPartyLeader,
	onStart,
}: GuestLobbyProps) {
	return (
		<>
			<m.div
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
			</m.div>

			{isPartyLeader ? (
				<m.div
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
				</m.div>
			) : (
				<m.p
					className="text-white/50 text-sm"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.15, duration: 0.3 }}
				>
					Waiting for the host to start...
				</m.p>
			)}

			<PlayerList players={players} playerId={playerId} />

			{isPartyLeader && (
				<StartButton
					canStart={canStart}
					minPlayers={minPlayers}
					onStart={onStart}
				/>
			)}
		</>
	);
}

// shared

function StartButton({
	canStart,
	minPlayers,
	onStart,
}: {
	canStart: boolean;
	minPlayers: number;
	onStart: () => void;
}) {
	return (
		<m.div
			className="flex flex-col items-center gap-2"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: 0.2, duration: 0.3 }}
		>
			<button
				type="button"
				disabled={!canStart}
				onClick={onStart}
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
		</m.div>
	);
}