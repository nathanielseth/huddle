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
	packId: string;
	name: string;
	thumbnail: string;
	placeholderColor: string;
	description: string;
	tags: string[];
	playerCount: [number, number];
	duration: number;
	comingSoon?: boolean;
	beta?: boolean;
	supportsCpuSeats?: boolean;
}

export interface Pack {
	id: string;
	number: number;
	name: string;
	tagline: string;
	accentColor: string;
}