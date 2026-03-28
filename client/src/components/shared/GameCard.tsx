import { useRef } from "react";
import type { Game } from "../../types/game";

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
	const cardRef = useRef<HTMLButtonElement>(null);
	const dimmed = anySelected && !isSelected;

	function handleMouseEnter() {
		const card = cardRef.current;
		if (!card) return;
		card.style.transition = "transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1)";
		card.style.transform =
			"perspective(700px) rotateX(0deg) rotateY(0deg) scale(1.06)";
	}

	function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
		const card = cardRef.current;
		if (!card) return;

		const rect = card.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const dx = (e.clientX - cx) / (rect.width / 2);
		const dy = (e.clientY - cy) / (rect.height / 2);

		const rotateX = -dy * 10;
		const rotateY = dx * 12;

		card.style.transition = "transform 0.08s ease-out";
		card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.06)`;
	}

	function handleMouseLeave() {
		const card = cardRef.current;
		if (!card) return;
		card.style.transition = "transform 0.6s cubic-bezier(0.23, 1.2, 0.32, 1)";
		card.style.transform =
			"perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
	}

	return (
		<button
			type="button"
			ref={cardRef}
			onClick={() => onSelect(game)}
			onMouseEnter={handleMouseEnter}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			className={[
				"group relative aspect-video rounded-xl overflow-hidden text-left",
				"outline-none focus-visible:ring-2 focus-visible:ring-huddle focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
				"cursor-pointer will-change-transform",
				isSelected ? "ring-2 ring-huddle" : "",
				dimmed ? "opacity-35" : "opacity-100",
				"transition-opacity duration-10",
			].join(" ")}
			style={{ backgroundColor: game.placeholderColor }}
		>
			{game.thumbnail && (
				<img
					src={game.thumbnail}
					alt={game.name}
					className="absolute inset-0 w-full h-full object-cover"
				/>
			)}

			<div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />

			<div className="absolute top-0 left-0 p-3 pr-6">
				<p
					className="font-display font-extrabold uppercase leading-[1.1] text-white drop-shadow-sm"
					style={{ fontSize: "clamp(0.7rem, 2vw, 1rem)" }}
				>
					{game.name}
				</p>
			</div>
		</button>
	);
}
