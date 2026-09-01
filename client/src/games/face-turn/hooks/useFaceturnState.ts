import { useGameStore } from "../../../app/store";
import type {
	FaceturnsState,
	FaceturnsSecret,
	FaceturnsPlayerView,
	PendingInteractionView,
} from "@shared/games/face-turn/types";
import type { GameTimer } from "@shared/core/room";

// usually actorId, but some interactions use a different chooser
export function getInteractionResponder(pi: PendingInteractionView): string {
	if (pi.type === "choose_crew_to_turn") return pi.chooserPlayerId;
	if (pi.type === "truth_serum_reveal") return pi.targetPlayerId;
	return pi.actorId;
}

export interface FaceturnStateResult {
	ft: FaceturnsState | null;
	secret: FaceturnsSecret | null;
	playerId: string;
	myPlayer: FaceturnsPlayerView | null;
	isMyTurn: boolean;
	canChallenge: boolean;
	isChainParticipant: boolean;
	isChainResponder: boolean;
	isChainTurnPlayer: boolean;
	pendingInteraction: PendingInteractionView | null;
	players: { id: string; name: string; score: number }[];
	// bossId/bossName undefined pre-draft or when ft is null
	playerMap: Record<
		string,
		{
			id: string;
			name: string;
			score: number;
			bossId?: string;
			bossName?: string;
		}
	>;
	timer: GameTimer | null;
}

export function useFaceturnState(): FaceturnStateResult {
	const gamePayload = useGameStore((s) => s.gamePayload);
	const secretPayload = useGameStore((s) => s.secret);
	const playerId = useGameStore((s) => s.playerId);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);

	const ft = gamePayload as FaceturnsState | null;
	const secret = secretPayload as FaceturnsSecret | null;

	const myPlayer = ft?.players[playerId] ?? null;
	const isMyTurn = Boolean(
		ft && ft.phase === "active_turn" && ft.turn?.activePlayerId === playerId,
	);
	const canChallenge =
		ft?.challengeEligiblePlayerIds.includes(playerId) ?? false;

	const isChainParticipant =
		ft?.moveChain?.participants.includes(playerId) ?? false;
	// holds priority right now — only relevant for pushing/passing slow moves
	const isChainResponder = ft?.moveChain?.responderId === playerId;
	// started the chain (turn player) — only relevant for playing burst
	// moves. Not gated on phase since ft.turn persists through the chain
	// window; the actual legality check lives server-side either way, this
	// is only used for display copy.
	const isChainTurnPlayer = ft?.turn?.activePlayerId === playerId;

	const pendingInteraction = ft?.pendingInteraction ?? null;

	const playerMap = Object.fromEntries(
		players.map((p) => [
			p.id,
			{
				...p,
				bossId: ft?.players[p.id]?.boss.id,
				bossName: ft?.players[p.id]?.boss.name,
			},
		]),
	);

	return {
		ft,
		secret,
		playerId,
		myPlayer,
		isMyTurn,
		canChallenge,
		isChainParticipant,
		isChainResponder,
		isChainTurnPlayer,
		pendingInteraction,
		players,
		playerMap,
		timer,
	};
}