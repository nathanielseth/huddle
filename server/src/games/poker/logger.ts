export class PokerLogger {
	private readonly roomCode: string;

	constructor(roomCode: string) {
		this.roomCode = roomCode;
	}

	log(
		event: string,
		handNumber: number | null,
		payload: Record<string, unknown>,
	): void {
		console.log(
			JSON.stringify({
				ts: Date.now(),
				room: this.roomCode,
				event,
				hand: handNumber,
				...payload,
			}),
		);
	}
}
