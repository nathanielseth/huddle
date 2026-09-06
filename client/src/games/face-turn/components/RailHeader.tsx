import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../app/store";
import { modal } from "../../../lib/utils/modal";
import {
	getInteractionResponder,
	useFaceturnState,
} from "../hooks/useFaceturnState";
import { PhaseTimer } from "./PhaseTimer";
import { IconToolbarPopover } from "./ui/ToolbarPopover";
import { GameSettingsPanel } from "./ui/GameSettingsPanel";

function SettingsIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="w-4 h-4"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<circle cx={12} cy={12} r={3} />
			<path
				d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2.5a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V2.5a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.31.7.9 1.24 1.51 1H21.5a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function FlagIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="w-4 h-4"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path d="M4 3v18" strokeLinecap="round" strokeLinejoin="round" />
			<path
				d="M4 4h13l-2.5 4L17 12H4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function useStatusLabel(): { name: string; suffix: string } | null {
	const { ft, playerId, playerMap } = useFaceturnState();
	if (!ft) return null;

	const nameOf = (id: string) => playerMap[id]?.name ?? id;

	if (ft.phase === "move_chain_window" && ft.moveChain) {
		const responderId = ft.moveChain.responderId;
		const isYou = responderId === playerId;
		return {
			name: isYou ? "You're" : nameOf(responderId),
			suffix: isYou ? "responding" : "is responding",
		};
	}

	if (ft.pendingInteraction) {
		const responderId = getInteractionResponder(ft.pendingInteraction);
		const isYou = responderId === playerId;
		return {
			name: isYou ? "You're" : nameOf(responderId),
			suffix: isYou ? "responding" : "is responding",
		};
	}

	if (ft.turn && ft.phase === "active_turn") {
		const activeId = ft.turn.activePlayerId;
		const isYou = activeId === playerId;
		return {
			name: isYou ? "Your turn" : `${nameOf(activeId)}'s turn`,
			suffix: "",
		};
	}

	return null;
}

function SurrenderButton() {
	const navigate = useNavigate();
	const leaveRoom = useGameStore((s) => s.leaveRoom);

	async function handleSurrender() {
		const confirmed = await modal.confirm({
			title: "Leave the game?",
			body: "You'll forfeit this match and won't be able to rejoin.",
			confirmLabel: "Leave game",
			cancelLabel: "Stay",
		});
		if (!confirmed) return;
		leaveRoom();
		void navigate("/");
	}

	return (
		<button
			type="button"
			onClick={() => {
				void handleSurrender();
			}}
			aria-label="Leave game"
			title="Leave game"
			className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/15 bg-white/5 text-white/60 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer"
		>
			<FlagIcon />
		</button>
	);
}

function SettingsButton() {
	const [open, setOpen] = useState(false);

	return (
		<IconToolbarPopover
			label="Settings"
			active={false}
			open={open}
			onToggle={() => {
				setOpen((v) => !v);
			}}
			align="right"
			panelClassName="w-72"
			icon={<SettingsIcon />}
			portal
		>
			<GameSettingsPanel />
		</IconToolbarPopover>
	);
}

export function RailHeader({ extraActions }: { extraActions?: ReactNode }) {
	const { ft } = useFaceturnState();
	const status = useStatusLabel();

	if (!ft) return null;

	return (
		<div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
			<div className="flex flex-col shrink-0 leading-none gap-1">
				{ft.turn && (
					<span className="ft-eyebrow text-sm text-white/80 tabular-nums">
						Turn {ft.turn.turnNumber}
					</span>
				)}
				<PhaseTimer />
			</div>

			<div className="flex-1 min-w-0 text-center">
				{status && (
					<span className="ft-eyebrow text-xs text-white/45 truncate">
						<span className="text-white/85">{status.name}</span>
						{status.suffix && ` ${status.suffix}`}
					</span>
				)}
			</div>

			<div className="flex items-center gap-1.5 shrink-0">
				{extraActions}
				<SettingsButton />
				<SurrenderButton />
			</div>
		</div>
	);
}