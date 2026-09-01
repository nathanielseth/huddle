import { Card } from "../card/Card";
import { useCardHoverPreview } from "./cardHoverPreviewStore";

const PREVIEW_SIZE = 325;

export function CardPreviewDock() {
	const card = useCardHoverPreview();

	return (
		<div
			className="hidden lg:block absolute pointer-events-none z-20"
			style={{ right: "24px", bottom: "30px" }}
			aria-hidden={!card}
		>
			<div
				className="transition-all duration-150 ease-out"
				style={{
					opacity: card ? 1 : 0,
					transform: card
						? "translateX(0) scale(1)"
						: "translateX(12px) scale(0.97)",
				}}
			>
				{card && (
					<Card {...card} size={PREVIEW_SIZE} selected={false} armed={false} />
				)}
			</div>
		</div>
	);
}