import { useState, useRef, useEffect } from "react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { MissionTrack } from "../components/MissionTrack";
import { ObfuscatorToggle } from "../components/ObfuscatorToggle";
import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";
import type {
	CybsecsState,
	CybsecsSecret,
} from "@shared/games/breachpoint/index";
import type { GameTimer } from "@shared/core/room";

export function Mission() {
	const { game, secret, role, timer, myPlayer, amNominated, canHack, getName } =
		useCybsecsState();
	if (!game) return null;

	if (role === "host") {
		return <HostView game={game} timer={timer} getName={getName} />;
	}
	if (amNominated) {
		return (
			<OnTeamView
				game={game}
				secret={secret}
				timer={timer}
				hasSubmitted={myPlayer?.hasSubmittedMissionAction ?? false}
				canHack={canHack}
			/>
		);
	}
	return <OffTeamView game={game} timer={timer} getName={getName} />;
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
	const submitCount = game.nominatedTeam.filter(
		(id) => game.players[id]?.hasSubmittedMissionAction,
	).length;
	const teamSize = game.nominatedTeam.length;

	return (
		<div className="flex flex-col min-h-screen px-12 py-10 gap-8">
			<MissionTrack
				missionResults={game.missionResults}
				missionIndex={game.missionIndex}
				playerCount={game.playerOrder.length}
			/>

			<div className="flex flex-col items-center gap-5 flex-1 justify-center text-center">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1} · In Progress
				</span>
				<h1 className="font-display text-6xl font-black uppercase text-white">
					Mission
				</h1>

				<div className="flex gap-3 flex-wrap justify-center">
					{game.nominatedTeam.map((id) => {
						const submitted = game.players[id]?.hasSubmittedMissionAction;
						return (
							<div
								key={id}
								className={cn(
									"flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors",
									submitted
										? "bg-green-400/10 border-green-400/30 text-green-400"
										: "bg-white/5 border-border text-white/50",
								)}
							>
								{getName(id)}
								{submitted && " ✓"}
							</div>
						);
					})}
				</div>

				<p className="font-display text-5xl font-black text-white/40 tabular-nums">
					{submitCount}
					<span className="text-white/20 text-3xl">/{teamSize}</span>
				</p>
				<p className="text-white/30 text-sm">submitted</p>
			</div>

			<div className="w-full max-w-xs mx-auto">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

function OnTeamView({
	game,
	secret,
	timer,
	hasSubmitted,
	canHack,
}: {
	game: CybsecsState;
	secret: CybsecsSecret | null;
	timer: GameTimer | null;
	hasSubmitted: boolean;
	canHack: boolean;
}) {
	const [submitted, setSubmitted] = useState(false);
	const done = hasSubmitted || submitted;

	const submitCount = game.nominatedTeam.filter(
		(id) => game.players[id]?.hasSubmittedMissionAction,
	).length;

	function submitAction(action: "secure" | "hack") {
		socket.emit("player_action", { type: "mission_action", action });
		setSubmitted(true);
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-cyan-400">
					Mission {game.missionIndex + 1} · You're on the Team
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Choose Action
				</h1>
				<TimerBar timer={timer} />
			</div>

			{done ? (
				<div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
					<div className="w-20 h-20 rounded-full bg-white/8 border border-border flex items-center justify-center text-3xl text-white/60">
						✓
					</div>
					<p className="text-white/40 text-sm">Waiting for the team…</p>

					<div className="flex flex-col items-center gap-2 w-full max-w-40">
						<div className="flex gap-1.5 w-full">
							{game.nominatedTeam.map((id) => {
								const sub = game.players[id]?.hasSubmittedMissionAction;
								return (
									<div
										key={id}
										className={cn(
											"flex-1 h-1.5 rounded-full transition-colors duration-300",
											sub ? "bg-white/50" : "bg-white/10",
										)}
									/>
								);
							})}
						</div>
						<p className="text-[10px] text-white/25 tabular-nums">
							{submitCount}/{game.nominatedTeam.length} submitted
						</p>
					</div>

					{secret && (
						<ObfuscatorToggle
							armed={secret.obfuscateArmed}
							usesLeft={secret.obfuscatorUsesLeft}
						/>
					)}
				</div>
			) : (
				<>
					<p className="text-white/40 text-sm">
						Your choice is completely secret. Hold to confirm.
					</p>

					<div className="flex flex-col gap-3 flex-1 justify-center">
						{secret && (
							<ObfuscatorToggle
								armed={secret.obfuscateArmed}
								usesLeft={secret.obfuscatorUsesLeft}
							/>
						)}

						<HoldButton
							label="🔒 Secure"
							colorCls="bg-cyan-400/15 border-cyan-400/40 text-cyan-400"
							onHeld={() => {
								submitAction("secure");
							}}
						/>
						{canHack && (
							<HoldButton
								label="💀 Hack"
								colorCls="bg-red-500/15 border-red-500/40 text-red-400"
								onHeld={() => {
									submitAction("hack");
								}}
							/>
						)}
					</div>

					{secret?.role === "ethical_hacker" && canHack && (
						<p className="text-xs text-cyan-400/60 text-center leading-relaxed">
							EH: Hacking neutralizes all real hacks on this mission.{" "}
							{secret.ethicalHackerUsesLeft} use
							{secret.ethicalHackerUsesLeft !== 1 ? "s" : ""} remaining.
						</p>
					)}
				</>
			)}
		</div>
	);
}

function HoldButton({
	label,
	colorCls,
	onHeld,
}: {
	label: string;
	colorCls: string;
	onHeld: () => void;
}) {
	const [holding, setHolding] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// clean up timeout if component unmounts mid-hold (like phase transition)
	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	function startHold() {
		setHolding(true);
		timerRef.current = setTimeout(() => {
			setHolding(false);
			onHeld();
		}, 1000);
	}

	function cancelHold() {
		if (!holding) return;
		setHolding(false);
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}

	return (
		<button
			type="button"
			onPointerDown={startHold}
			onPointerUp={cancelHold}
			onPointerLeave={cancelHold}
			onPointerCancel={cancelHold}
			className={cn(
				"relative w-full h-20 rounded-2xl border overflow-hidden",
				"font-display font-bold text-xl uppercase",
				"select-none touch-none cursor-pointer",
				colorCls,
			)}
		>
			{/* css transition handles the fill animation, avoiding unnecessary frame-by-frame state updates */}
			<div
				className="absolute inset-y-0 left-0 bg-white/20 pointer-events-none"
				style={{
					width: holding ? "100%" : "0%",
					transition: holding ? "width 1s linear" : "none",
					borderRadius: "inherit",
				}}
			/>
			<span className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
				<span>{label}</span>
				<span className="text-[10px] font-normal tracking-normal normal-case opacity-50">
					{holding ? "keep holding…" : "hold to confirm"}
				</span>
			</span>
		</button>
	);
}

function OffTeamView({
	game,
	timer,
	getName,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	getName: (id: string) => string;
}) {
	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Mission {game.missionIndex + 1}
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Mission
				</h1>
				<TimerBar timer={timer} />
			</div>

			<div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
				<p className="text-white/50 text-lg">Your team is on the mission</p>
				<div className="flex flex-col gap-2 w-full max-w-xs">
					{game.nominatedTeam.map((id) => (
						<div
							key={id}
							className="px-4 py-3 rounded-xl bg-cyan-400/8 border border-cyan-400/20 text-cyan-400 font-semibold text-sm text-center"
						>
							{getName(id)}
						</div>
					))}
				</div>
				<p className="text-white/25 text-xs">Waiting for their actions…</p>
			</div>
		</div>
	);
}