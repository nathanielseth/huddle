import { m } from "motion/react";
import { socket } from "../../../lib/network/socket";
import type { ReactionType } from "@shared/games/squadoodle/index";

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
	{ type: "fire", emoji: "🔥", label: "Fire" },
	{ type: "laugh", emoji: "😂", label: "Laugh" },
	{ type: "heart", emoji: "❤️", label: "Heart" },
	{ type: "trash", emoji: "🗑️", label: "Trash" },
];

interface Props {
	chainIndex: number;
	entryIndex: number;
}

/**
 * Three large tappable emoji buttons. Tapping sends a react action; the server
 * applies last-write-wins per player so repeated taps switch the reaction.
 */
export function ReactionBar({ chainIndex, entryIndex }: Props) {
	function react(reaction: ReactionType) {
		socket.emit("player_action", {
			type: "react",
			chainIndex,
			entryIndex,
			reaction,
		});
	}

	return (
		<div className="flex gap-4 justify-center">
			{REACTIONS.map(({ type, emoji, label }) => (
				<m.button
					key={type}
					type="button"
					aria-label={label}
					onClick={() => { react(type); }}
					whileTap={{ scale: 0.88 }}
					whileHover={{ scale: 1.08 }}
					className="text-5xl leading-none cursor-pointer select-none"
				>
					{emoji}
				</m.button>
			))}
		</div>
	);
}
