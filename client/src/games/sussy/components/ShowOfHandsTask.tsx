import { useState } from "react";
import { socket } from "../../../lib/network/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";
import {
	ImpostorBg,
	ImpostorHeader,
	SubmittedState,
	ActionBtn,
} from "./_primitives";

export function ShowOfHandsTask() {
	const { sussy, myPlayer, isImpostor, currentPrompt, timer } = useSussyState();
	const [submitted, setSubmitted] = useState(false);
	if (!sussy) return null;

	const isHangout = sussy.mode === "hangout";
	const isDone = submitted || myPlayer?.hasResponded;

	function submit(raised: boolean) {
		if (isDone) return;
		socket.emit("player_action", {
			type: "submit_response",
			response: { type: "show_of_hands", raised },
		});
		setSubmitted(true);
	}

	if (isHangout) {
		return (
			<div className="flex flex-col min-h-screen px-5 py-10 gap-8">
				<div>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-3">
						Show of Hands
					</p>
					<TimerBar timer={timer} />
				</div>
				{isImpostor ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-60 text-center">
						<span className="text-5xl">✋</span>
						<p className="text-white/40 text-sm">Watch and blend in</p>
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

	if (isImpostor) {
		return (
			<div className="flex flex-col min-h-screen relative">
				<ImpostorBg />
				<div className="relative flex flex-col min-h-screen">
					<ImpostorHeader />
					<div className="flex-1 flex flex-col justify-end px-5 pb-8 gap-4">
						<p className="text-xs text-white/30 text-center">
							Pick one — make it convincing
						</p>
						<div className="grid grid-cols-2 gap-3">
							<ActionBtn
								label="✋ Hand Up"
								onClick={() => { submit(true); }}
								disabled={!!isDone}
							/>
							<ActionBtn
								label="✊ Hand Down"
								onClick={() => { submit(false); }}
								disabled={!!isDone}
							/>
						</div>
						<TimerBar timer={timer} />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div>
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
					Show of Hands
				</p>
				<TimerBar timer={timer} />
			</div>
			<div className="flex-1 flex items-center justify-center">
				<p className="text-2xl font-bold text-white text-center leading-snug">
					{currentPrompt}
				</p>
			</div>
			{isDone ? (
				<SubmittedState label="Submitted" />
			) : (
				<div className="grid grid-cols-2 gap-3 pb-4">
					<ActionBtn
						label="✋ Raise Hand"
						onClick={() => { submit(true); }}
						disabled={false}
					/>
					<ActionBtn
						label="✊ Keep Down"
						onClick={() => { submit(false); }}
						disabled={false}
					/>
				</div>
			)}
		</div>
	);
}