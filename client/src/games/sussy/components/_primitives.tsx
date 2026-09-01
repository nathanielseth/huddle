// Private primitives shared across the three SimpleTasks screens.
// Not part of the public export surface — import from the individual task files.

import { cn } from "../../../lib/utils/cn";

export function ImpostorBg() {
	return <div className="absolute inset-0 bg-red-900/15 pointer-events-none" />;
}

export function ImpostorHeader() {
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

export function SubmittedState({ label }: { label: string }) {
	return (
		<div className="flex items-center justify-center flex-1 gap-2 text-white/40 text-sm">
			✓ {label} — waiting for others
		</div>
	);
}

export function ActionBtn({
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