import "../../board.css";
import {
	useEffect,
	useEffectEvent,
	useReducer,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../../lib/utils/cn";
import { getBossDisplay } from "@shared/games/face-turn/card-display";
import { sendFaceturnAction } from "../../actions";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useBossCommandPopoverStore } from "../../hooks/bossCommandPopoverStore";
import { TargetPicker } from "./TargetPicker";
import { useTargetPickerSite } from "../../hooks/useTargetPickerSite";
import {
	razorTargets,
	dealerTargets,
} from "../../hooks/crewSlotPickerAdapters";

type BossCommandFormState = {
	razorTargetId: string | null;
	confirmed: boolean;
};

type BossCommandFormAction =
	| { type: "set_razor_target"; targetId: string | null }
	| { type: "confirm" }
	| { type: "reset"; razorTargetId: string | null };

function bossCommandFormReducer(
	state: BossCommandFormState,
	action: BossCommandFormAction,
): BossCommandFormState {
	switch (action.type) {
		case "set_razor_target":
			return { ...state, razorTargetId: action.targetId };
		case "confirm":
			return { ...state, confirmed: true };
		case "reset":
			return { razorTargetId: action.razorTargetId, confirmed: false };
		default: {
			const _exhaustive: never = action;
			return _exhaustive;
		}
	}
}

interface Rect {
	top: number;
	left: number;
	width: number;
	height: number;
}

function measure(el: HTMLElement): Rect {
	const r = el.getBoundingClientRect();
	return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function PopoverShell({
	anchorEl,
	onDismiss,
	children,
}: {
	anchorEl: HTMLElement;
	onDismiss: () => void;
	children: React.ReactNode;
}) {
	const [, setReMeasureTick] = useState(0);
	const rect = measure(anchorEl);
	const popoverRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		function reMeasure() {
			setReMeasureTick((t) => t + 1);
		}
		window.addEventListener("resize", reMeasure);
		window.addEventListener("scroll", reMeasure, true);
		return () => {
			window.removeEventListener("resize", reMeasure);
			window.removeEventListener("scroll", reMeasure, true);
		};
	}, []);

	// wrapped so the listener effect below doesn't need onDismiss as a
	// dependency and re-subscribe every time the parent passes a new closure
	const onDismissEvent = useEffectEvent(onDismiss);

	useEffect(() => {
		function handlePointerDown(e: PointerEvent) {
			if (!popoverRef.current) return;
			if (!(e.target instanceof Node)) return;
			if (popoverRef.current.contains(e.target)) return;
			if (anchorEl.contains(e.target)) return;
			onDismissEvent();
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onDismissEvent();
		}
		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [anchorEl]);

	return createPortal(
		<div
			ref={popoverRef}
			className="fixed flex flex-col gap-2 rounded-xl border border-white/15 px-3 py-3 shadow-2xl shadow-black/70"
			style={{
				top: rect.top,
				left: Math.max(8, rect.left - 268),
				width: 260,
				zIndex: 1050,
				backgroundColor: "#0a0a0a",
				backgroundImage:
					"radial-gradient(circle at 50% 100%, transparent 20%, #071013 21%, #071013 34%, transparent 35%)",
				backgroundSize: "30px 22px",
			}}
		>
			{children}
		</div>,
		document.body,
	);
}

