import { useEffect, useRef, useState } from "react";
import "./card.css";
import { BOSS_TITLE_ICON } from "./bossTitleIcons";
import { CARD_VARIANT_ICON } from "./cardIconRegistry";
import { CARD_VARIANT_THEME, type CardVariant } from "./cardVariants";
import { useFoilHover } from "./useFoilHover";
import { FaceTurnLogo } from "./ftLogo";

const BADGE_NUMBER_FONT_BY_LENGTH: Record<number, string> = {
	1: "11.1cqw",
	2: "10.1cqw",
	3: "9.3cqw",
};

export const CARD_MIN_WIDTH_PX = 88;

// restart edge-fade animation on flip change, skipping the initial mount
function useFlipTransitionClass(flipped: boolean): boolean {
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [prevFlipped, setPrevFlipped] = useState(flipped);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// drop the class immediately during render so its removal commits
	// before the effect below re-adds it on the next paint
	const justFlipped = flipped !== prevFlipped;
	if (justFlipped) {
		setPrevFlipped(flipped);
		setIsTransitioning(false);
	}

	useEffect(() => {
		if (!justFlipped) return;
		if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
		// double rAF so class removal commits before re-add
		const raf1 = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				setIsTransitioning(true);
				timeoutRef.current = setTimeout(() => setIsTransitioning(false), 700);
			});
		});
		return () => cancelAnimationFrame(raf1);
	}, [justFlipped]);

	useEffect(
		() => () => {
			if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
		},
		[],
	);

	return isTransitioning;
}

const FLIP_TRANSITION_MS = 300;

function useLatchedPreviewOnly(previewOnly: boolean): boolean {
	const [prevPreviewOnly, setPrevPreviewOnly] = useState(previewOnly);
	const [dimmed, setDimmed] = useState(previewOnly);

	if (previewOnly !== prevPreviewOnly) {
		setPrevPreviewOnly(previewOnly);
		if (previewOnly) setDimmed(true);
	}

	useEffect(() => {
		if (previewOnly || !dimmed) return;
		const timeout = setTimeout(() => setDimmed(false), FLIP_TRANSITION_MS);
		return () => clearTimeout(timeout);
	}, [previewOnly, dimmed]);

	return dimmed;
}

export interface CardAbility {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly tone?: "primary" | "secondary" | "revealed" | "passive" | "command";
}

export interface CardProps {
	readonly variant: CardVariant;
	readonly bossId?: string;
	readonly title: string;
	readonly abilities: readonly CardAbility[];
	readonly flavorText?: string;
	readonly artSrc?: string;
	readonly artAlt?: string;
	readonly badgeLabel?: string;
	readonly badgeText?: string;
	readonly flipped?: boolean;
	readonly previewOnly?: boolean;
	readonly size?: number;
	readonly selected?: boolean;
	readonly armed?: boolean;
	readonly playable?: boolean;
	readonly disabled?: boolean;
	readonly onClick?: () => void;
	readonly className?: string;
	readonly debugStyle?: React.CSSProperties;
	readonly tiltOnHover?: boolean;
	readonly halfCard?: boolean;
}

