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
			onClick={() => onSelect(game)}
			{...tiltEvents}
			className={cn(
				"group relative aspect-video rounded-xl overflow-hidden cursor-pointer transform-gpu",
				"outline-none focus-visible:ring-2 focus-visible:ring-huddle focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
				"transition-all duration-300 ease-out",
				isSelected
					? "ring-2 ring-huddle shadow-lg shadow-huddle/30"
					: "hover:scale-[1.02]",
				anySelected && !isSelected ? "opacity-35" : "opacity-100",
			)}
		>
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-px z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				style={{
					background: `radial-gradient(400px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(255,255,255,0.12), transparent 40%)`,
				}}
			/>
			<img
				src={game.thumbnail}
				alt=""
				className="absolute inset-0 w-full h-full object-cover"
			/>
		</button>
	);
}