export function BossCommandControl({
	effectiveTarget,
	armedElsewhere,
	locked,
	runLocked,
}: {
	effectiveTarget: string | null;
	// true while TurnActionBar's picker is open; shares the same store
	armedElsewhere: boolean;
	locked: boolean;
	runLocked: (fn: () => void) => void;
}) {
	const { myPlayer, players, playerId, secret } = useFaceturnState();
	const openForPlayerId = useBossCommandPopoverStore((s) => s.openForPlayerId);
	const anchorEl = useBossCommandPopoverStore((s) => s.anchorEl);
	const closePopover = useBossCommandPopoverStore((s) => s.close);
	const isOpen = openForPlayerId === playerId && anchorEl !== null;

	// parent keys on effectiveTarget, so remount resets state
	const [formState, dispatch] = useReducer(bossCommandFormReducer, {
		razorTargetId: effectiveTarget,
		confirmed: false,
	});
	const { razorTargetId, confirmed } = formState;

	// hooks must run unconditionally; null session/closed popover is a no-op
	const bossId = myPlayer ? getBossDisplay(myPlayer.boss.id).id : null;
	const disabled = myPlayer ? myPlayer.boss.commandUsed || locked : true;
	const bossDisplay = myPlayer ? getBossDisplay(myPlayer.boss.id) : null;

	// once confirmed, the follow-up targeting (razor/dealer picker, or the
	// shared enemy-target picker for plain bosses) takes over from the popover
	function confirm() {
		dispatch({ type: "confirm" });
		closePopover();
	}

	// re-opening the popover (e.g. clicking the boss again after a dead-end
	// confirm) must clear stale confirmed/target state from the last attempt
	const wasOpenRef = useRef(isOpen);
	useEffect(() => {
		if (isOpen && !wasOpenRef.current) {
			dispatch({ type: "reset", razorTargetId: effectiveTarget });
		}
		wasOpenRef.current = isOpen;
	}, [isOpen, effectiveTarget]);

	// closing from outside (e.g. Escape) while unconfirmed just dismisses
	function dismiss() {
		if (!confirmed) closePopover();
	}

	type SlotWithIndex = NonNullable<typeof myPlayer>["crewSlots"][number] & {
		i: number;
	};
	const dealerFaceUpSlots: SlotWithIndex[] = myPlayer
		? myPlayer.crewSlots.reduce<SlotWithIndex[]>((acc, s, i) => {
				if (s.status === "face_up") acc.push({ ...s, i });
				return acc;
			}, [])
		: [];

	// server has no precomputed eligibleSlots for boss commands, session opens
	// only after the popover is confirmed and (for razor) a target is chosen
	useTargetPickerSite(
		bossId === "the-razor" &&
			confirmed &&
			!disabled &&
			!armedElsewhere &&
			razorTargetId
			? {
					mode: "single",
					eligible: razorTargets(razorTargetId),
					classGuess: true,
				}
			: null,
		(result) => {
			if (
				!result.target ||
				result.target.kind !== "crew" ||
				!result.guessClass ||
				!razorTargetId
			)
				return;
			const { target, guessClass } = result;
			runLocked(() => {
				sendFaceturnAction({
					type: "use_boss_command",
					targetPlayerId: target.playerId,
					targetCrewSlot: target.slotIndex,
					guessClass,
				});
			});
		},
	);

	useTargetPickerSite(
		bossId === "the-dealer" &&
			confirmed &&
			!disabled &&
			!armedElsewhere &&
			dealerFaceUpSlots.length > 0
			? {
					mode: "single",
					eligible: dealerTargets(
						dealerFaceUpSlots.map((s) => s.i),
						playerId,
					),
				}
			: null,
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			const { target } = result;
			runLocked(() => {
				sendFaceturnAction({
					type: "use_boss_command",
					targetAllySlot: target.slotIndex,
				});
			});
		},
	);

	if (!myPlayer || !bossDisplay) return null;
	// once confirmed, the popover UI itself is done — razor/dealer show their
	// own board-click follow-up via highlighted targets; plain bosses fire
	// immediately on confirm below
	if (!isOpen || confirmed) return null;

	const otherPlayers = players.filter((p) => p.id !== playerId);

	function confirmPlainBoss() {
		confirm();
		runLocked(() => {
			sendFaceturnAction({
				type: "use_boss_command",
				targetPlayerId: effectiveTarget ?? undefined,
			});
		});
	}

	if (bossId === "the-razor") {
		return (
			<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
				<span className="text-[10px] uppercase tracking-widest text-white/30">
					{bossDisplay.name} command
				</span>
				<p className="text-xs text-white/60">
					{bossDisplay.effectText.command}
				</p>
				{otherPlayers.length > 1 && (
					<TargetPicker
						players={otherPlayers}
						selectedId={razorTargetId}
						onSelect={(id) =>
							dispatch({ type: "set_razor_target", targetId: id })
						}
						accent="violet"
						dense
					/>
				)}
				<button
					type="button"
					disabled={disabled || !razorTargetId}
					onClick={confirm}
					className={cn(
						"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
						disabled || !razorTargetId
							? "border-white/10 text-white/20 cursor-not-allowed"
							: "border-violet-400/60 text-violet-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]",
					)}
				>
					Use command
				</button>
				<p className="text-[11px] text-white/40">
					{razorTargetId
						? "Then click one of their Crew, then choose a class."
						: "Pick an enemy target first."}
				</p>
			</PopoverShell>
		);
	}

	if (bossId === "the-dealer") {
		const hasReserve = Boolean(secret && secret.reserveCrewId !== null);
		const hasSwapTarget = dealerFaceUpSlots.length > 0;
		const dealerDisabled = disabled || !hasReserve || !hasSwapTarget;
		return (
			<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
				<span className="text-[10px] uppercase tracking-widest text-white/30">
					{bossDisplay.name} command
				</span>
				<p className="text-xs text-white/60">
					{bossDisplay.effectText.command}
				</p>
				<button
					type="button"
					disabled={dealerDisabled}
					onClick={confirm}
					className={cn(
						"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
						dealerDisabled
							? "border-white/10 text-white/20 cursor-not-allowed"
							: "border-violet-400/60 text-violet-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]",
					)}
				>
					Use command
				</button>
				<p className="text-[11px] text-white/40">
					{!hasReserve
						? "You have no reserved Crew to swap in."
						: !hasSwapTarget
							? "You need a face-up Crew on your board to swap out."
							: "Then click a face-up Crew on your board to swap with your reserve."}
				</p>
			</PopoverShell>
		);
	}

	return (
		<PopoverShell anchorEl={anchorEl} onDismiss={dismiss}>
			<span className="text-[10px] uppercase tracking-widest text-white/30">
				{bossDisplay.name} command
			</span>
			<p className="text-xs text-white/60">{bossDisplay.effectText.command}</p>
			<button
				type="button"
				disabled={disabled}
				onClick={confirmPlainBoss}
				className={cn(
					"px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
					disabled
						? "border-white/10 text-white/20 cursor-not-allowed"
						: "border-violet-400/60 text-violet-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]",
				)}
			>
				Use command
			</button>
		</PopoverShell>
	);
}