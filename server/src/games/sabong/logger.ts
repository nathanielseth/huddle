export type SabongLogEventType =
	| "game_start"
	| "phase_transition"
	| "player_action"
	| "sabotage_applied"
	| "odds_computed"
	| "fight_result"
	| "payout_calculated"
	| "timer_expired"
	| "tournament_complete"
	| "ayuda_granted";

export interface SabongLogEvent {
	timestamp: number;
	type: SabongLogEventType;
	matchIndex: number | null;
	payload: Record<string, unknown>;
}

export class SabongLogger {
	private readonly logs: SabongLogEvent[] = [];
	private readonly roomCode: string;

	constructor(roomCode: string) {
		this.roomCode = roomCode;
	}

	log(
		type: SabongLogEventType,
		matchIndex: number | null,
		payload: Record<string, unknown>,
	): void {
		const event: SabongLogEvent = {
			timestamp: Date.now(),
			type,
			matchIndex,
			payload,
		};
		this.logs.push(event);
		console.log(
			`[sabong:${this.roomCode}:${type}]`,
			JSON.stringify(payload, (_k, v) =>
				v instanceof Set
					? [...v]
					: v instanceof Map
						? Object.fromEntries(v)
						: v,
			),
		);
	}

	getAll(): SabongLogEvent[] {
		return [...this.logs];
	}
}
