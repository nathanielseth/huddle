import { useState } from "react";
import { m } from "motion/react";
import { socket } from "../../../lib/network/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { REACTION_EMOJIS } from "../constants";
import { cn } from "../../../lib/utils/cn";

export function FaceTurnTask() {
	const { sussy, myPlayer, isImpostor, currentPrompt, timer } = useSussyState();
	const [selected, setSelected] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	if (!sussy) return null;

	const isHangout = sussy.mode === "hangout";
	const isDone = submitted || myPlayer?.hasResponded;

	function submit(emoji: string | null) {
		if (isDone) return;
		setSelected(emoji);
		socket.emit("player_action", {
			type: "submit_response",
			response: { type: "face_turn", emoji },
		});
		setSubmitted(true);
	}

	if (isHangout) {
		return (
			<div className="flex flex-col min-h-screen px-5 py-10 gap-8">
				<div>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-3">
						Face Turn
					</p>
					<TimerBar timer={timer} />
				</div>
				{isImpostor ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-4 text-center relative">
						<div className="absolute inset-0 bg-red-900/15 pointer-events-none rounded-2xl" />
						<p className="text-xs font-bold tracking-[0.4em] uppercase text-red-400">
							Impostor
						</p>
						<span className="text-6xl">😶</span>
						<p className="text-xl font-bold text-white">
							Make a convincing face.
						</p>
						<p className="text-white/40 text-sm">
							Watch the group — mirror what makes sense.
						</p>
					</div>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-2xl font-bold text-white text-center leading-snug px-2">
							{currentPrompt}
						</p>
					</div>
				)}
			</div>
		);
	}

	if (isDone) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8 text-center">
				<span className="text-7xl">{selected ?? "😶"}</span>
				<p className="text-white/40 text-sm">Locked in — waiting for others</p>
			</div>
		);
	}

	if (isImpostor) {
		return (
			<div className="flex flex-col min-h-screen relative">
				<div className="absolute inset-0 bg-red-900/15 pointer-events-none" />
				<div className="relative flex flex-col min-h-screen px-5 py-8 gap-6">
					<div className="flex flex-col gap-1">
						<p className="text-xs font-bold tracking-[0.4em] uppercase text-red-400">
							Impostor
						</p>
						<h2 className="font-display text-2xl font-black uppercase text-white leading-tight">
							Pick any reaction.
							<br />
							<span className="text-white/50 font-bold">
								Make it convincing.
							</span>
						</h2>
						<TimerBar timer={timer} />
					</div>
					<EmojiGrid onSelect={submit} selected={selected} />
					<SkipBtn
						onClick={() => {
							submit(null);
						}}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div>
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
					Face Turn
				</p>
				<p className="text-lg font-bold text-white leading-snug mb-3">
					{currentPrompt}
				</p>
				<TimerBar timer={timer} />
			</div>
			<p className="text-xs text-white/30 text-center">
				Pick the emoji that fits your reaction
			</p>
			<EmojiGrid onSelect={submit} selected={selected} />
			<SkipBtn
				onClick={() => {
					submit(null);
				}}
			/>
		</div>
	);
}

function EmojiGrid({
	onSelect,
	selected,
}: {
	onSelect: (emoji: string) => void;
	selected: string | null;
}) {
	return (
		<div className="grid grid-cols-6 gap-2">
			{REACTION_EMOJIS.map((emoji: string, i: number) => (
				<m.button
					key={emoji}
					type="button"
					onClick={() => {
						onSelect(emoji);
					}}
					className={cn(
						"h-12 rounded-xl text-2xl transition-all cursor-pointer",
						selected === emoji
							? "bg-violet-500/40 scale-110 ring-1 ring-violet-400"
							: "bg-surface hover:bg-white/8 active:scale-[0.94]",
					)}
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: i * 0.01, duration: 0.15 }}
				>
					{emoji}
				</m.button>
			))}
		</div>
	);
}

function SkipBtn({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-xs text-white/20 hover:text-white/40 transition-colors cursor-pointer"
		>
			No reaction
		</button>
	);
}