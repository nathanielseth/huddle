import { useState } from "react";
import { m } from "motion/react";
import { socket } from "../../../lib/network/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { cn } from "../../../lib/utils/cn";
import { ImpostorBg, ImpostorHeader, SubmittedState } from "./_primitives";

export function FingerPointingTask() {
	const {
		sussy,
		players,
		playerId,
		myPlayer,
		isImpostor,
		currentPrompt,
		timer,
	} = useSussyState();
	const [submitted, setSubmitted] = useState(false);
	if (!sussy) return null;

	const isHangout = sussy.mode === "hangout";
	const isDone = submitted || myPlayer?.hasResponded;
	const targets = players.filter((p) => p.id !== playerId);

	function submit(targetId: string) {
		if (isDone) return;
		socket.emit("player_action", {
			type: "submit_response",
			response: { type: "finger_pointing", targetId },
		});
		setSubmitted(true);
	}

	if (isHangout) {
		return (
			<div className="flex flex-col min-h-screen px-5 py-10 gap-8">
				<div>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-3">
						Finger Pointing
					</p>
					<TimerBar timer={timer} />
				</div>
				{isImpostor ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-60 text-center">
						<span className="text-5xl">👉</span>
						<p className="text-white/40 text-sm">
							Watch and point with the group
						</p>
					</div>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-2xl font-bold text-white text-center leading-snug">
							{currentPrompt}
						</p>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col min-h-screen", isImpostor && "relative")}>
			{isImpostor && <ImpostorBg />}
			<div className="relative flex flex-col min-h-screen px-5 py-8 gap-6">
				{isImpostor ? (
					<>
						<ImpostorHeader />
						<p className="text-xs text-white/30 text-center">
							Point at someone — make it look natural
						</p>
					</>
				) : (
					<div>
						<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
							Finger Pointing
						</p>
						<p className="text-xl font-bold text-white leading-snug mb-3">
							{currentPrompt}
						</p>
						<TimerBar timer={timer} />
					</div>
				)}

				{isDone ? (
					<SubmittedState label="Pointed" />
				) : (
					<div className="flex flex-col gap-2">
						{targets.map((p, i) => (
							<m.button
								key={p.id}
								type="button"
								onClick={() => { submit(p.id); }}
								className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-surface hover:bg-violet-500/10 hover:border-violet-500/30 active:scale-[0.98] transition-all cursor-pointer"
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: i * 0.04 }}
							>
								<span className="text-white/60 font-bold text-sm">👉</span>
								<span className="text-white font-semibold">{p.name}</span>
							</m.button>
						))}
					</div>
				)}

				{isImpostor && (
					<div className="mt-auto">
						<TimerBar timer={timer} />
					</div>
				)}
			</div>
		</div>
	);
}