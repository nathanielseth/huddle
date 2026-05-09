import type { Game } from "../../types/game";
import { GameCard } from "./GameCard";

interface GameGridProps {
	games: Game[];
	selectedId: string | null;
	onSelect: (game: Game) => void;
}

export function GameGrid({ games, selectedId, onSelect }: GameGridProps) {
	const anySelected = selectedId !== null;

	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
			{games.map((game) => (
				<GameCard
					key={game.id}
					game={game}
					isSelected={selectedId === game.id}
					anySelected={anySelected}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
}
