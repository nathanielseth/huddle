import {
	Suspense,
	useState,
	type ComponentType,
	type LazyExoticComponent,
} from "react";
import { useNavigate } from "react-router";
import { m, AnimatePresence } from "motion/react";
import { LogOut, Copy, Check, Users, Settings2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useGameStore } from "../../app/store";
import { GAMES } from "../../data/games";
import { GAME_REGISTRY, type LobbyConfigLayout } from "../../app/registry";
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

	const ConfigPanel = gameEntry?.config ?? null;
	const configLayout: LobbyConfigLayout = gameEntry?.configLayout ?? "inline";

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
		<div className="flex flex-col h-dvh bg-bg overflow-hidden">
			<div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
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

			<div className="flex-1 min-h-0 overflow-hidden">
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
						ConfigPanel={ConfigPanel}
						configLayout={configLayout}
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
						ConfigPanel={ConfigPanel}
						configLayout={configLayout}
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
	configLayout: LobbyConfigLayout;
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
	configLayout,
	supportsCpuSeats,
	onAddCpu,
	onRemoveCpu,
	hostPlayerId,
	isHostSeated,
	onJoinAsPlayer,
	onLeavePlayerSeat,
}: HostLobbyProps) {
	const isFullConfig = configLayout === "full" && ConfigPanel !== null;
	const isPanelConfig = configLayout === "panel" && ConfigPanel !== null;
	const isInlineConfig = configLayout === "inline" && ConfigPanel !== null;

	return (
		<div className="flex flex-col h-full">
			{(isFullConfig || isPanelConfig) && (
				<IdentityStrip roomCode={roomCode} copied={copied} onCopy={onCopy} />
			)}

			<div
				className={`flex-1 min-h-0 ${
					isFullConfig || isPanelConfig
						? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
						: "flex flex-col items-center justify-center overflow-y-auto"
				}`}
			>
				{/* players column */}
				<div
					className={`flex flex-col min-h-0 px-6 ${
						isFullConfig || isPanelConfig
							? "py-5 lg:border-r border-border"
							: "w-full max-w-md py-8 gap-8"
					}`}
				>
					{!(isFullConfig || isPanelConfig) && (
						<IdentityBlock
							roomCode={roomCode}
							copied={copied}
							onCopy={onCopy}
						/>
					)}

					<div className="flex flex-col min-h-0 w-full gap-4">
						<PlayerList
							players={players}
							playerId={hostPlayerId}
							onKick={onKick}
							onRemoveCpu={onRemoveCpu}
						/>

						<div className="flex flex-wrap items-center gap-2 shrink-0">
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
									+ Add CPU
								</button>
							)}
						</div>
					</div>
				</div>

				{(isFullConfig || isPanelConfig) && ConfigPanel && (
					<div className="flex flex-col min-h-0 px-6 py-5 overflow-y-auto">
						<ConfigZoneHeader />
						<Suspense fallback={<ConfigFallback />}>
							<ConfigPanel />
						</Suspense>
					</div>
				)}
			</div>

			<div className="flex flex-col items-center gap-4 px-6 py-6 border-t border-border shrink-0">
				{isInlineConfig && ConfigPanel && (
					<Suspense fallback={null}>
						<ConfigPanel />
					</Suspense>
				)}
				<StartButton
					canStart={canStart}
					minPlayers={minPlayers}
					onStart={onStart}
				/>
			</div>
		</div>
	);
}

function IdentityStrip({
	roomCode,
	copied,
	onCopy,
}: {
	roomCode: string;
	copied: boolean;
	onCopy: () => void;
}) {
	return (
		<m.div
			className="flex items-center justify-center gap-6 px-6 py-4 border-b border-border shrink-0"
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25 }}
		>
			<div className="flex flex-col items-center gap-1">
				<p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/40">
					Room Code
				</p>
				<div className="flex items-center gap-3">
					<span className="font-display text-4xl font-black tracking-widest uppercase text-white leading-none">
						{roomCode}
					</span>
					<CopyButton copied={copied} onCopy={onCopy} />
				</div>
			</div>

			<div className="hidden sm:flex items-center gap-3 pl-6 border-l border-border">
				<div className="p-2 rounded-xl bg-white shrink-0">
					<QRCodeSVG
						value={`${window.location.origin}/join/${roomCode}`}
						size={72}
						level="M"
						bgColor="#ffffff"
						fgColor="#0f0f0f"
					/>
				</div>
				<p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white/30 max-w-16 leading-tight">
					Scan to join
				</p>
			</div>
		</m.div>
	);
}

