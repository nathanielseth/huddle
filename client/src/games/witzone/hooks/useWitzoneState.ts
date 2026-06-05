import { useCallback } from "react";
import { useGameStore } from "../../../app/store";
import { socket } from "../../../lib/network/socket";
import type {
	WitzoneState,
	WitzoneAction,
	WitzonePlayerSecret,
} from "@shared/witzone";
import type { Player, GameTimer } from "@shared/types";

export interface WitzoneStateResult {
	state: WitzoneState | null;
	playerId: string;
	role: "host" | "player" | null;
	players: Player[];
	timer: GameTimer | null;
	secret: WitzonePlayerSecret | null;
	getName: (id: string) => string;
	sendAction: (action: WitzoneAction) => void;
}

export function useWitzoneState(): WitzoneStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const state = useGameStore((s) => s.gamePayload) as WitzoneState | null;
	const secret = useGameStore((s) => s.secret) as WitzonePlayerSecret | null;

	// rebuilds only when the player roster changes
	const getName = useCallback(
		(id: string) => players.find((p) => p.id === id)?.name ?? id,
		[players],
	);

	// socket is a module-level singleton
	const sendAction = useCallback((action: WitzoneAction): void => {
		socket.emit("player_action", action);
	}, []);

	return { state, playerId, role, players, timer, secret, getName, sendAction };
}