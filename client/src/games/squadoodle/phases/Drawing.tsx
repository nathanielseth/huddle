import { useSquadoodleState } from "../hooks/useSquadoodleState";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { ProgressPips } from "../components/ProgressPips";
import { TimerBar } from "../../sabong/components/TimerBar";
import { socket } from "../../../lib/network/socket";
import type { Stroke, SquadoodleState } from "@shared/games/squadoodle/index";
import type { GameTimer } from "@shared/core/room";

// Hoisted: closes over nothing — socket is a module-level singleton.
function handleSubmit(strokes: Stroke[]) {
	socket.emit("player_action", { type: "submit_drawing", strokes });
}

export function Drawing() {
	const { game, role, task, timer } = useSquadoodleState();
	if (!game) return null;

	return role === "host" ? (
		<HostView game={game} timer={timer} />
	) : (
		<PlayerView game={game} task={task} timer={timer} />
	);
}

// ─── Host ────────────────────────────────────────────────────────────────────

function HostView({
	game,
	timer,
}: {
	game: SquadoodleState;
	timer: GameTimer | null;
}) {
	const round = game.step + 1;
	return (
		<div className="flex flex-col min-h-screen items-center justify-center gap-8 px-12 py-10">
			<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Round {round} of {game.totalSteps}
			</span>
			<h1 className="font-display text-7xl font-black uppercase text-white text-center">
				Drawing
			</h1>
			<p className="text-white/40 text-center max-w-sm">
				Everyone is drawing on their phones. No peeking.
			</p>
			<ProgressPips submitted={game.submittedCount} total={game.totalCount} />
			<div className="w-full max-w-xs">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

// ─── Player ──────────────────────────────────────────────────────────────────

function PlayerView({
	game,
	task,
	timer,
}: {
	game: SquadoodleState;
	task: ReturnType<typeof useSquadoodleState>["task"];
	timer: GameTimer | null;
}) {
	const round = game.step + 1;

	if (task?.type === "wait") {
		return (
			<div className="flex flex-col h-dvh px-5 py-8 gap-6">
				<div className="flex flex-col gap-1">
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						Round {round}
					</p>
					<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
						Drawing
					</h1>
					<TimerBar timer={timer} />
				</div>
				<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
					<div className="w-16 h-16 rounded-full bg-indigo-400/15 border border-indigo-400/30 flex items-center justify-center text-2xl">
						✓
					</div>
					<p className="text-white/40 text-sm">
						Submitted! Waiting for others…
					</p>
				</div>
			</div>
		);
	}

	const prompt = task?.type === "draw" ? task.basedOn : "…";

	return (
		<div className="flex flex-col h-dvh px-4 py-5 gap-3">
			<div className="flex flex-col gap-1 shrink-0">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Round {round} · Draw
				</p>
				<TimerBar timer={timer} />
			</div>

			<div className="flex-1 min-h-0">
				<DrawingCanvas prompt={prompt} onSubmit={handleSubmit} />
			</div>
		</div>
	);
}