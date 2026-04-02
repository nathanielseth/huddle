import { use3DTilt } from "../../hooks/use3DTilt";
import type { Game } from "../../types/game";
import { cn } from "../../utils/cn";

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
	const dimmed = anySelected && !isSelected;

	return (
		<button
			type="button"
			ref={ref}
			onClick={() => onSelect(game)}
			{...tiltEvents}
			className={cn(
				"group relative aspect-video rounded-xl overflow-hidden text-left cursor-pointer will-change-transform",
				"outline-none focus-visible:ring-2 focus-visible:ring-huddle focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
				"transition-opacity duration-0",
				isSelected && "ring-2 ring-huddle",
				dimmed ? "opacity-35" : "opacity-100",
			)}
			style={{ backgroundColor: game.placeholderColor }}
		>
			{game.thumbnail ? (
				<>
					<img
						src={game.thumbnail}
						alt=""
						className="absolute inset-0 w-full h-full object-cover"
					/>
					<span className="sr-only">{game.name}</span>
				</>
			) : (
				<>
					<div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
					<div className="absolute top-0 left-0 p-3 pr-6">
						<p
							className="font-display font-extrabold uppercase leading-[1.1] text-white drop-shadow-sm"
							style={{ fontSize: "clamp(0.7rem, 2vw, 1rem)" }}
						>
							{game.name}
						</p>
					</div>
				</>
			)}
		</button>
	);
}
