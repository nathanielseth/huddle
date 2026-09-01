import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

const baseIconProps = {
	fill: "#ffffff",
	stroke: "#000000",
	strokeWidth: 3,
	strokeLinejoin: "round" as const,
	xmlns: "http://www.w3.org/2000/svg",
};

export function SwordIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 16 16" {...baseIconProps} strokeWidth={0} {...props}>
			<path d="M16 0H13L3.71 9.29L2.21 7.79L0.79 9.21L3.09 11.5L1.58 13C0.67 13 0 13.67 0 14.5C0 15.33 0.67 16 1.5 16C2.33 16 3 15.33 3 14.5C3 14.47 3 14.44 3 14.42L4.5 12.91L6.79 15.21L8.21 13.79L6.71 12.29L16 3V0Z" />
		</svg>
	);
}

export function ShieldIcon(props: IconProps) {
	return (
		<svg viewBox="3 2 18 20" {...baseIconProps} strokeWidth={0} {...props}>
			<path d="M12 22c-1.148 0-3.418-1.362-5.13-3.34C4.44 15.854 3 11.967 3 7a1 1 0 0 1 .629-.929c3.274-1.31 5.88-2.613 7.816-3.903a1 1 0 0 1 1.11 0c1.935 1.29 4.543 2.594 7.816 3.903A1 1 0 0 1 21 7c0 4.968-1.44 8.855-3.87 11.66C15.419 20.637 13.149 22 12 22z" />
		</svg>
	);
}

export function CoinIcon(props: IconProps) {
	return (
		<svg viewBox="2 2 20 20" {...baseIconProps} strokeWidth={0} {...props}>
			<circle cx="12" cy="12" r="9.5" />

			<path
				fill="#287A4D"
				stroke="none"
				d="M8.5 14v2H11v2h2v-2h1a2.5 2.5 0 1 0 0-5h-4a.5.5 0 1 1 0-1h5.5V8H13V6h-2v2h-1a2.5 2.5 0 0 0 0 5h4a.5.5 0 1 1 0 1H8.5z"
			/>
		</svg>
	);
}

export function SwapIcon(props: IconProps) {
	return (
		<svg viewBox="2 2 22 22" {...baseIconProps} strokeWidth={0} {...props}>
			<path d="M13.5,2A8.5,8.5,0,0,0,5,10.5V14H3a1,1,0,0,0-.77,1.64l5,6a1,1,0,0,0,1.54,0l5-6A1,1,0,0,0,13,14H11V10.5a2.5,2.5,0,0,1,5,0V21a1,1,0,0,0,1,1h4a1,1,0,0,0,1-1V10.5A8.51,8.51,0,0,0,13.5,2Z" />
		</svg>
	);
}

export function CrownIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<path d="M10 40 L28 55 L50 22 L72 55 L90 40 L82 78 H18 Z" />
			<circle cx="50" cy="14" r="7" />
		</svg>
	);
}

export function LoopIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<path
				d="M50 15 A35 35 0 1 1 15 50"
				fill="none"
				stroke="#000000"
				strokeWidth="10"
				strokeLinecap="round"
			/>
			<path d="M15 32 L15 50 L33 50 Z" />
		</svg>
	);
}

export function BurstIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<path d="M50 6 L61 38 L94 40 L67 60 L78 92 L50 72 L22 92 L33 60 L6 40 L39 38 Z" />
		</svg>
	);
}

export function HourglassIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<path d="M22 10 H78 V26 L54 50 L78 74 V90 H22 V74 L46 50 L22 26 Z" />
		</svg>
	);
}

export function QuestionMarkIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<path
				d="M32 36 C32 22 44 14 54 16 C64 18 72 26 70 38 C68 48 58 50 55 58 L55 64"
				fill="none"
				stroke="#000000"
				strokeWidth="9"
				strokeLinecap="round"
			/>
			<circle cx="55" cy="80" r="6" fill="#ffffff" stroke="none" />
		</svg>
	);
}

export function HandIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<g strokeLinejoin="round">
				<rect
					x="16"
					y="26"
					width="34"
					height="52"
					rx="4"
					transform="rotate(-18 33 52)"
				/>
				<rect x="33" y="22" width="34" height="52" rx="4" />
				<rect
					x="50"
					y="26"
					width="34"
					height="52"
					rx="4"
					transform="rotate(18 67 52)"
				/>
			</g>
		</svg>
	);
}

export function DeckIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<rect x="14" y="24" width="58" height="42" rx="5" opacity="0.55" />
			<rect x="20" y="16" width="58" height="42" rx="5" opacity="0.8" />
			<rect x="26" y="8" width="58" height="42" rx="5" />
		</svg>
	);
}

export function PoisonIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<path d="M50 10 C28 10 14 26 14 46 C14 60 21 70 30 76 L30 88 H70 L70 76 C79 70 86 60 86 46 C86 26 72 10 50 10 Z" />
			<circle cx="36" cy="46" r="8" fill="#000000" stroke="none" />
			<circle cx="64" cy="46" r="8" fill="#000000" stroke="none" />
			<path
				d="M40 88 L40 96 M50 88 L50 98 M60 88 L60 96"
				fill="none"
				stroke="#000000"
				strokeWidth="5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function DiscardIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<path d="M22 30 H78 L72 88 H28 Z" strokeLinejoin="round" />
			<path
				d="M14 30 H86 M38 30 L42 14 H58 L62 30"
				fill="none"
				stroke="#000000"
				strokeWidth="6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M40 42 L42 76 M50 42 L50 76 M60 42 L58 76"
				fill="none"
				stroke="#000000"
				strokeWidth="4"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function MutedIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 100 100" {...baseIconProps} {...props}>
			<circle cx="50" cy="50" r="38" />
			<path
				d="M20 20 L80 80"
				fill="none"
				stroke="#000000"
				strokeWidth="10"
				strokeLinecap="round"
			/>
		</svg>
	);
}