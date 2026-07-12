import { useGameStore } from "../../../app/store";
import type { CybsecsState, CybsecsSecret } from "@shared/games/cybersecs";
import type { Player, GameTimer } from "@shared/core/room";

export interface CybsecsStateResult {
  game: CybsecsState | null;
  secret: CybsecsSecret | null;
  playerId: string;
  role: "host" | "player" | null;
  players: Player[];
  timer: GameTimer | null;
  myPlayer: CybsecsState["players"][string] | null;
  amLeader: boolean;
  amNominated: boolean;
  isObfuscator: boolean;
  canHack: boolean;
  getName: (id: string) => string;
}

export function useCybsecsState(): CybsecsStateResult {
  const playerId = useGameStore((s) => s.playerId);
  const role = useGameStore((s) => s.role);
  const players = useGameStore((s) => s.players);
  const timer = useGameStore((s) => s.timer);
  const game = useGameStore((s) => s.gamePayload) as CybsecsState | null;
  const secret = useGameStore((s) => s.secret) as CybsecsSecret | null;

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