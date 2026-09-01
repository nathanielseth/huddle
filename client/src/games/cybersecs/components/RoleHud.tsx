import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "../../../lib/utils/cn";
import { ROLE_META } from "../constants";
import type { CybsecsSecret } from "@shared/games/breachpoint/index";

interface RoleHudProps {
  secret: CybsecsSecret;
  getName: (id: string) => string;
}

export function RoleHud({ secret, getName }: RoleHudProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = ROLE_META[secret.role];
  const isAgent = meta.alignment === "agent";

  const hasKnowledge =
    secret.knownHackerIds.length > 0 ||
    !!secret.flaggedCandidateIds ||
    !!secret.knownEthicalHackerId;

  const pillCls = isAgent
    ? "bg-cyan-400/15 border-cyan-400/30 text-cyan-400"
    : "bg-red-400/15 border-red-400/30 text-red-400";

  const dotCls = isAgent ? "bg-cyan-400" : "bg-red-400";

  return (
    <div className="fixed top-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
      {/* knowledge panel */}
      <AnimatePresence>
        {expanded && hasKnowledge && (
          <m.div
            className={cn(
              "flex flex-col gap-2.5 px-3 py-2.5 rounded-xl border text-xs max-w-45 pointer-events-auto",
              pillCls,
            )}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {secret.knownHackerIds.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mb-0.5">
                  {secret.role === "sysadmin" ? "All Hackers" : "Your Ring"}
                </p>
                <p className="font-bold leading-snug">
                  {secret.knownHackerIds.map(getName).join(", ")}
                </p>
              </div>
            )}
            {secret.flaggedCandidateIds && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mb-0.5">
                  Suspects
                </p>
                <p className="font-bold leading-snug">
                  {[...secret.flaggedCandidateIds].map(getName).join(", ")}
                </p>
              </div>
            )}
            {secret.knownEthicalHackerId && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mb-0.5">
                  Ethical Hacker
                </p>
                <p className="font-bold">
                  {getName(secret.knownEthicalHackerId)}
                </p>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* role pill */}
      <button
        type="button"
        onClick={() => hasKnowledge && setExpanded((e) => !e)}
        className={cn(
          "flex items-center gap-1.5 pl-2 pr-3 h-8 rounded-full border text-xs font-bold transition-opacity pointer-events-auto",
          pillCls,
          hasKnowledge
            ? "cursor-pointer active:opacity-70"
            : "cursor-default",
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotCls)} />
        {meta.label}
        {hasKnowledge && (
          <span className="opacity-40 ml-0.5">{expanded ? "▲" : "▼"}</span>
        )}
      </button>
    </div>
  );
}