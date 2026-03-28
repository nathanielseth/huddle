import type { Game } from "../../types/game";

interface GameCardProps {
	game: Game;
	isSelected: boolean;
	onSelect: (game: Game) => void;
}

export function GameCard({ game, isSelected, onSelect }: GameCardProps) {
	return (
		<button
			type="button"
			onClick={() => onSelect(game)}
			className={`group flex flex-col gap-2 overflow-hidden text-left rounded-lg transition-transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer outline-none ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-huddle ${
				isSelected ? "ring-2 ring-huddle" : "ring-0"
			}`}
		>
			{/* thumbnail */}
			<div
				className="overflow-hidden w-full rounded-lg aspect-video"
				style={{ backgroundColor: game.placeholderColor }}
			>
				{game.thumbnail ? (
					<img
						src={game.thumbnail}
						alt={game.name}
						className="object-cover w-full h-full"
					/>
				) : (
					<div className="flex justify-center items-center w-full h-full">
						<span className="font-display text-5xl font-extrabold text-white/20 uppercase select-none">
							{game.name.charAt(0)}
						</span>
					</div>
				)}
			</div>

			<p className="px-0.5 text-sm font-semibold truncate">{game.name}</p>
		</button>
	);
}
