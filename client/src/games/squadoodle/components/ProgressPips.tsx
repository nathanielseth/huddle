import { cn } from "../../../lib/utils/cn";

interface Props {
	submitted: number;
	total: number;
}

export function ProgressPips({ submitted, total }: Props) {
	return (
		<div className="flex gap-2 items-center justify-center">
			{Array.from({ length: total }, (_, i) => (
				<span
					key={i}
					className={cn(
						"w-2.5 h-2.5 rounded-full transition-colors duration-300",
						i < submitted ? "bg-indigo-400" : "bg-white/15",
					)}
				/>
			))}
		</div>
	);
}
