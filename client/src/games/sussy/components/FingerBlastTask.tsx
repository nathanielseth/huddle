import { useState } from "react";
import { socket } from "../../../lib/network/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { cn } from "../../../lib/utils/cn";
import { ImpostorBg, ImpostorHeader, SubmittedState } from "./_primitives";

export function FingerBlastTask() {
	const { sussy, myPlayer, isImpostor, currentPrompt, timer } = useSussyState();
	const [selected, setSelected] = useState<number | null>(null);
	const [submitted, setSubmitted] = useState(false);
	if (!sussy) return null;

	const isHangout = sussy.mode === "hangout";
	const isDone = submitted || myPlayer?.hasResponded;

	function submit(count: number) {
		if (isDone) return;
		setSelected(count);
		socket.emit("player_action", {
			type: "submit_response",
			response: { type: "numbers_game", count },
		});
		setSubmitted(true);
	}

	if (isHangout) {
		return (
			<div className="flex flex-col min-h-screen px-5 py-10 gap-8">
				<div>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-3">
						Finger Blast
					</p>
					<TimerBar timer={timer} />
				</div>
				{isImpostor ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-60 text-center">
						<span className="text-5xl">🖐️</span>
						<p className="text-white/40 text-sm">
							Hold up a number that makes sense
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
							Pick a number — look convincing
						</p>
					</>
				) : (
					<div>
						<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
							Finger Blast
						</p>
						<p className="text-xl font-bold text-white leading-snug mb-3">
							{currentPrompt}
						</p>
						<TimerBar timer={timer} />
					</div>
				)}

				{isDone ? (
					<SubmittedState label={`${selected ?? "??"} fingers`} />
				) : (
					<div className="grid grid-cols-3 gap-3">
						{[0, 1, 2, 3, 4, 5].map((n) => (
							<button
								key={n}
								type="button"
								onClick={() => {
									submit(n);
								}}
								className={cn(
									"h-20 rounded-2xl text-3xl font-black transition-all cursor-pointer",
									selected === n
										? "bg-violet-500 text-white scale-95"
										: "bg-surface border border-border text-white hover:bg-violet-500/20 hover:border-violet-500/40 active:scale-[0.96]",
								)}
							>
								{n}
							</button>
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