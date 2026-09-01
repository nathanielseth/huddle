import type { ReactNode } from "react";
import { BoardRecede } from "../scene/PhaseScene";

export function GameScreen({
	board,
	hud,
	rail,
	recedeActive = false,
	recedeIntensity = "full",
}: {
	board: ReactNode;
	hud: ReactNode;
	rail?: ReactNode;
	recedeActive?: boolean;
	recedeIntensity?: "full" | "light";
}) {
	return (
		<div
			className="relative w-full ft-app-bg overflow-hidden"
			style={{
				height: "100dvh",
				overscrollBehavior: "contain",
				touchAction: "none",
			}}
		>
			<BoardRecede active={recedeActive} intensity={recedeIntensity}>
				<div
					className={
						rail
							? "absolute top-0 left-0 bottom-0 right-0 lg:right-(--rail-inset)"
							: "absolute inset-0"
					}
				>
					{board}
				</div>

				<div
					className={
						rail
							? "absolute top-0 left-0 bottom-0 right-0 lg:right-(--rail-inset) z-10 flex flex-col pointer-events-none"
							: "absolute inset-0 z-10 flex flex-col pointer-events-none"
					}
					style={{ pointerEvents: "none" }}
				>
					{hud}
				</div>
			</BoardRecede>

			{rail && (
				<div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-end lg:flex-row lg:justify-end">
					<div className="pointer-events-auto lg:h-full">{rail}</div>
				</div>
			)}
		</div>
	);
}