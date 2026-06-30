import { useEffect, Suspense } from "react";
import { useNavigate, Navigate } from "react-router";
import { AnimatePresence } from "motion/react";
import { useGameStore } from "../app/store";
import { GAME_REGISTRY } from "@/app/registry";
import { PauseOverlay } from "../components/ui/PauseOverlay";
import { RoomLobby } from "../components/room/RoomLobby";

function GameShell() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-bg">
			<span className="text-white/20 text-xs tracking-widest uppercase animate-pulse">
				Loading…
			</span>
		</div>
	);
}

function InGame() {
	const navigate = useNavigate();
	const gameId = useGameStore((s) => s.gameId);
	const phase = useGameStore((s) => s.phase);
	const role = useGameStore((s) => s.role);
	const pauseReason = useGameStore((s) => s.pauseReason);
	const hostReconnectDeadline = useGameStore((s) => s.hostReconnectDeadline);
	const leaveRoom = useGameStore((s) => s.leaveRoom);
	const resumeGame = useGameStore((s) => s.resumeGame);

	const entry = GAME_REGISTRY.find((g) => g.id === gameId);

	function handleQuit() {
		leaveRoom();
		void navigate("/");
	}

	if (!entry) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Game over.
			</div>
		);
	}

	return (
		<div className="relative isolate">
			<Suspense fallback={<GameShell />}>
				<entry.inGame />
			</Suspense>
			<AnimatePresence>
				{phase === "paused" && (
					<PauseOverlay
						pauseReason={pauseReason}
						hostReconnectDeadline={hostReconnectDeadline}
						isHost={role === "host"}
						onResume={resumeGame}
						onQuit={handleQuit}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

export function Room() {
	const navigate = useNavigate();
	const roomCode = useGameStore((s) => s.roomCode);
	const phase = useGameStore((s) => s.phase);

	useEffect(() => {
		if (!roomCode) void navigate("/", { replace: true });
	}, [roomCode, navigate]);

	useEffect(() => {
		if (phase !== "in_game") return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") useGameStore.getState().pauseGame();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => { window.removeEventListener("keydown", onKeyDown); };
	}, [phase]);

	if (!roomCode) return <Navigate to="/" replace />;

	if (phase === "in_game" || phase === "paused" || phase === "ended") {
		return <InGame />;
	}

	return <RoomLobby />;
}