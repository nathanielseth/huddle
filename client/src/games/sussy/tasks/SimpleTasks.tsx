import { useState } from "react";
import { motion } from "motion/react";
import { socket } from "../../../lib/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { cn } from "../../../utils/cn";

// ── Shared primitives ─────────────────────────────────────────────────────────

function ImpostorBg() {
	return <div className="absolute inset-0 bg-red-900/15 pointer-events-none" />;
}

function ImpostorHeader() {
	return (
		<div className="flex flex-col gap-1 px-5 pt-8 pb-4">
			<p className="text-xs font-bold tracking-[0.4em] uppercase text-red-400">
				Impostor
			</p>
			<h1 className="font-display text-2xl font-black uppercase text-white leading-tight">
				You Are the Impostor.
				<br />
				<span className="text-white/50 font-bold">Blend in.</span>
			</h1>
		</div>
	);
}

function SubmittedState({ label }: { label: string }) {
	return (
		<div className="flex items-center justify-center flex-1 gap-2 text-white/40 text-sm">
			✓ {label} — waiting for others
		</div>
	);
}

function ActionBtn({
	label,
	onClick,
	disabled,
}: {
	label: string;
	onClick: () => void;
	disabled: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"h-14 rounded-2xl text-sm font-bold tracking-wide transition-all",
				disabled
					? "bg-white/5 text-white/20 cursor-not-allowed"
					: "bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 active:scale-[0.97] cursor-pointer",
			)}
		>
			{label}
		</button>
	);
}

// ── Show of Hands ─────────────────────────────────────────────────────────────

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
								onClick={() => submit(true)}
								disabled={!!isDone}
							/>
							<ActionBtn
								label="✊ Hand Down"
								onClick={() => submit(false)}
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
						onClick={() => submit(true)}
						disabled={false}
					/>
					<ActionBtn
						label="✊ Keep Down"
						onClick={() => submit(false)}
						disabled={false}
					/>
				</div>
			)}
		</div>
	);
}

// ── Finger Pointing ───────────────────────────────────────────────────────────

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
							<motion.button
								key={p.id}
								type="button"
								onClick={() => submit(p.id)}
								className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-surface hover:bg-violet-500/10 hover:border-violet-500/30 active:scale-[0.98] transition-all cursor-pointer"
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: i * 0.04 }}
							>
								<span className="text-white/60 font-bold text-sm">👉</span>
								<span className="text-white font-semibold">{p.name}</span>
							</motion.button>
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

// ── Finger Blast ──────────────────────────────────────────────────────────────

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
			response: { type: "finger_blast", count },
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
					<SubmittedState label={`${selected ?? "??"}  fingers`} />
				) : (
					<div className="grid grid-cols-3 gap-3">
						{[0, 1, 2, 3, 4, 5].map((n) => (
							<button
								key={n}
								type="button"
								onClick={() => submit(n)}
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
