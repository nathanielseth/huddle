import { useSussyState } from "../hooks/useSussyState";
import { getTaskMeta } from "../constants";
import { TimerBar } from "../../sabong/components/TimerBar";
import {
	ShowOfHandsTask,
	FingerPointingTask,
	FingerBlastTask,
} from "../components/SimpleTasks";
import { ThumbShotTask } from "../components/ThumbShot";
import { FaceTurnTask } from "../components/FaceTurnTask";
import { GlitchInTheChatTask } from "../components/GlitchInTheChatTask";
import type { TaskType } from "@shared/games/sussy/index";
import type { FC } from "react";

const TASK_COMPONENTS: Record<TaskType, FC> = {
	show_of_hands: ShowOfHandsTask,
	finger_pointing: FingerPointingTask,
	numbers_game: FingerBlastTask,
	thumb_shot: ThumbShotTask,
	face_turn: FaceTurnTask,
	glitch_in_the_chat: GlitchInTheChatTask,
};

export function TaskPerform() {
	const { sussy, role } = useSussyState();
	if (!sussy) return null;
	if (role === "host") return <HostTaskView />;
	const Task = TASK_COMPONENTS[sussy.taskType];
	// GlitchInTheChatTask remounts per question via key — no useEffect setState needed
	const taskKey =
		sussy.taskType === "glitch_in_the_chat" ? sussy.taskNumber : undefined;
	return <Task key={taskKey} />;
}

function HostTaskView() {
	const { sussy, players, timer } = useSussyState();
	if (!sussy) return null;

	const meta = getTaskMeta(sussy.taskType);
	const responded = Object.values(sussy.players).filter(
		(p) => p.hasResponded,
	).length;
	const total = players.length;
	const isHangout = sussy.mode === "hangout";

	return (
		<div className="flex flex-col min-h-screen px-8 py-10 gap-8">
			<div className="flex flex-col gap-2">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Round {sussy.roundNumber} · Task {sussy.taskNumber} of 3
				</p>
				<div className="flex items-center gap-3">
					<span className="text-4xl">{meta.icon}</span>
					<h1 className="font-display text-5xl font-black uppercase text-white leading-none">
						{meta.label}
					</h1>
				</div>
				<TimerBar timer={timer} />
			</div>

			{isHangout ? (
				<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
					<p className="text-white/40 text-sm">
						Players are performing the action…
					</p>
					<p className="text-xs text-white/20 tracking-widest uppercase">
						Voting opens shortly
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-4">
					<div className="flex items-end justify-between">
						<p className="text-xs font-bold tracking-widest uppercase text-white/30">
							Responded
						</p>
						<span className="font-display text-4xl font-black text-white tabular-nums">
							{responded}
							<span className="text-white/30">/{total}</span>
						</span>
					</div>
					<div className="flex flex-wrap gap-2">
						{players.map((p) => {
							const sp = sussy.players[p.id];
							return (
								<div
									key={p.id}
									className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-300 ${
										sp?.hasResponded
											? "border-violet-500/40 bg-violet-500/10 text-violet-300"
											: "border-border bg-white/3 text-white/30"
									}`}
								>
									<span
										className={`w-1.5 h-1.5 rounded-full shrink-0 ${
											sp?.hasResponded ? "bg-violet-400" : "bg-white/20"
										}`}
									/>
									{p.name}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
