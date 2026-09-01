import type { PendingActionType } from "@shared/games/face-turn/types";
import { cn } from "../../../lib/utils/cn";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import {
	isPlayerOrTeammate,
	isPlayerExposed,
} from "../lib/challengeEligibility";
import { PromptShell } from "./interaction-prompts/SimplePrompts";

const ACTION_LABEL: Record<PendingActionType, string> = {
	class_action_strike: "Strike",
	class_action_collect: "Collect",
	class_action_hide: "Hide",
	class_action_defend: "Defend",
	card_strike: "Ambush",
};

const ACTION_TONE = {
	red: "border-red-400/60 text-red-200 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.25)]",
	sky: "border-sky-400/60 text-sky-200 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25)]",
	neutral: "border-white/15 text-white/60",
} as const;

function ActionButton({
	label,
	tone,
	onClick,
	disabled,
}: {
	label: string;
	tone: keyof typeof ACTION_TONE;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"ft-panel-ink px-4 py-2 rounded-lg border text-sm font-bold transition-all",
				disabled
					? "border-white/5 text-white/20 cursor-not-allowed"
					: cn(ACTION_TONE[tone], "cursor-pointer hover:brightness-125"),
			)}
		>
			{label}
		</button>
	);
}

export function ChallengeBar() {
	const { ft, playerId, canChallenge, myPlayer } = useFaceturnState();
	// lock on phase, any action here transitions phase away
	const { locked, runLocked } = useActionLock(ft?.phase);

	if (!ft || !myPlayer) return null;

	if (ft.phase === "challenge_window") {
		if (!canChallenge) return null;
		const pending = ft.pendingAction;
		const canDefend = pending?.type === "class_action_strike";
		const title = pending
			? `${pending.actorId === playerId ? "You" : "Someone"} declared ${ACTION_LABEL[pending.type]} — respond`
			: "Respond";
		// wrong challenge executes the challenger if they are exposed
		const challengeIsFatalIfWrong = isPlayerExposed(myPlayer);
		return (
			<PromptShell title={title} tone="red">
				{challengeIsFatalIfWrong && (
					<p className="text-xs text-red-300/90 mb-1.5">
						⚠️ Your Crew is fully exposed — if you challenge and they weren't
						bluffing, you'll be executed.
					</p>
				)}
				<div className="flex gap-2 flex-wrap">
					<ActionButton
						label="Challenge (call bluff)"
						tone="red"
						disabled={locked}
						onClick={() => {
							runLocked(() => {
								sendFaceturnAction({ type: "challenge" });
							});
						}}
					/>
					{canDefend && (
						<ActionButton
							label="Defend"
							tone="sky"
							disabled={locked}
							onClick={() => {
								runLocked(() => {
									sendFaceturnAction({ type: "defend" });
								});
							}}
						/>
					)}
					<ActionButton
						label="Pass"
						tone="neutral"
						disabled={locked}
						onClick={() => {
							runLocked(() => {
								sendFaceturnAction({ type: "pass_challenge" });
							});
						}}
					/>
				</div>
			</PromptShell>
		);
	}

	if (ft.phase === "defend_window") {
		const pending = ft.pendingAction;
		const targetId = pending?.targetPlayerId;
		if (!pending || !targetId) return null;
		const isTarget = isPlayerOrTeammate(ft, playerId, targetId);
		if (!isTarget) return null;
		return (
			<PromptShell title="Ambush incoming — defend it?" tone="sky">
				<div className="flex gap-2 flex-wrap">
					<ActionButton
						label="Defend"
						tone="sky"
						disabled={locked}
						onClick={() => {
							runLocked(() => {
								sendFaceturnAction({ type: "defend" });
							});
						}}
					/>
					<ActionButton
						label="Pass"
						tone="neutral"
						disabled={locked}
						onClick={() => {
							runLocked(() => {
								sendFaceturnAction({ type: "pass_challenge" });
							});
						}}
					/>
				</div>
			</PromptShell>
		);
	}

	if (ft.phase === "defend_declared") {
		const pending = ft.pendingAction;
		if (!pending) return null;
		// after defend, actorId is defender, targetPlayerId is original striker
		const isOriginalStriker = pending.targetPlayerId === playerId;
		if (!isOriginalStriker) return null;
		const canChallengeDefend = pending.originalActionType !== "card_strike";
		const challengeDefendIsFatalIfWrong = isPlayerExposed(myPlayer);
		return (
			<PromptShell title="Your strike was defended" tone="violet">
				{canChallengeDefend && challengeDefendIsFatalIfWrong && (
					<p className="text-xs text-red-300/90 mb-1.5">
						⚠️ Your Crew is fully exposed — if you challenge the defend and it
						was real, you'll be executed.
					</p>
				)}
				{!canChallengeDefend && (
					<p className="text-xs text-white/60 mb-1.5">
						Ambush defends can't be challenged — accept it or let the timer run
						out.
					</p>
				)}
				<div className="flex gap-2 flex-wrap">
					{canChallengeDefend && (
						<ActionButton
							label="Challenge the defend"
							tone="red"
							disabled={locked}
							onClick={() => {
								runLocked(() => {
									sendFaceturnAction({ type: "challenge_defend" });
								});
							}}
						/>
					)}
					<ActionButton
						label="Accept the defend"
						tone="neutral"
						disabled={locked}
						onClick={() => {
							runLocked(() => {
								sendFaceturnAction({ type: "accept_defend" });
							});
						}}
					/>
				</div>
			</PromptShell>
		);
	}

	return null;
}