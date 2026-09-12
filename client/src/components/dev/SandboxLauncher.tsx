const SANDBOXES: { path: string; label: string }[] = [
	{ path: "/sandbox/draft", label: "Draft / deckbuild" },
	{ path: "/sandbox/card", label: "Card" },
	{ path: "/sandbox/hand", label: "Hand" },
	{ path: "/sandbox/shell", label: "Shell" },
	{ path: "/sandbox/move-chain", label: "Move chain" },
	{ path: "/sandbox/phase-scene", label: "Phase scene" },
	{ path: "/sandbox/host-board", label: "Host board" },
	{ path: "/sandbox/rps", label: "Rock Paper Scissors" },
	{ path: "/sandbox/sim", label: "Sim / metas" },
];

export function SandboxLauncher() {
	if (!import.meta.env.DEV) return null;

	return (
		<details className="fixed bottom-3 right-3 z-9999 group">
			<summary
				className="list-none select-none cursor-pointer w-9 h-9 flex items-center justify-center rounded-full bg-black/70 border border-white/15 text-white/50 hover:text-white hover:border-white/30 text-xs font-black transition-colors"
				title="Dev sandboxes"
			>
				⚙
			</summary>
			<div className="absolute bottom-11 right-0 w-52 rounded-lg border border-white/15 bg-[#161618] shadow-xl overflow-hidden">
				<p className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/30 border-b border-white/10">
					Dev sandboxes
				</p>
				{SANDBOXES.map((s) => (
					<a
						key={s.path}
						href={s.path}
						className="block px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
					>
						{s.label}
					</a>
				))}
			</div>
		</details>
	);
}