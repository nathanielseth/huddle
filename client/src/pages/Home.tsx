import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { JoinBar } from "../components/home/JoinBar";
import { GameGrid } from "../components/shared/GameGrid";
import { GAMES } from "../data/games";
import { useGameStore } from "../store/useGameStore";
import type { Game } from "../types/game";

export function Home() {
	const [selected, setSelected] = useState<Game | null>(null);

	const navigate = useNavigate();
	const createRoom = useGameStore((s) => s.createRoom);
	const roomCode = useGameStore((s) => s.roomCode);

	useEffect(() => {
		if (roomCode) navigate(`/room/${roomCode}`);
	}, [roomCode, navigate]);

	const handleSelect = (game: Game) => {
		setSelected((prev) => (prev?.id === game.id ? null : game));
	};

	const clearSelected = () => setSelected(null);

	function handleCreateRoom() {
		if (!selected) return;
		createRoom(selected.id);
	}

	return (
		<div className="flex flex-col min-h-screen">
			<main className="flex flex-col flex-1 gap-10 px-6 py-14 mx-auto w-full max-w-3xl pb-44">
				<header className="flex flex-col items-center gap-3">
					<img
						src="/huddle-logo.svg"
						alt="Huddle!"
						className="w-[min(44vw,280px)]"
					/>
					<p className="text-xs font-semibold tracking-[0.3em] uppercase text-muted">
						Party games for tropa hangouts
					</p>
				</header>
				<JoinBar onFocus={clearSelected} />
				<section className="flex flex-col gap-5">
					<h2 className="text-sm font-semibold text-white">HOST A GAME</h2>
					<GameGrid
						games={GAMES}
						selectedId={selected?.id ?? null}
						onSelect={handleSelect}
					/>
				</section>
			</main>

			<AnimatePresence>
				{selected && (
					<motion.div
						key="bottom-bar"
						className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/95 backdrop-blur-md"
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						exit={{ y: "100%" }}
						transition={{
							type: "spring",
							stiffness: 380,
							damping: 32,
							mass: 1,
						}}
					>
						<div className="flex items-center justify-between gap-6 px-6 py-5 mx-auto max-w-5xl">
							<div className="flex items-center min-w-0 gap-4">
								<motion.div
									className="hidden shrink-0 w-11 h-11 rounded-lg sm:block"
									style={{ backgroundColor: selected.placeholderColor }}
									layoutId="selected-color"
								/>
								<div className="flex flex-col min-w-0 gap-1">
									<motion.span
										className="font-display text-xl font-extrabold leading-none uppercase truncate"
										initial={{ opacity: 0, x: -6 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: 0.08, duration: 0.2 }}
									>
										{selected.name}
									</motion.span>
									<motion.p
										className="text-xs leading-snug text-white/70 line-clamp-2"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: 0.12, duration: 0.2 }}
									>
										{selected.description}
									</motion.p>
									<motion.div
										className="flex flex-wrap items-center gap-1.5"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: 0.16, duration: 0.2 }}
									>
										{selected.tags.map((tag) => (
											<span
												key={tag}
												className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-white/8 text-white/60"
											>
												{tag}
											</span>
										))}
										<span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-white/8 text-white/60">
											{selected.playerCount[0]}–{selected.playerCount[1]}{" "}
											players
										</span>
										<span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-white/8 text-white/60">
											~{selected.duration} min
										</span>
									</motion.div>
								</div>
							</div>

							<button
								type="button"
								onClick={handleCreateRoom}
								className="shrink-0 h-11 px-8 text-sm font-bold tracking-widest text-white uppercase transition-opacity rounded-lg cursor-pointer bg-huddle hover:opacity-85 active:opacity-70"
							>
								Create Room →
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
