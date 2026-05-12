import { use3DTilt } from "../../hooks/animation/use3DTilt";
import type { Game } from "../../types/game";
import { cn } from "../../lib/utils/cn";

interface GameCardProps {
	game: Game;
	isSelected: boolean;
	onSelect: (game: Game) => void;
	anySelected: boolean;
}

export function GameCard({
	game,
	isSelected,
	onSelect,
	anySelected,
}: GameCardProps) {
	const { ref, ...tiltEvents } = use3DTilt<HTMLButtonElement>();

	return (
		<button
			type="button"
			ref={ref}
			aria-label={game.name}
			aria-pressed={isSelected}
			onClick={() => !game.comingSoon && onSelect(game)}
			{...tiltEvents}
			className={cn(
				"group relative aspect-video rounded-xl overflow-hidden transform-gpu",
				"outline-none focus-visible:ring-2 focus-visible:ring-huddle focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
				"transition-[opacity,transform,box-shadow] duration-300 ease-out",
				isSelected
					? "ring-2 ring-huddle shadow-lg shadow-huddle/30"
					: "hover:scale-[1.02]",
				anySelected && !isSelected ? "opacity-35" : "opacity-100",
				game.comingSoon ? "cursor-not-allowed" : "cursor-pointer",
			)}
		>
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-px z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				style={{
					background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.12), transparent 40%)`,
				}}
			/>

			<div
				aria-hidden
				className="absolute inset-0"
				style={{ backgroundColor: game.placeholderColor ?? "#1a1a1a" }}
			/>

			<img
				src={game.thumbnail}
				alt=""
				loading="eager"
				fetchPriority="high"
				decoding="async"
				className="absolute inset-0 w-full h-full object-cover"
			/>

			{game.comingSoon && (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
					<span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full bg-white/10 text-white/50 border border-white/10">
						Soon
					</span>
				</div>
			)}
		</button>
	);
}
