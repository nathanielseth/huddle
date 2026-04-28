import { useSabongState } from "../hooks/useSabongState";
import { BattleAnimation } from "../components/BattleAnimation";
import { TimerBar } from "../components/TimerBar";

export function FightingPlayer() {
	const { sabong, fighter1, fighter2, timer } = useSabongState();

	if (!sabong || !fighter1 || !fighter2 || !sabong.battleLog) return null;

	const matchLabel = `Match ${sabong.currentMatchIndex + 1} of 7`;

	return (
		<div className="flex flex-col min-h-screen bg-bg">
			<div className="flex flex-col gap-3 px-5 pt-6 pb-4 border-b border-border">
				<span className="font-display text-xs font-bold tracking-[0.25em] uppercase text-white/40">
					{matchLabel}
				</span>
				<h1 className="font-display text-3xl font-black uppercase leading-none text-white">
					Fight!
				</h1>
				<TimerBar timer={timer} />
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-5">
				<BattleAnimation
					fighter1={fighter1}
					fighter2={fighter2}
					battleLog={sabong.battleLog}
				/>
			</div>
		</div>
	);
}

export function FightingHost() {
	const { sabong, fighter1, fighter2, players, timer } = useSabongState();

	if (!sabong || !fighter1 || !fighter2 || !sabong.battleLog) return null;

	const matchLabel = `Match ${sabong.currentMatchIndex + 1} of 7`;

	return (
		<div className="flex flex-col min-h-screen bg-bg px-8 py-8 gap-8">
			<div className="flex items-end justify-between">
				<div className="flex flex-col gap-1">
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						{matchLabel}
					</span>
					<h1 className="font-display text-5xl font-black uppercase leading-none text-white">
						Fight!
					</h1>
				</div>
			</div>

			<TimerBar timer={timer} />

			<div className="flex-1">
				<BattleAnimation
					fighter1={fighter1}
					fighter2={fighter2}
					battleLog={sabong.battleLog}
				/>
			</div>

			{/* who bet on who */}
			<div className="flex flex-wrap gap-2">
				{players.map((p) => {
					const sp = sabong.players[p.id];
					const bet = sp?.currentBet;
					const side =
						bet?.manokId === fighter1.id ? fighter1.name : fighter2.name;
					return (
						<div
							key={p.id}
							className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-white/3 text-xs font-semibold text-white/50"
						>
							{p.name}
							{bet && (
								<span className="text-white/30">
									₱{bet.amount} on {side}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
