import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
	BOSS_DISPLAY_MAP,
	CREW_DISPLAY_MAP,
	MOVE_DISPLAY_MAP,
	type BaseCardDisplay,
	type BossCardDisplay,
	type CrewCardDisplay,
	type MoveCardDisplay,
} from "@shared/games/face-turn/card-display";
import { Card, type CardProps } from "../../components/card/Card";
import {
	cardIdToCard,
	bossToCard,
	crewToCard,
	moveToCard,
} from "../../components/card/cardAdapters";
import { CARD_VARIANT_THEME } from "../../components/card/cardVariants";

// above the draft UI, below app-level modals (matches AppCardInspect's tier)
const PANEL_Z = 1200;

const CARD_COLUMN_SIZE = 400;
const SYNERGY_RENDER_SIZE = 120; // real Card render size, then scaled down visually
const SYNERGY_DISPLAY_SIZE = 76; // the footprint it should occupy in the rail
const SYNERGY_SCALE = SYNERGY_DISPLAY_SIZE / SYNERGY_RENDER_SIZE;

// fixed heights for each details section so the rail's overall height stays
// constant while cycling through cards, regardless of how much text or how
// many synergies a given card has — each section scrolls internally instead
// of resizing the layout
const EFFECTS_SECTION_HEIGHT = 200;
const FLAVOR_SECTION_HEIGHT = 22;
const SYNERGY_SECTION_HEIGHT = SYNERGY_DISPLAY_SIZE * 1.4 + 8;

export type DraftInspectTarget =
	| { kind: "boss"; display: BossCardDisplay }
	| { kind: "crew"; display: CrewCardDisplay }
	| { kind: "move"; display: MoveCardDisplay };

export interface DraftInspectCycle {
	readonly items: readonly DraftInspectTarget[];
	readonly index: number;
}

function targetToCard(target: DraftInspectTarget): CardProps {
	if (target.kind === "boss") return bossToCard(target.display);
	if (target.kind === "crew") return crewToCard(target.display);
	return moveToCard(target.display);
}

// resolves a synergyId back to a full inspect target (raw display data,
// not just CardProps) so clicking a synergy tile can show its own effects
// and its own synergies, exactly like any other card in the panel
function targetFromId(id: string): DraftInspectTarget | undefined {
	const boss = BOSS_DISPLAY_MAP.get(id);
	if (boss) return { kind: "boss", display: boss };
	const crew = CREW_DISPLAY_MAP.get(id);
	if (crew) return { kind: "crew", display: crew };
	const move = MOVE_DISPLAY_MAP.get(id);
	if (move) return { kind: "move", display: move };
	return undefined;
}

function targetTypeLabel(target: DraftInspectTarget): string {
	if (target.kind === "boss") return "Boss";
	if (target.kind === "crew")
		return CARD_VARIANT_THEME[target.display.class].label;
	return CARD_VARIANT_THEME[target.display.moveType].label;
}

function targetAccent(target: DraftInspectTarget): string {
	if (target.kind === "boss") return CARD_VARIANT_THEME.boss.accent;
	if (target.kind === "crew")
		return CARD_VARIANT_THEME[target.display.class].accent;
	return CARD_VARIANT_THEME[target.display.moveType].accent;
}

const TAG_BG: Record<"command" | "passive" | "revealed" | "primary", string> = {
	command: "#f5c542",
	passive: "#c99bf0",
	revealed: "#7fc4f0",
	primary: "#d9d9d9",
};

// scoped once via a real class name (not a shared/ambient one) so the
// hover-lift can't collide with anything else in the app, and can't
// silently fail to load the way a separate .css file previously did
const SYNERGY_HOVER_STYLE = `
.ft-inspect-synergy-thumb:hover {
	transform: translateY(-4px);
}
`;

function SectionLabel({ children }: { children: string }) {
	return (
		<p
			style={{
				margin: "0 0 6px",
				fontSize: 9,
				fontWeight: 900,
				textTransform: "uppercase",
				letterSpacing: "0.14em",
				color: "rgba(255,255,255,0.35)",
			}}
		>
			{children}
		</p>
	);
}

function EffectRow({
	label,
	tone,
	text,
}: {
	label: string;
	tone: "primary" | "revealed" | "passive" | "command";
	text: string;
}) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "10px 12px",
				borderRadius: 8,
				background: "rgba(255,255,255,0.04)",
				border: "1px solid rgba(255,255,255,0.08)",
			}}
		>
			{label && (
				<span
					style={{
						alignSelf: "flex-start",
						padding: "2px 8px",
						borderRadius: 4,
						fontSize: 10,
						fontWeight: 800,
						textTransform: "uppercase",
						letterSpacing: "0.08em",
						color: "#000",
						background: TAG_BG[tone],
					}}
				>
					{label}
				</span>
			)}
			<p
				style={{
					margin: 0,
					fontSize: 13,
					lineHeight: 1.5,
					color: "rgba(255,255,255,0.85)",
				}}
			>
				{text}
			</p>
		</div>
	);
}

