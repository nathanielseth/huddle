import { motion } from "motion/react";
import { socket } from "../../../lib/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TASK_META } from "../constants";
import { TimerBar } from "../../sabong/components/TimerBar";
import { SELECTABLE_TASKS, type SelectableTask } from "../constants";

export function CategorySelect() {
	const { sussy, role, players, timer, amChooser } = useSussyState();
	if (!sussy) return null;

	const chooserName =
		players.find((p) => p.id === sussy.chooserPlayerId)?.name ?? "Someone";

	if (role === "host")
		return (
			<HostView
				chooserName={chooserName}
				timer={timer}
				roundNumber={sussy.roundNumber}
			/>
		);
	if (amChooser)
		return <ChooserView timer={timer} roundNumber={sussy.roundNumber} />;
	return (
		<WaiterView
			chooserName={chooserName}
			timer={timer}
			roundNumber={sussy.roundNumber}
		/>
	);
}

function HostView({
	chooserName,
	timer,
	roundNumber,
}: {
	chooserName: string;
	timer: ReturnType<typeof useSussyState>["timer"];
	roundNumber: number;
}) {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8 text-center">
			<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Round {roundNumber} of 4
			</p>
			<h1 className="font-display text-5xl font-black uppercase text-white">
				Pick a Category
			</h1>
			<p className="text-white/50 text-lg">
				<span className="text-white font-bold">{chooserName}</span> is choosing…
			</p>
			<div className="w-full max-w-xs mt-4">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

function ChooserView({
	timer,
	roundNumber,
}: {
	timer: ReturnType<typeof useSussyState>["timer"];
	roundNumber: number;
}) {
	function pick(category: SelectableTask) {
		socket.emit("player_action", { type: "select_category", category });
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-10 gap-8">
			<div className="flex flex-col gap-2">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400">
					Round {roundNumber} of 4 · You're choosing
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Pick a Category
				</h1>
				<TimerBar timer={timer} />
			</div>

			<div className="flex flex-col gap-3">
				{SELECTABLE_TASKS.map((task, i) => {
					const meta = TASK_META[task];
					return (
						<motion.button
							key={task}
							type="button"
							onClick={() => pick(task)}
							className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-surface hover:bg-white/8 hover:border-violet-500/40 active:scale-[0.98] transition-all cursor-pointer text-left"
							initial={{ opacity: 0, x: -12 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.05, duration: 0.2 }}
						>
							<span className="text-3xl">{meta.icon}</span>
							<div className="flex flex-col gap-0.5">
								<span className="font-display font-bold text-white uppercase text-sm tracking-wide">
									{meta.label}
								</span>
								<span className="text-xs text-white/40">{meta.desc}</span>
							</div>
						</motion.button>
					);
				})}
			</div>
		</div>
	);
}

function WaiterView({
	chooserName,
	timer,
	roundNumber,
}: {
	chooserName: string;
	timer: ReturnType<typeof useSussyState>["timer"];
	roundNumber: number;
}) {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8 text-center">
			<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Round {roundNumber} of 4
			</p>
			<div className="text-5xl">🎲</div>
			<h1 className="font-display text-3xl font-black uppercase text-white">
				{chooserName} is picking a category
			</h1>
			<p className="text-white/40 text-sm">Sit tight…</p>
			<div className="w-full max-w-xs">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}
