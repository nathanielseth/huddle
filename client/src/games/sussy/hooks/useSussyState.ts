import { useGameStore } from "../../../store/useGameStore";
import type { SussyState, SussyPlayerSecret } from "@shared/sussy";
import type { Player, GameTimer } from "@shared/types";

export interface SussyStateResult {
	sussy: SussyState | null;
	secret: SussyPlayerSecret | null;
	/** Guards against stale-secret flash — only true when secret.taskNumber === sussy.taskNumber */
	secretReady: boolean;
	playerId: string;
	role: "host" | "player" | null;
	players: Player[];
	timer: GameTimer | null;
	myPlayer: SussyState["players"][string] | null;
	isImpostor: boolean;
	isGlitch: boolean;
	amChooser: boolean;
	/**
	 * The relevant prompt string for the current task + question index.
	 * null  → impostor on non-glitch task (show "blend in" screen)
	 * string → crew prompt, or glitch prompt[taskNumber-1]
	 */
	currentPrompt: string | null;
}

export function useSussyState(): SussyStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const sussy = useGameStore((s) => s.gamePayload) as SussyState | null;
	const secret = useGameStore((s) => s.secret) as SussyPlayerSecret | null;

	const myPlayer = sussy?.players[playerId] ?? null;
	const isImpostor = secret?.role === "impostor";
	const isGlitch = secret?.isGlitchRound ?? false;
	const amChooser = sussy?.chooserPlayerId === playerId;

	const secretReady =
		secret !== null && sussy !== null && secret.taskNumber === sussy.taskNumber;

	const currentPrompt = (() => {
		if (!secret?.prompt) return null;
		if (Array.isArray(secret.prompt)) {
			return secret.prompt[(sussy?.taskNumber ?? 1) - 1] ?? null;
		}
		return secret.prompt;
	})();

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
