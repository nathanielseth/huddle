import { useEffect, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import type { PauseReason } from "@shared/types";

interface Props {
	pauseReason: PauseReason | null;
	hostReconnectDeadline: number | null;
	isHost: boolean;
	onResume: () => void;
	onQuit: () => void;
}

function useReconnectCountdown(deadline: number | null): number {
	const [seconds, setSeconds] = useState<number>(0);

	useEffect(() => {
		if (deadline === null) return;

		const compute = (): number =>
			Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

		let intervalId: ReturnType<typeof setInterval> | undefined;

		const timeoutId = setTimeout(() => {
			setSeconds(compute());
			intervalId = setInterval(() => {
				const remaining = compute();
				setSeconds(remaining);
				if (remaining === 0) clearInterval(intervalId);
			}, 1000);
		}, 0);

		return () => {
			clearTimeout(timeoutId);
			clearInterval(intervalId);
		};
	}, [deadline]);

	return seconds;
}

function formatTime(s: number): string {
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PauseOverlay({
	pauseReason,
	hostReconnectDeadline,
	isHost,
	onResume,
	onQuit,
}: Props) {
	const countdown = useReconnectCountdown(hostReconnectDeadline);
	const [confirming, setConfirming] = useState(false);
	const isHostDisconnected = pauseReason === "host_disconnected";

	return (
		<m.div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			<m.div
				className="flex flex-col items-center gap-6 w-full max-w-sm mx-4 px-8 py-10 rounded-2xl bg-bg border border-border text-center"
				initial={{ scale: 0.94, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				exit={{ scale: 0.94, opacity: 0 }}
				transition={{ duration: 0.2 }}
			>
				{isHostDisconnected ? (
					<>
						<div className="flex flex-col items-center gap-2">
							<span className="text-4xl">📡</span>
							<h2 className="text-base font-bold tracking-wide text-white">
								Host Lost Connection
							</h2>
							<p className="text-sm text-white/40">
								Waiting for them to reconnect…
							</p>
						</div>
						{countdown > 0 && (
							<div className="flex flex-col items-center gap-1">
								<span className="font-mono text-3xl font-black text-white tabular-nums">
									{formatTime(countdown)}
								</span>
								<p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/30">
									until game is abandoned
								</p>
							</div>
						)}
					</>
				) : (
					<AnimatePresence mode="wait">
						{confirming ? (
							<m.div
								key="confirm"
								className="flex flex-col items-center gap-6 w-full"
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.15 }}
							>
								<div className="flex flex-col items-center gap-2">
									<span className="text-4xl">⚠️</span>
									<h2 className="text-base font-bold tracking-wide text-white">
										End the game?
									</h2>
									<p className="text-sm text-white/40">
										This closes the room for all players.
									</p>
								</div>
								<div className="flex flex-col gap-2 w-full">
									<button
										type="button"
										onClick={onQuit}
										className="h-11 w-full rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold tracking-widest uppercase hover:bg-red-500/30 active:opacity-70 transition-all cursor-pointer"
									>
										Yes, end game
									</button>
									<button
										type="button"
										onClick={() => setConfirming(false)}
										className="h-11 w-full rounded-lg text-white/40 text-sm font-semibold tracking-widest uppercase hover:text-white/70 hover:bg-white/5 transition-all cursor-pointer"
									>
										Cancel
									</button>
								</div>
							</m.div>
						) : (
							<m.div
								key="paused"
								className="flex flex-col items-center gap-6 w-full"
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.15 }}
							>
								<div className="flex flex-col items-center gap-2">
									<span className="text-4xl">⏸</span>
									<h2 className="text-base font-bold tracking-wide text-white">
										Game Paused
									</h2>
									{!isHost && (
										<p className="text-sm text-white/40">
											Waiting for the host to resume…
										</p>
									)}
								</div>
								{isHost && (
									<div className="flex flex-col items-center gap-3 w-full">
										<button
											type="button"
											onClick={onResume}
											className="h-11 w-full rounded-lg bg-huddle text-white text-sm font-bold tracking-widest uppercase hover:opacity-85 active:opacity-70 transition-opacity cursor-pointer"
										>
											Resume
										</button>
										<button
											type="button"
											onClick={() => setConfirming(true)}
											className="h-9 w-full rounded-lg text-white/30 text-xs font-semibold tracking-widest uppercase hover:text-white/60 hover:bg-white/5 transition-all cursor-pointer"
										>
											End Game
										</button>
									</div>
								)}
							</m.div>
						)}
					</AnimatePresence>
				)}
			</m.div>
		</m.div>
	);
}