function EffectRows({ target }: { target: DraftInspectTarget }) {
	if (target.kind === "boss") {
		return (
			<>
				<EffectRow
					label="Command"
					tone="command"
					text={target.display.effectText.command}
				/>
				<EffectRow
					label="Passive"
					tone="passive"
					text={target.display.effectText.passive}
				/>
			</>
		);
	}
	if (target.kind === "crew") {
		const { revealed, passive } = target.display.effectText;
		return (
			<>
				{revealed && (
					<EffectRow label="Revealed" tone="revealed" text={revealed} />
				)}
				{passive && <EffectRow label="Passive" tone="passive" text={passive} />}
			</>
		);
	}
	return (
		<EffectRow
			label={targetTypeLabel(target)}
			tone="primary"
			text={target.display.effectText}
		/>
	);
}

// real Card, rendered at a normal size then scaled down visually via CSS
// transform — this sidesteps Card's internal 88px minimum width floor,
// which a literal small pixel size (e.g. 56px) would get clamped up past
function SynergyThumb({
	card,
	onSelect,
}: {
	card: CardProps;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="ft-inspect-synergy-thumb"
			style={{
				width: SYNERGY_DISPLAY_SIZE,
				height: SYNERGY_DISPLAY_SIZE * 1.4,
				flexShrink: 0,
				overflow: "hidden",
				borderRadius: 6,
				padding: 0,
				border: "none",
				background: "none",
				cursor: "pointer",
				transition: "transform 0.08s ease-out",
			}}
		>
			<div
				style={{
					width: SYNERGY_RENDER_SIZE,
					transform: `scale(${SYNERGY_SCALE})`,
					transformOrigin: "top left",
					// @ts-expect-error -- custom CSS var
					"--card-vw-share": `${SYNERGY_RENDER_SIZE}px`,
				}}
			>
				<Card {...card} size={SYNERGY_RENDER_SIZE} />
			</div>
		</button>
	);
}

