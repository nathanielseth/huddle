import { m } from "motion/react";
import { useSussyState } from "../hooks/useSussyState";
import { cn } from "../../../lib/utils/cn";

export function Finished() {
	const { sussy, players } = useSussyState();
	if (!sussy) return null;

	// Fix: js-tosorted-immutable — toSorted() instead of [...players].sort()
	const ranked = players.toSorted((a, b) => {
		const sa = sussy.players[a.id]?.score ?? 0;
		const sb = sussy.players[b.id]?.score ?? 0;
		return sb - sa;
	});

	// Fix: js-min-max-loop + js-tosorted-immutable
	// Instead of sorting the whole list just to read [0], find the max value
	// in one O(n) pass with Math.max, then find the player who holds it.
	const maxSurvived = Math.max(
		0,
		...players.map((p) => sussy.players[p.id]?.survivedCount ?? 0),
	);
	const bestFaker = players.find(
		(p) => (sussy.players[p.id]?.survivedCount ?? 0) === maxSurvived,
	);

	const maxSleuthed = Math.max(
		0,
		...players.map((p) => sussy.players[p.id]?.sleuthedCount ?? 0),
	);
	const bestSleuth = players.find(
		(p) => (sussy.players[p.id]?.sleuthedCount ?? 0) === maxSleuthed,
	);

	const medals = ["🥇", "🥈", "🥉"];

	return (
		<div className="flex flex-col min-h-screen px-5 py-10 gap-8">
			<m.div
				className="flex flex-col gap-1"
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400">
					Game Over
				</p>
				<h1 className="font-display text-5xl font-black uppercase text-white leading-none">
					Final Scores
				</h1>
			</m.div>

			{/* Leaderboard */}
			<div className="flex flex-col gap-2">
				{ranked.map((p, i) => {
					const sp = sussy.players[p.id];
					const isFirst = i === 0;
					return (
						<m.div
							key={p.id}
							className={cn(
								"flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all",
								isFirst
									? "border-yellow-500/40 bg-yellow-500/8"
									: "border-border bg-surface",
							)}
							initial={{ opacity: 0, x: -12 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.07, duration: 0.25 }}
						>
							<span className="text-2xl w-8 text-center shrink-0">
								{medals[i] ?? `${i + 1}.`}
							</span>
							<span
								className={cn(
									"flex-1 font-bold",
									isFirst ? "text-yellow-200 text-lg" : "text-white text-sm",
								)}
							>
								{p.name}
							</span>
							<span
								className={cn(
									"font-display font-black tabular-nums",
									isFirst
										? "text-yellow-300 text-2xl"
										: "text-white/70 text-lg",
								)}
							>
								{sp?.score ?? 0}
							</span>
						</m.div>
					);
				})}
			</div>

			{/* Awards */}
			<m.div
				className="flex flex-col gap-3"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5, duration: 0.3 }}
			>
				<p className="text-xs font-bold tracking-widest uppercase text-white/30">
					Awards
				</p>
				<div className="grid grid-cols-2 gap-3">
					<AwardCard
						icon="😈"
						title="Best Faker"
						name={bestFaker?.name ?? "—"}
						stat={`${sussy.players[bestFaker?.id ?? ""]?.survivedCount ?? 0} survived`}
						color="red"
					/>
					<AwardCard
						icon="🔍"
						title="Best Sleuth"
						name={bestSleuth?.name ?? "—"}
						stat={`${sussy.players[bestSleuth?.id ?? ""]?.sleuthedCount ?? 0} caught`}
						color="violet"
					/>
				</div>
			</m.div>
		</div>
	);
}

function AwardCard({
	icon,
	title,
	name,
	stat,
	color,
}: {
	icon: string;
	title: string;
	name: string;
	stat: string;
	color: "red" | "violet";
}) {
	const border =
		color === "red"
			? "border-red-500/30 bg-red-500/8"
			: "border-violet-500/30 bg-violet-500/8";
	const label = color === "red" ? "text-red-400" : "text-violet-400";

	return (
		<div
			className={cn("flex flex-col gap-2 px-4 py-4 rounded-2xl border", border)}
		>
			<span className="text-3xl">{icon}</span>
			<p
				className={cn("text-[10px] font-bold tracking-widest uppercase", label)}
			>
				{title}
			</p>
			<p className="text-white font-bold text-sm leading-tight">{name}</p>
			<p className="text-white/30 text-[10px]">{stat}</p>
		</div>
	);
}