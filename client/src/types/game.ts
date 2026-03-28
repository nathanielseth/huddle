export type GameTag =
	| "deception"
	| "trivia"
	| "drawing"
	| "writing"
	| "social"
	| "strategy"
	| "betting";

export interface Game {
	id: string;
	name: string;
	thumbnail?: string;
	placeholderColor: string;
	description: string;
	tags: GameTag[];
	playerCount: [number, number];
	duration: number;
}
