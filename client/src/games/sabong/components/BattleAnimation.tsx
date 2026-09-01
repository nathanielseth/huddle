import { useEffect, useReducer, useRef } from "react";
import { m, AnimatePresence } from "motion/react";
import type { BattleEvent, ManokView } from "@shared/games/sabong/index";
import { cn } from "../../../lib/utils/cn";
import type { HpState, LogLine } from "../types";

const EVENT_MS = 1200;

interface BattleAnimationProps {
	fighter1: ManokView;
	fighter2: ManokView;
	battleLog: readonly BattleEvent[];
	compact?: boolean;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
// Consolidating the three setState calls that used to live inside the timer
// callbacks into a single dispatch eliminates the cascading render problem:
// one action → one render, no intermediate flicker.

type BattleState = {
	hp: HpState;
	logLines: LogLine[];
	currentEvent: number;
};

type BattleAction =
	| {
			type: "TICK";
			eventIndex: number;
			hpUpdate?: { id: string; value: number };
			logLine: { text: string; lineType: LogLine["type"] };
	  }
	| { type: "RESET"; hp: HpState };

function battleReducer(state: BattleState, action: BattleAction): BattleState {
	switch (action.type) {
		case "RESET":
			return { hp: action.hp, logLines: [], currentEvent: -1 };
		case "TICK": {
			const hp = action.hpUpdate
				? { ...state.hp, [action.hpUpdate.id]: action.hpUpdate.value }
				: state.hp;
			// lineCounter lives in a ref outside — we just append the line here
			return {
				hp,
				currentEvent: action.eventIndex,
				logLines: [
					...state.logLines,
					{
						id: action.eventIndex,
						text: action.logLine.text,
						type: action.logLine.lineType,
					},
				],
			};
		}
		default:
			return state;
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEventText(
	event: BattleEvent,
	getName: (id: string) => string,
): { text: string; type: LogLine["type"] } {
	switch (event.type) {
		case "move": {
			const attacker = getName(event.attackerId);
			const move =
				event.move === "double_strike" ? "double strikes" : "strikes";
			const critText = event.crit ? " ⚡ CRIT!" : "";
			return {
				text: `${attacker} ${move} for ${event.damage} dmg${critText}`,
				type: event.crit ? "crit" : "hit",
			};
		}
		case "miss":
			return { text: `${getName(event.attackerId)} misses!`, type: "miss" };
		case "buff":
			return {
				text: `${getName(event.attackerId)} powers up! (+${event.newAttackBoost} ATK)`,
				type: "buff",
			};
		case "ko":
			return { text: `${getName(event.loserId)} is KO'd!`, type: "ko" };
		case "timeout":
			return {
				text: `Time's up! ${getName(event.winnerId)} wins by ${event.reason === "hp_advantage" ? "HP" : "coin flip"}`,
				type: "timeout",
			};
	}
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BattleAnimation({
	fighter1,
	fighter2,
	battleLog,
	compact = false,
}: BattleAnimationProps) {
	const [battle, dispatch] = useReducer(battleReducer, null, () => ({
		hp: {
			[fighter1.id]: fighter1.maxHp,
			[fighter2.id]: fighter2.maxHp,
		},
		logLines: [],
		currentEvent: -1,
	}));

	const logRef = useRef<HTMLDivElement>(null);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		timersRef.current.forEach(clearTimeout);
		timersRef.current = [];

		// Reset HP when a new battle starts (fighter props change)
		dispatch({
			type: "RESET",
			hp: {
				[fighter1.id]: fighter1.maxHp,
				[fighter2.id]: fighter2.maxHp,
			},
		});

		if (!battleLog.length) return;

		// getName is defined here, inside the effect, so it closes over
		// fighter1/fighter2 from this render — no stale capture, no dep to declare.
		function getName(id: string) {
			return id === fighter1.id ? fighter1.name : fighter2.name;
		}

		battleLog.forEach((event, i) => {
			const handle = setTimeout(() => {
				let hpUpdate: { id: string; value: number } | undefined;
				if (event.type === "move") {
					const defenderId =
						event.attackerId === fighter1.id ? fighter2.id : fighter1.id;
					hpUpdate = { id: defenderId, value: event.defenderHp };
				}

				const { text, type: lineType } = buildEventText(event, getName);
				dispatch({
					type: "TICK",
					eventIndex: i,
					hpUpdate,
					logLine: { text, lineType },
				});
			}, i * EVENT_MS);

			timersRef.current.push(handle);
		});

		return () => { timersRef.current.forEach(clearTimeout); };
	}, [
		battleLog,
		fighter1.id,
		fighter1.name,
		fighter1.maxHp,
		fighter2.id,
		fighter2.name,
		fighter2.maxHp,
	]);

	// auto-scroll log
	useEffect(() => {
		if (logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [battle.logLines]);

	const winnerId = (() => {
		const last = battleLog[battleLog.length - 1];
		if (!last) return null;
		if (last.type === "ko")
			return last.loserId === fighter1.id ? fighter2.id : fighter1.id;
		if (last.type === "timeout") return last.winnerId;
		return null;
	})();

	const isDone = battle.currentEvent >= battleLog.length - 1;

	return (
		<div className={cn("flex flex-col gap-4", compact ? "gap-3" : "gap-5")}>
			{/* fighters + HP bars */}
			<div className="flex items-stretch gap-3">
				{[fighter1, fighter2].map((fighter, idx) => {
					const currentHp = battle.hp[fighter.id] ?? fighter.maxHp;
					const pct = Math.max((currentHp / fighter.maxHp) * 100, 0);
					const isWinner = isDone && winnerId === fighter.id;
					const isLoser =
						isDone && winnerId !== null && winnerId !== fighter.id;

					return (
						<div
							key={fighter.id}
							className={cn(
								"flex-1 flex flex-col gap-2 rounded-xl border p-3 transition-all duration-500",
								isWinner && "border-green-500/50 bg-green-500/5",
								isLoser && "border-white/5 opacity-40",
								!isWinner && !isLoser && "border-border bg-surface-raised",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span
									className={cn(
										"font-display font-black uppercase leading-none",
										compact ? "text-base" : "text-lg",
									)}
								>
									{fighter.name}
								</span>
								{idx === 0 && (
									<span className="text-[10px] font-bold tracking-widest uppercase text-orange-400/60">
										Red
									</span>
								)}
								{idx === 1 && (
									<span className="text-[10px] font-bold tracking-widest uppercase text-blue-400/60">
										Blue
									</span>
								)}
							</div>

							<div className="flex items-center gap-2">
								<div className="flex-1 h-2 rounded-full overflow-hidden bg-white/8">
									<m.div
										className={cn(
											"h-full rounded-full",
											pct > 50
												? "bg-green-400"
												: pct > 25
													? "bg-yellow-400"
													: "bg-red-400",
										)}
										animate={{ width: `${pct}%` }}
										transition={{ duration: 0.4, ease: "easeOut" }}
									/>
								</div>
								<span className="font-display text-xs tabular-nums text-white/50 w-8 text-right">
									{Math.max(currentHp, 0)}
								</span>
							</div>

							{isWinner && (
								<m.span
									className="text-xs font-bold text-green-400 text-center"
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
								>
									WINNER
								</m.span>
							)}
						</div>
					);
				})}
			</div>

			{/* battle log feed */}
			{!compact && (
				<div
					ref={logRef}
					className="h-32 overflow-y-auto flex flex-col gap-1 px-1"
					style={{ scrollBehavior: "smooth" }}
				>
					<AnimatePresence initial={false}>
						{battle.logLines.map((line) => (
							<m.div
								key={line.id}
								className={cn(
									"text-xs px-3 py-1.5 rounded-lg font-medium",
									line.type === "crit" && "text-yellow-300 bg-yellow-500/10",
									line.type === "hit" && "text-white/70 bg-white/3",
									line.type === "miss" && "text-white/30 bg-transparent",
									line.type === "buff" && "text-blue-300 bg-blue-500/10",
									line.type === "ko" && "text-red-300 bg-red-500/10 font-bold",
									line.type === "timeout" &&
										"text-orange-300 bg-orange-500/10 font-bold",
								)}
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.15 }}
							>
								{line.text}
							</m.div>
						))}
					</AnimatePresence>
				</div>
			)}
		</div>
	);
}