export function Card({
	variant,
	bossId,
	title,
	abilities,
	flavorText,
	artSrc,
	artAlt = "Card art",
	badgeLabel,
	badgeText,
	flipped = false,
	previewOnly = false,
	size = 378,
	selected = false,
	armed = false,
	playable = false,
	disabled = false,
	onClick,
	className,
	debugStyle,
	tiltOnHover = false,
	halfCard = false,
}: CardProps) {
	const theme = CARD_VARIANT_THEME[variant];
	const BadgeIcon = CARD_VARIANT_ICON[variant];
	const TitleBarIcon = bossId ? BOSS_TITLE_ICON[bossId] : undefined;
	const {
		ref: tiltRef,
		onPointerMove: tiltOnPointerMove,
		onPointerLeave: tiltOnPointerLeave,
	} = useFoilHover<HTMLDivElement>(tiltOnHover);
	const isFlipTransitioning = useFlipTransitionClass(flipped);
	const isPreviewDimmed = useLatchedPreviewOnly(previewOnly);

	const style = {
		"--card-accent": theme.accent,
		"--card-accent-secondary": theme.accentSecondary,
		"--card-body": theme.cardBg,
		"--card-badge-circle": theme.badgeCircle,
		"--card-title-bar-bg": theme.titleBarBg,
		"--card-title-bar-pattern": theme.titleBarPattern,
		"--card-title-bar-icon-color": theme.titleBarIconColor,
		"--card-title-bar-text": theme.titleBarText,
		"--card-text-box-bg": theme.textBoxBg,
		"--card-text-box-text": theme.textBoxText,
		"--badge-tail-text": theme.accent,
		...(badgeText !== undefined
			? {
					"--badge-number-font":
						BADGE_NUMBER_FONT_BY_LENGTH[badgeText.length] ??
						BADGE_NUMBER_FONT_BY_LENGTH[3],
				}
			: {}),
		width: `clamp(${CARD_MIN_WIDTH_PX}px, var(--card-vw-share, 46vw), ${size}px)`,
		...debugStyle,
	} as React.CSSProperties;

	const interactive = Boolean(onClick) && !disabled;

	const classes = [
		"flip-container",
		flipped && "is-flipped",
		isPreviewDimmed && "is-preview-only",
		playable && "is-playable",
		selected && "is-selected",
		armed && "is-armed-target",
		disabled && "is-disabled",
		interactive && "is-interactive",
		tiltOnHover && "foil-tilt",
		halfCard && "is-half-card",
	]
		.filter(Boolean)
		.join(" ");

	const inner = (
		<div className="flip-perspective">
			<div className="flip-inner">
				<div className="tcg-card" data-variant={variant} data-boss={bossId}>
					{!halfCard && (
						<div className="badge">
							<div className="badge-circle">
								{badgeText !== undefined ? (
									<span className="badge-number">{badgeText}</span>
								) : (
									<BadgeIcon className="badge-icon" />
								)}
							</div>
							<div className="badge-tail">
								<span>{badgeLabel ?? theme.label}</span>
							</div>
						</div>
					)}

					<CardArt artSrc={artSrc} artAlt={artAlt} />

					{!halfCard && (
						<>
							<div className="title-bar">
								{TitleBarIcon && <TitleBarIcon className="title-bar-icon" />}
								<h1>{title}</h1>
							</div>

							<div className="text-box">
								{abilities.map((ability) => (
									<div className="ability-row" key={ability.id}>
										<span className={`tag tag-${ability.tone ?? "primary"}`}>
											<span>{ability.label}</span>
										</span>{" "}
										{ability.description}
									</div>
								))}
								{flavorText && (
									<div className="flavor-text">&quot;{flavorText}&quot;</div>
								)}
							</div>
						</>
					)}

					{/* full-card foil layers, dark pass uses screen blend */}
					<div className="foil-shine" />
					<div className="foil-glare" />
					<div className="foil-glare-dark" />
				</div>

				<div className="tcg-card-back">
					<div
						className={`back-panel${isFlipTransitioning ? " is-flip-transitioning" : ""}`}
					>
						<FaceTurnLogo className="back-panel-logo" />
					</div>
				</div>
			</div>
		</div>
	);

	const card = onClick ? (
		// real button for focus/keyboard/disabled semantics
		<button
			type="button"
			className={classes}
			style={style}
			disabled={disabled}
			aria-pressed={selected}
			onClick={interactive ? onClick : undefined}
		>
			{inner}
		</button>
	) : (
		<div className={classes} style={style}>
			{inner}
		</div>
	);

	return (
		<div
			ref={tiltOnHover ? tiltRef : undefined}
			className={`cf-body-font${tiltOnHover ? " tilt-hover" : ""}${className ? ` ${className}` : ""}`}
			onPointerMove={tiltOnHover ? tiltOnPointerMove : undefined}
			onPointerLeave={tiltOnHover ? tiltOnPointerLeave : undefined}
		>
			{tiltOnHover ? (
				// perspective wrapper needed for foil structure
				<div className="foil-translater">{card}</div>
			) : (
				card
			)}
		</div>
	);
}

function CardArt({ artSrc, artAlt }: { artSrc?: string; artAlt: string }) {
	if (!artSrc) {
		return (
			<div className="art-section no-art">
				<PlaceholderMark />
			</div>
		);
	}
	return (
		<div className="art-section">
			<img
				src={artSrc}
				alt={artAlt}
				draggable={false}
				onError={(e) => {
					// hide broken image, section background reads fine
					e.currentTarget.style.display = "none";
				}}
			/>
		</div>
	);
}

function PlaceholderMark() {
	return (
		<svg
			className="art-placeholder-icon"
			viewBox="0 0 100 100"
			fill="none"
			stroke="#ffffff"
			strokeWidth="3"
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect x="10" y="10" width="80" height="80" rx="8" />
			<circle cx="35" cy="38" r="9" />
			<path
				d="M14 78 L38 54 L56 68 L72 48 L90 66"
				strokeLinejoin="round"
				fill="none"
			/>
		</svg>
	);
}