function IdentityBlock({
	roomCode,
	copied,
	onCopy,
}: {
	roomCode: string;
	copied: boolean;
	onCopy: () => void;
}) {
	return (
		<m.div
			className="flex flex-col items-center gap-5"
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25 }}
		>
			<div className="flex flex-col items-center gap-2">
				<p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/40">
					Room Code
				</p>
				<div className="flex items-center gap-3">
					<span className="font-display text-6xl font-black tracking-widest uppercase text-white leading-none">
						{roomCode}
					</span>
					<CopyButton copied={copied} onCopy={onCopy} />
				</div>
			</div>

			<div className="flex flex-col items-center gap-2">
				<div className="p-3 rounded-xl bg-white">
					<QRCodeSVG
						value={`${window.location.origin}/join/${roomCode}`}
						size={104}
						level="M"
						bgColor="#ffffff"
						fgColor="#0f0f0f"
					/>
				</div>
				<p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/30">
					Scan to join
				</p>
			</div>
		</m.div>
	);
}

function CopyButton({
	copied,
	onCopy,
}: {
	copied: boolean;
	onCopy: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onCopy}
			className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all cursor-pointer shrink-0"
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
						<Check size={15} className="text-green-400" />
					</m.span>
				) : (
					<m.span
						key="copy"
						initial={{ scale: 0.7, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.7, opacity: 0 }}
						transition={{ duration: 0.15 }}
					>
						<Copy size={15} />
					</m.span>
				)}
			</AnimatePresence>
		</button>
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
	ConfigPanel: LazyExoticComponent<ComponentType> | null;
	configLayout: LobbyConfigLayout;
}

function GuestLobby({
	roomCode,
	players,
	playerId,
	canStart,
	minPlayers,
	isPartyLeader,
	onStart,
	ConfigPanel,
	configLayout,
}: GuestLobbyProps) {
	const isFullConfig = configLayout === "full" && ConfigPanel !== null;
	const isPanelConfig = configLayout === "panel" && ConfigPanel !== null;
	const isInlineConfig = configLayout === "inline" && ConfigPanel !== null;

	return (
		<div className="flex flex-col h-full">
			<div
				className={`flex-1 min-h-0 ${
					isFullConfig || isPanelConfig
						? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
						: "flex flex-col items-center justify-center overflow-y-auto"
				}`}
			>
				<div
					className={`flex flex-col min-h-0 px-6 ${
						isFullConfig || isPanelConfig
							? "py-5 lg:border-r border-border"
							: "w-full max-w-md py-8 gap-6"
					}`}
				>
					<m.div
						className="flex flex-col items-center gap-1 shrink-0"
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25 }}
					>
						<p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/40">
							Room Code
						</p>
						<span className="font-display text-4xl font-black tracking-widest uppercase text-white leading-none">
							{roomCode}
						</span>
					</m.div>

					{isPartyLeader ? (
						<m.div
							className="flex flex-col items-center gap-1 shrink-0"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.1, duration: 0.3 }}
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
							className="text-white/50 text-sm text-center shrink-0"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.1, duration: 0.3 }}
						>
							Waiting for the host to start...
						</m.p>
					)}

					<PlayerList players={players} playerId={playerId} />
				</div>

				{(isFullConfig || isPanelConfig) && ConfigPanel && (
					<div className="flex flex-col min-h-0 px-6 py-5 overflow-y-auto">
						<ConfigZoneHeader />
						<Suspense fallback={<ConfigFallback />}>
							<ConfigPanel />
						</Suspense>
					</div>
				)}
			</div>

			<div className="flex flex-col items-center gap-4 px-6 py-6 border-t border-border shrink-0">
				{isInlineConfig && ConfigPanel && (
					<Suspense fallback={null}>
						<ConfigPanel />
					</Suspense>
				)}
				{isPartyLeader && (
					<StartButton
						canStart={canStart}
						minPlayers={minPlayers}
						onStart={onStart}
					/>
				)}
			</div>
		</div>
	);
}

// shared

function ConfigZoneHeader() {
	return (
		<div className="flex items-center gap-2 mb-4 shrink-0">
			<Settings2 size={13} className="text-white/30" />
			<p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/40">
				Settings
			</p>
		</div>
	);
}

function ConfigFallback() {
	return (
		<div className="flex items-center gap-2 text-white/20 text-xs">
			<Users size={13} className="animate-pulse" />
			Loading settings…
		</div>
	);
}

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
			transition={{ delay: 0.15, duration: 0.3 }}
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
