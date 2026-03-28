import { useState } from "react";
import { JoinBar } from "../components/home/JoinBar";
import { GameGrid } from "../components/shared/GameGrid";
import { GAMES } from "../data/games";
import type { Game } from "../types/game";

export function Home() {
	const [selected, setSelected] = useState<Game | null>(null);

	const handleSelect = (game: Game) => {
		setSelected((prev) => (prev?.id === game.id ? null : game));
	};

	const clearSelected = () => setSelected(null);

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

			{/* bottom bar */}
			<div
				className={`fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/95 backdrop-blur-md transition-transform duration-300 ease-out ${
					selected ? "translate-y-0" : "translate-y-full"
				}`}
			>
				{selected && (
					<div className="flex items-center justify-between gap-6 px-6 py-5 mx-auto max-w-5xl">
						<div className="flex items-center min-w-0 gap-4">
							<div
								className="hidden shrink-0 w-11 h-11 rounded-lg sm:block"
								style={{ backgroundColor: selected.placeholderColor }}
							/>
							<div className="flex flex-col min-w-0 gap-1">
								<span className="font-display text-xl font-extrabold leading-none uppercase truncate">
									{selected.name}
								</span>
								<p className="text-xs leading-snug text-white/70 line-clamp-2">
									{selected.description}
								</p>
								<div className="flex flex-wrap items-center gap-1.5">
									{selected.tags.map((tag) => (
										<span
											key={tag}
											className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-white/8 text-white/60"
										>
											{tag}
										</span>
									))}
									<span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-white/8 text-white/60">
										{selected.playerCount[0]}–{selected.playerCount[1]} players
									</span>
									<span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-white/8 text-white/60">
										~{selected.duration} min
									</span>
								</div>
							</div>
						</div>

						<button
							type="button"
							className="shrink-0 h-11 px-8 text-sm font-bold tracking-widest text-white uppercase transition-opacity rounded-lg cursor-pointer bg-huddle hover:opacity-85 active:opacity-70"
						>
							Create Room →
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
