import { m } from "motion/react";
import { useSussyState } from "../hooks/useSussyState";
import { getTaskMeta } from "../constants";
import { TimerBar } from "../../sabong/components/TimerBar";

export function RoleReveal() {
	const { sussy, role, secret, secretReady, isImpostor, isGlitch, timer } =
		useSussyState();
	if (!sussy) return null;

	const meta = getTaskMeta(sussy.taskType);

	if (role === "host") {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8 text-center">
				<span className="text-6xl">{meta.icon}</span>
				<h1 className="font-display text-5xl font-black uppercase text-white">
					{meta.label}
				</h1>
				<p className="text-white/40 text-sm tracking-wide">
					Players are reading their roles…
				</p>
				<div className="w-full max-w-xs mt-4">
					<TimerBar timer={timer} />
				</div>
			</div>
		);
	}

	if (!secretReady) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg">
				<div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-violet-400 animate-spin" />
			</div>
		);
	}

	if (isImpostor) return <ImpostorReveal meta={meta} timer={timer} />;
	if (isGlitch)
		return <GlitchReveal secret={secret} meta={meta} timer={timer} />;
	return <CrewReveal meta={meta} timer={timer} />;
}

function ImpostorReveal({
	meta,
	timer,
}: {
	meta: ReturnType<typeof getTaskMeta>;
	timer: ReturnType<typeof useSussyState>["timer"];
}) {
	return (
		<div className="relative flex flex-col items-center justify-center min-h-screen px-8 gap-8 text-center">
			<m.div
				className="absolute inset-0 bg-red-900/20"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.6 }}
			/>
			<div className="relative flex flex-col items-center gap-6">
				<m.span
					className="text-7xl"
					initial={{ scale: 0.5, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{
						type: "spring",
						stiffness: 300,
						damping: 20,
						delay: 0.1,
					}}
				>
					🫵
				</m.span>
				<m.div
					className="flex flex-col gap-3"
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.25, duration: 0.3 }}
				>
					<p className="text-xs font-bold tracking-[0.4em] uppercase text-red-400">
						{meta.label}
					</p>
					<h1 className="font-display text-5xl font-black uppercase text-white leading-none">
						You Are the
						<br />
						<span className="text-red-400">Impostor</span>
					</h1>
					<p className="text-white/60 text-base mt-2">
						Watch. Blend in. Don't get caught.
					</p>
				</m.div>
				<m.div
					className="w-full max-w-xs"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.5 }}
				>
					<TimerBar timer={timer} />
				</m.div>
			</div>
		</div>
	);
}

function CrewReveal({
	meta,
	timer,
}: {
	meta: ReturnType<typeof getTaskMeta>;
	timer: ReturnType<typeof useSussyState>["timer"];
}) {
	const { currentPrompt } = useSussyState();
	return (
		<div className="flex flex-col justify-center min-h-screen px-6 gap-8">
			<m.div
				className="flex flex-col gap-3"
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25 }}
			>
				<div className="flex items-center gap-2">
					<span className="text-2xl">{meta.icon}</span>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400">
						{meta.label}
					</p>
				</div>
				<p className="text-[11px] font-bold tracking-widest uppercase text-white/30">
					Your prompt
				</p>
			</m.div>
			<m.div
				className="px-6 py-8 rounded-3xl border border-violet-500/30 bg-violet-500/8"
				initial={{ opacity: 0, scale: 0.96 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ delay: 0.12, duration: 0.25 }}
			>
				<p className="text-2xl font-bold text-white leading-snug">
					{currentPrompt}
				</p>
			</m.div>
			<m.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.3 }}
			>
				<TimerBar timer={timer} />
			</m.div>
		</div>
	);
}

function GlitchReveal({
	secret,
	meta,
	timer,
}: {
	secret: ReturnType<typeof useSussyState>["secret"];
	meta: ReturnType<typeof getTaskMeta>;
	timer: ReturnType<typeof useSussyState>["timer"];
}) {
	const prompts = Array.isArray(secret?.prompt) ? secret.prompt : [];
	return (
		<div className="flex flex-col justify-center min-h-screen px-6 gap-6">
			<m.div
				className="flex flex-col gap-2"
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25 }}
			>
				<div className="flex items-center gap-2">
					<span className="text-2xl">{meta.icon}</span>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-amber-400">
						Round 4 · {meta.label}
					</p>
				</div>
				<p className="text-[11px] font-bold tracking-widest uppercase text-white/30">
					Your questions — answer one at a time
				</p>
			</m.div>
			<div className="flex flex-col gap-3">
				{prompts.map((q, i) => (
					<m.div
						key={`${i}-${q}`}
						className="flex gap-4 px-5 py-4 rounded-2xl border border-border bg-surface"
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.1 + i * 0.08, duration: 0.2 }}
					>
						<span className="text-xs font-bold text-white/30 shrink-0 mt-0.5">
							Q{i + 1}
						</span>
						<p className="text-sm text-white/80 leading-snug">{q}</p>
					</m.div>
				))}
			</div>
			<m.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.4 }}
			>
				<TimerBar timer={timer} />
			</m.div>
		</div>
	);
}