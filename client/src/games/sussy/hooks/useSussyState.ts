import { useGameStore } from "../../../app/store";
import type { SussyState, SussyPlayerSecret } from "@shared/games/sussy/index";
import type { Player, GameTimer } from "@shared/core/room";

export interface SussyStateResult {
	sussy: SussyState | null;
	secret: SussyPlayerSecret | null;
	secretReady: boolean;
	playerId: string;
	role: "host" | "player" | null;
	players: Player[];
	timer: GameTimer | null;
	myPlayer: SussyState["players"][string] | null;
	isImpostor: boolean;
	isGlitch: boolean;
	amChooser: boolean;
	currentPrompt: string | null;
}

function castSussy(payload: unknown): SussyState | null {
	return (payload ?? null) as SussyState | null;
}

function castSecret(secret: unknown): SussyPlayerSecret | null {
	return (secret ?? null) as SussyPlayerSecret | null;
}

function pickPrompt(
	prompt: string | readonly [string, string, string] | null | undefined,
	taskNumber: number,
): string | null {
	if (prompt == null) return null;
	if (typeof prompt === "string") return prompt;

	const index = taskNumber - 1;
	return prompt[index] ?? null;
}

export function useSussyState(): SussyStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const sussy = useGameStore((s) => castSussy(s.gamePayload));
	const secret = useGameStore((s) => castSecret(s.secret));

	const myPlayer = sussy?.players[playerId] ?? null;
	const isImpostor = secret?.role === "impostor";
	const isGlitch = secret?.isGlitchRound ?? false;
	const amChooser = sussy?.chooserPlayerId === playerId;
	const secretReady =
		secret !== null && sussy !== null && secret.taskNumber === sussy.taskNumber;
	const currentPrompt = pickPrompt(secret?.prompt, sussy?.taskNumber ?? 1);

	return {
		sussy,
		secret,
		secretReady,
		playerId,
		role,
		players,
		timer,
		myPlayer,
		isImpostor,
		isGlitch,
		amChooser,
		currentPrompt,
	};
}