function SynergyRail({
	display,
	onSelect,
}: {
	display: BaseCardDisplay;
	onSelect: (id: string) => void;
}) {
	const synergyCards = useMemo(() => {
		const ids = display.synergyIds ?? [];
		return ids
			.map((id) => {
				const card = cardIdToCard(id);
				return card ? { id, card } : null;
			})
			.filter(
				(entry): entry is { id: string; card: CardProps } => entry !== null,
			);
	}, [display.synergyIds]);

	return (
		<div
			style={{ paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.08)" }}
		>
			<SectionLabel>Synergies</SectionLabel>
			<div
				className="ft-scroll"
				style={{
					height: SYNERGY_SECTION_HEIGHT,
					overflowY: "auto",
					display: "flex",
					flexWrap: "wrap",
					alignContent: "flex-start",
					gap: 8,
					// headroom so the hover-lift (translateY + scale) on a tile
					// isn't clipped by this container's own scroll edge
					paddingTop: 8,
					marginTop: -8,
				}}
			>
				{synergyCards.length > 0 ? (
					synergyCards.map(({ id, card }) => (
						<SynergyThumb key={id} card={card} onSelect={() => onSelect(id)} />
					))
				) : (
					<p
						style={{
							margin: 0,
							fontSize: 11.5,
							color: "rgba(255,255,255,0.25)",
						}}
					>
						No known synergies.
					</p>
				)}
			</div>
		</div>
	);
}

export function DraftInspectPanel({
	cycle,
	onClose,
	onStep,
}: {
	cycle: DraftInspectCycle;
	onClose: () => void;
	onStep: (delta: 1 | -1) => void;
}) {
	// clicking a synergy tile drills into that card's own inspect view,
	// pushed onto a local stack so "back" can return to where you came
	// from — this never touches the parent's cycle/tab state. Reset when
	// the parent hands us a different root cycle (adjusting state during
	// render, per React's recommended pattern, rather than in an effect)
	const [drillStack, setDrillStack] = useState<DraftInspectTarget[]>([]);
	const [lastCycle, setLastCycle] = useState(cycle);
	if (cycle !== lastCycle) {
		setLastCycle(cycle);
		setDrillStack([]);
	}
	const drilled = drillStack.length > 0;
	const target = drilled
		? drillStack[drillStack.length - 1]
		: cycle.items[cycle.index];
	const canGoPrev = !drilled && cycle.index > 0;
	const canGoNext = !drilled && cycle.index < cycle.items.length - 1;

	function handleSelectSynergy(id: string) {
		const next = targetFromId(id);
		if (next) setDrillStack((prev) => [...prev, next]);
	}

	function handleBack() {
		setDrillStack((prev) => prev.slice(0, -1));
	}

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				if (drilled) handleBack();
				else onClose();
			}
			if (e.key === "ArrowLeft" && canGoPrev) onStep(-1);
			if (e.key === "ArrowRight" && canGoNext) onStep(1);
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, onStep, canGoPrev, canGoNext, drilled]);

	if (!target) return null;

	const cardProps = targetToCard(target);
	const accent = targetAccent(target);

	return createPortal(
		<div
			className="fixed inset-0 flex items-center justify-center pointer-events-auto overflow-y-auto"
			style={{
				zIndex: PANEL_Z,
				background: "rgba(0,0,0,0.85)",
				backdropFilter: "blur(2px)",
			}}
			onClick={onClose}
			role="dialog"
			aria-modal="true"
		>
			<style>{SYNERGY_HOVER_STYLE}</style>

			<button
				type="button"
				onClick={onClose}
				aria-label="Close card inspection"
				className="fixed top-4 right-4 w-9 h-9 rounded-full border border-white/20 bg-black/80 text-white/70 text-lg font-bold flex items-center justify-center hover:text-white hover:border-white/40"
				style={{ zIndex: PANEL_Z + 1 }}
			>
				✕
			</button>

			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					gap: 32,
					maxWidth: "min(980px, 92vw)",
					margin: "auto",
					padding: "40px 0",
				}}
			>
				<div
					onClick={(e) => e.stopPropagation()}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 10,
						flexShrink: 0,
						// this is the only override Card's internal sizing clamp needs;
						// it's set inline here, not in an external stylesheet, so it
						// can never fail to load or be out of sync
						// @ts-expect-error -- custom CSS var
						"--card-vw-share": `${CARD_COLUMN_SIZE}px`,
					}}
				>
					<Card
						{...cardProps}
						size={CARD_COLUMN_SIZE}
						tiltOnHover
						selected={false}
					/>

					{drilled ? (
						<button
							type="button"
							onClick={handleBack}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 6,
								padding: "6px 12px",
								borderRadius: 999,
								border: "1px solid rgba(255,255,255,0.2)",
								background: "rgba(0,0,0,0.8)",
								color: "rgba(255,255,255,0.7)",
								fontSize: 11,
								fontWeight: 800,
								textTransform: "uppercase",
								letterSpacing: "0.06em",
								cursor: "pointer",
							}}
						>
							‹ Back
						</button>
					) : (
						cycle.items.length > 1 && (
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<button
									type="button"
									disabled={!canGoPrev}
									onClick={() => onStep(-1)}
									aria-label="Previous card"
									style={navBtnStyle(canGoPrev)}
								>
									‹
								</button>
								<span
									style={{
										fontSize: 10,
										fontWeight: 800,
										letterSpacing: "0.08em",
										color: "rgba(255,255,255,0.4)",
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{cycle.index + 1} / {cycle.items.length}
								</span>
								<button
									type="button"
									disabled={!canGoNext}
									onClick={() => onStep(1)}
									aria-label="Next card"
									style={navBtnStyle(canGoNext)}
								>
									›
								</button>
							</div>
						)
					)}
				</div>

				<div
					onClick={(e) => e.stopPropagation()}
					style={{
						width: 340,
						maxWidth: "46vw",
						display: "flex",
						flexDirection: "column",
						gap: 14,
					}}
				>
					<span
						style={{
							alignSelf: "flex-start",
							padding: "3px 10px",
							borderRadius: 999,
							border: "1px solid",
							fontSize: 10,
							fontWeight: 900,
							textTransform: "uppercase",
							letterSpacing: "0.12em",
							borderColor: `${accent}66`,
							backgroundColor: `${accent}26`,
							color: accent,
						}}
					>
						{targetTypeLabel(target)}
					</span>
					<h2
						style={{
							margin: 0,
							fontSize: 28,
							fontWeight: 900,
							color: "#fff",
							lineHeight: 1.15,
						}}
					>
						{target.display.name}
					</h2>

					<div>
						<SectionLabel>Flavor</SectionLabel>
						<div
							className="ft-scroll"
							style={{ height: FLAVOR_SECTION_HEIGHT, overflowY: "auto" }}
						>
							<p
								style={{
									margin: 0,
									fontSize: 12.5,
									fontStyle: "italic",
									color: "rgba(255,255,255,0.4)",
									lineHeight: 1.5,
								}}
							>
								{target.display.flavorText
									? `"${target.display.flavorText}"`
									: "—"}
							</p>
						</div>
					</div>

					<div>
						<SectionLabel>Effects</SectionLabel>
						<div
							className="ft-scroll"
							style={{
								height: EFFECTS_SECTION_HEIGHT,
								overflowY: "auto",
								display: "flex",
								flexDirection: "column",
								gap: 10,
							}}
						>
							<EffectRows target={target} />
						</div>
					</div>

					<SynergyRail
						display={target.display}
						onSelect={handleSelectSynergy}
					/>
				</div>
			</div>
		</div>,
		document.body,
	);
}

function navBtnStyle(enabled: boolean): React.CSSProperties {
	return {
		width: 28,
		height: 28,
		borderRadius: 999,
		border: `1px solid ${enabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"}`,
		background: enabled ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
		color: enabled ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
		fontSize: 15,
		fontWeight: 700,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		cursor: enabled ? "pointer" : "default",
	};
}