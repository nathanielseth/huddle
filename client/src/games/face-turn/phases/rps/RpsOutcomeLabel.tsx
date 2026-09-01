import { cn } from "../../../../lib/utils/cn";

export function RpsOutcomeLabel({ outcome }: { outcome: "win" | "lose" }) {
	return (
		<p
			className={cn(
				"ft-eyebrow text-lg font-black tracking-wide",
				outcome === "win" ? "text-sky-400" : "text-rose-500",
			)}
		>
			{outcome === "win" ? "Win" : "Lose"}
		</p>
	);
}
