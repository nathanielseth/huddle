import { useGameStore } from "../../app/store";
import type { FaceturnsConfigPayload } from "@shared/games/face-turn/types";

const DEFAULT: FaceturnsConfigPayload = { mode: "duel", teamChoices: {} };

const MODE_LABEL: Record<FaceturnsConfigPayload["mode"], string> = {
	duel: "Duel",
	ffa: "Battle Royal",
	teams: "Tag Team",
};

export function FaceTurnConfig() {
	const playerId = useGameStore((s) => s.playerId);
	const rawConfig = useGameStore((s) => s.configPayload);
	const updateConfig = useGameStore((s) => s.updateConfig);
	const role = useGameStore((s) => s.role);

	const config = (rawConfig as FaceturnsConfigPayload | null) ?? DEFAULT;
	const isHost = role === "host";

	function setMode(mode: "duel" | "ffa" | "teams") {
		updateConfig({ kind: "set_mode", mode });
	}
	function setTeam(team: "A" | "B") {
		updateConfig({ kind: "set_team", team });
	}

	if (!isHost && config.mode !== "teams") {
		return null;
	}

	return (
		<div className="flex flex-col items-center gap-3">
			{isHost && (
				<div className="flex flex-col items-center gap-2">
					<p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/30">
						Match Mode
					</p>
					<div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-border">
						{(["duel", "ffa", "teams"] as const).map((m) => {
							const active = config.mode === m;
							return (
								<button
									key={m}
									type="button"
									onClick={() => {
										setMode(m);
									}}
									aria-pressed={active}
									className={`px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer ${
										active
											? "bg-huddle text-white"
											: "text-white/50 hover:text-white/80 hover:bg-white/5"
									}`}
								>
									{MODE_LABEL[m]}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{config.mode === "teams" && (
				<div className="flex flex-col items-center gap-2">
					<p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/30">
						Pick a Team
					</p>
					<div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-border">
						{(["A", "B"] as const).map((team) => {
							const active = config.teamChoices[playerId] === team;
							return (
								<button
									key={team}
									type="button"
									onClick={() => {
										setTeam(team);
									}}
									aria-pressed={active}
									className={`px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer ${
										active
											? team === "A"
												? "bg-red-corner text-white"
												: "bg-blue-corner text-white"
											: "text-white/50 hover:text-white/80 hover:bg-white/5"
									}`}
								>
									Team {team}
									{active && " ✓"}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}