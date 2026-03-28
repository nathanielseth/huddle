import type { Game } from "../../types/game";
import { GameCard } from "./GameCard";

interface GameGridProps {
	games: Game[];
	selectedId: string | null;
	onSelect: (game: Game) => void;
}

export function GameGrid({ games, selectedId, onSelect }: GameGridProps) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
			{games.map((game) => (
				<GameCard
					key={game.id}
					game={game}
					isSelected={selectedId === game.id}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
}
