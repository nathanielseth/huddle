import { useGameStore } from "../../../app/store";
import type {
	SquadoodleState,
	SquadoodleSecret,
	PlayerTask,
} from "@shared/games/squadoodle/index";
import type { Player, GameTimer } from "@shared/core/room";

export interface SquadoodleStateResult {
	game: SquadoodleState | null;
	secret: SquadoodleSecret | null;
	task: PlayerTask | null;
	playerId: string;
	role: "host" | "player" | null;
	players: Player[];
	timer: GameTimer | null;
	/** Resolve a player id to their display name. */
	getName: (id: string) => string;
}

export function useSquadoodleState(): SquadoodleStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const game = useGameStore((s) => s.gamePayload) as SquadoodleState | null;
	const secret = useGameStore((s) => s.secret) as SquadoodleSecret | null;

	const getName = (id: string) =>
		players.find((p) => p.id === id)?.name ?? id.slice(0, 6);

	return {
		game,
		secret,
		task: secret?.task ?? null,
		playerId,
		role,
		players,
		timer,
		getName,
	};
}
