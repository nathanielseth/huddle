import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";

interface ObfuscatorToggleProps {
  armed: boolean;
  usesLeft: number;
}

export function ObfuscatorToggle({ armed, usesLeft }: ObfuscatorToggleProps) {
  if (usesLeft <= 0) return null;

  function toggle() {
    socket.emit("player_action", { type: "toggle_obfuscate", active: !armed });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer",
        armed
          ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
          : "bg-white/4 border-border text-white/40 hover:text-white/70 hover:bg-white/8",
      )}
    >
      <span className="text-base">{armed ? "🔒" : "🔓"}</span>
      <span className="flex-1 text-left">
        {armed ? "Obfuscate Armed" : "Arm Obfuscate"}
      </span>
      <span className="text-xs opacity-50">
        {usesLeft} use{usesLeft !== 1 ? "s" : ""} left
      </span>
    </button>
  );
}