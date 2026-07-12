import { cn } from "../../../lib/utils/cn";
import type { MissionResult } from "@shared/games/cybersecs";
import { MISSION_TEAM_SIZES } from "../constants";

interface MissionTrackProps {
  missionResults: readonly MissionResult[];
  missionIndex: number;
  playerCount: number;
  compact?: boolean;
  className?: string;
}

type SlotStatus = "secured" | "hacked" | "obfuscated" | "current" | "pending";

function slotStatus(
  missionResults: readonly MissionResult[],
  i: number,
  missionIndex: number,
): SlotStatus {
  const result = missionResults[i];
  if (!result) return i === missionIndex ? "current" : "pending";
  if (result.obfuscated) return "obfuscated";
  return result.secured ? "secured" : "hacked";
}

export function MissionTrack({
  missionResults,
  missionIndex,
  playerCount,
  compact = false,
  className,
}: MissionTrackProps) {
  const sizes = MISSION_TEAM_SIZES[playerCount] ?? MISSION_TEAM_SIZES[5];
  const hasDoubleHack = playerCount >= 7;

  return (
    <div className={cn("flex gap-2", className)}>
      {Array.from({ length: 5 }, (_, i) => {
        const status = slotStatus(missionResults, i, missionIndex);
        const needsDouble = hasDoubleHack && i === 3;

        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={cn(
                "w-full rounded-lg flex items-center justify-center font-display font-bold border transition-colors",
                compact ? "h-8 text-xs" : "h-11 text-sm",
                status === "secured" &&
                  "bg-green-500/15 border-green-500/40 text-green-400",
                status === "hacked" &&
                  "bg-red-500/15 border-red-500/40 text-red-400",
                status === "obfuscated" &&
                  "bg-amber-500/15 border-amber-500/40 text-amber-400",
                status === "current" &&
                  "bg-cyan-500/10 border-cyan-400/50 text-cyan-400",
                status === "pending" &&
                  "bg-white/4 border-border text-white/25",
              )}
            >
              {status === "secured" && "✓"}
              {status === "hacked" && "✗"}
              {status === "obfuscated" && "?"}
              {(status === "current" || status === "pending") && `M${i + 1}`}
            </div>
            {!compact && (
              <span className="text-[10px] text-white/30 tabular-nums leading-none">
                {sizes[i]}p{needsDouble ? " ·2✗" : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}