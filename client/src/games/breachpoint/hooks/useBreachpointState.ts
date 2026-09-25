import { useGameStore } from "../../../app/store";
import type {
	BreachpointState,
	BreachpointSecret,
} from "@shared/games/breachpoint/index";
import type { Player, GameTimer } from "@shared/core/room";

export interface BreachpointStateResult {
	game: BreachpointState | null;
	secret: BreachpointSecret | null;
	playerId: string;
	role: "host" | "player" | null;
	players: Player[];
	timer: GameTimer | null;
	myPlayer: BreachpointState["players"][string] | null;
	amLeader: boolean;
	amNominated: boolean;
	isObfuscator: boolean;
	canHack: boolean;
	getName: (id: string) => string;
}

export function useBreachpointState(): BreachpointStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const game = useGameStore((s) => s.gamePayload) as BreachpointState | null;
	const secret = useGameStore((s) => s.secret) as BreachpointSecret | null;

	const myPlayer = game?.players[playerId] ?? null;
	const amLeader = game
		? game.playerOrder[game.leaderIndex] === playerId
		: false;
	const amNominated = game?.nominatedTeam.includes(playerId) ?? false;
	const isObfuscator = secret?.role === "obfuscator";
	const canHack =
		secret?.alignment === "hacker" ||
		(secret?.role === "ethical_hacker" &&
			(secret?.ethicalHackerUsesLeft ?? 0) > 0);

	const getName = (id: string) =>
		players.find((p) => p.id === id)?.name ?? id.slice(0, 6);

	return {
		game,
		secret,
		playerId,
		role,
		players,
		timer,
		myPlayer,
		amLeader,
		amNominated,
		isObfuscator,
		canHack,
		getName,
	};
}