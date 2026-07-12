import { m } from "motion/react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { MissionTrack } from "../components/MissionTrack";
import { ROLE_META, WIN_REASON_TEXT } from "../constants";
import { cn } from "../../../lib/utils/cn";

export function GameOver() {
  const { game, playerId, getName } = useCybsecsState();
  if (!game?.winner) return null;

  const isAgentWin = game.winner === "agent";
  const winReason = game.winReason ? WIN_REASON_TEXT[game.winReason] : "";

  return (
    <div className="flex flex-col min-h-screen px-5 py-8 gap-6 overflow-y-auto">
      {/* winner banner */}
      <m.div
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border p-8 text-center",
          isAgentWin
            ? "bg-cyan-400/10 border-cyan-400/30"
            : "bg-red-400/10 border-red-400/30",
        )}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <span
          className={cn(
            "text-xs font-bold tracking-[0.3em] uppercase opacity-60",
            isAgentWin ? "text-cyan-400" : "text-red-400",
          )}
        >
          Game Over
        </span>
        <p
          className={cn(
            "font-display text-6xl font-black uppercase leading-none",
            isAgentWin ? "text-cyan-400" : "text-red-400",
          )}
        >
          {isAgentWin ? "Agents Win" : "Hackers Win"}
        </p>
        <p className="text-white/40 text-sm mt-1">{winReason}</p>
      </m.div>

      {/* mission summary */}
      <MissionTrack
        missionResults={game.missionResults}
        missionIndex={game.missionIndex}
        playerCount={game.playerOrder.length}
      />

      {/* final roles */}
      {game.finalRoles && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">
            Final Roles
          </p>
          <div className="flex flex-col gap-2">
            {game.playerOrder.map((id, i) => {
              const roleKey = game.finalRoles![id];
              if (!roleKey) return null;
              const meta = ROLE_META[roleKey];
              const isAgent = meta.alignment === "agent";
              const isMe = id === playerId;

              return (
                <m.div
                  key={id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border",
                    isAgent
                      ? "bg-cyan-400/8 border-cyan-400/15"
                      : "bg-red-400/8 border-red-400/15",
                  )}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                >
                  <span className="flex-1 font-semibold text-sm text-white">
                    {getName(id)}
                    {isMe && (
                      <span className="ml-2 text-xs text-white/30">(you)</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wide",
                      isAgent ? "text-cyan-400" : "text-red-400",
                    )}
                  >
                    {meta.label}
                  </span>
                </m.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}