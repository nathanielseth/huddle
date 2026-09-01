import { useState } from "react";
import { m } from "motion/react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";
import type { CybsecsState } from "@shared/games/breachpoint/index";
import type { GameTimer } from "@shared/core/room";

export function Doxxing() {
	const { game, secret, role, timer, playerId, getName } = useCybsecsState();
	if (!game) return null;

	const isDoxxer = secret?.role === "doxxer";

	if (role === "host") {
		return <HostView game={game} timer={timer} getName={getName} />;
	}
	if (isDoxxer) {
		return (
			<DoxxerView
				game={game}
				timer={timer}
				playerId={playerId}
				getName={getName}
			/>
		);
	}
	return <WaiterView timer={timer} />;
}

function HostView({
	game,
	timer,
	getName,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	getName: (id: string) => string;
}) {
	return (
		<div className="flex flex-col min-h-screen px-12 py-10 gap-8">
			<div className="flex flex-col items-center gap-5 flex-1 justify-center text-center">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-red-400">
					Exposure Mode · Endgame
				</span>
				<h1 className="font-display text-6xl font-black uppercase text-white">
					Doxxing
				</h1>
				<p className="text-white/50 text-xl max-w-lg">
					Agents secured 3 missions. The Doxxer has one chance to identify the
					Sysadmin.
				</p>
				<p className="text-white/30 text-sm">
					Identify correctly → Hackers win · Guess wrong → Agents win
				</p>

				<div className="grid grid-cols-4 gap-3 w-full max-w-2xl mt-6">
					{game.playerOrder.map((id) => (
						<div
							key={id}
							className="px-4 py-3 rounded-xl bg-surface border border-border text-center text-sm font-semibold text-white/70"
						>
							{getName(id)}
						</div>
					))}
				</div>
			</div>

			<div className="w-full max-w-xs mx-auto">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

function DoxxerView({
	game,
	timer,
	playerId,
	getName,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	playerId: string;
	getName: (id: string) => string;
}) {
	const [targetId, setTargetId] = useState<string | null>(null);
	const [sent, setSent] = useState(false);

	const candidates = game.playerOrder.filter((id) => id !== playerId);

	function confirm() {
		if (!targetId || sent) return;
		setSent(true);
		socket.emit("player_action", { type: "doxx", targetId });
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-5">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-red-400">
					Doxxer · Final Move
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Who's the Sysadmin?
				</h1>
				<TimerBar timer={timer} />
			</div>

			<p className="text-white/50 text-sm">
				Pick the Sysadmin — hackers win. Pick wrong — agents win. Choose
				carefully.
			</p>

			<div className="flex flex-col gap-2 flex-1">
				{candidates.map((id, i) => {
					const isTarget = targetId === id;
					return (
						<m.button
							key={id}
							type="button"
							onClick={() => !sent && setTargetId(isTarget ? null : id)}
							whileTap={{ scale: 0.98 }}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.04 }}
							disabled={sent}
							className={cn(
								"flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left font-semibold text-sm transition-all",
								isTarget
									? "bg-red-500/20 border-red-500/40 text-white cursor-pointer"
									: sent
										? "bg-surface border-border text-white/30 cursor-not-allowed"
										: "bg-surface border-border text-white/70 hover:bg-white/8 cursor-pointer",
							)}
						>
							<span
								className={cn(
									"w-2 h-2 rounded-full shrink-0 transition-colors",
									isTarget ? "bg-red-400" : "bg-white/20",
								)}
							/>
							{getName(id)}
						</m.button>
					);
				})}
			</div>

			<m.button
				type="button"
				onClick={confirm}
				whileTap={{ scale: 0.97 }}
				disabled={!targetId || sent}
				className={cn(
					"w-full h-14 rounded-2xl font-display font-bold text-lg uppercase transition-all",
					targetId && !sent
						? "bg-red-500 text-white cursor-pointer hover:opacity-90"
						: "bg-white/5 text-white/20 cursor-not-allowed",
				)}
			>
				{sent
					? "Sent…"
					: targetId
						? `Doxx ${getName(targetId)}`
						: "Select a Target"}
			</m.button>
		</div>
	);
}

function WaiterView({ timer }: { timer: GameTimer | null }) {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-5 gap-6 text-center">
			<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Endgame
			</span>
			<div className="text-5xl">🎯</div>
			<h1 className="font-display text-4xl font-black uppercase text-white">
				Doxxing Phase
			</h1>
			<p className="text-white/40 text-sm max-w-xs">
				Agents secured 3 missions. The Doxxer is identifying the Sysadmin…
			</p>
			<div className="w-full max-w-xs">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}