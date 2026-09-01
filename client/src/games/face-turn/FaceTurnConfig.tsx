import { useGameStore } from "../../app/store";
import type { FaceturnsConfigPayload } from "@shared/games/face-turn/types";

const DEFAULT: FaceturnsConfigPayload = { mode: "duel", teamChoices: {} };

export function FaceTurnConfig() {
	const players = useGameStore((s) => s.players);
	const playerId = useGameStore((s) => s.playerId);
	const rawConfig = useGameStore((s) => s.configPayload);
	const updateConfig = useGameStore((s) => s.updateConfig);
	const role = useGameStore((s) => s.role);

	const config = (rawConfig as FaceturnsConfigPayload | null) ?? DEFAULT;
	const connectedCount = players.filter((p) => p.isConnected).length;
	const isHost = role === "host";
	const locked = connectedCount === 2; // auto-duel, picker hidden entirely

	function setMode(mode: "duel" | "ffa" | "teams") {
		updateConfig({ kind: "set_mode", mode });
	}
	function setTeam(team: "A" | "B") {
		updateConfig({ kind: "set_team", team });
	}

	if (locked) {
		return null;
	}

	return (
		<div className="flex flex-col items-center gap-4">
			{isHost && (
				<div className="flex gap-2">
					{(["ffa", "teams"] as const).map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => {
								setMode(m);
							}}
							disabled={config.mode === m}
							className="px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest"
						>
							{m === "ffa" ? "Battle Royal" : "Tag Team"}
						</button>
					))}
				</div>
			)}

			{config.mode === "teams" && (
				<div className="flex gap-2">
					{(["A", "B"] as const).map((team) => (
						<button
							key={team}
							type="button"
							onClick={() => {
								setTeam(team);
							}}
							className="px-4 h-9 rounded-lg text-xs font-semibold uppercase tracking-widest"
						>
							Join Team {team}
							{config.teamChoices[playerId] === team && " ✓"}
						</button>
					))}
				</div>
			)}
		</div>
	);
}