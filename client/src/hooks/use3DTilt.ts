import { useRef } from "react";

const CONFIG = {
	scale: 1.07,
	perspective: 700,
	rotateMultiplierX: 10,
	rotateMultiplierY: 12,
	transitionEnter: "transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1)",
	transitionMove: "transform 0.08s ease-out",
	transitionLeave: "transform 0.6s cubic-bezier(0.23, 1.2, 0.32, 1)",
};

export function use3DTilt<T extends HTMLElement>() {
	const ref = useRef<T>(null);

	const hasHover =
		typeof window !== "undefined" &&
		window.matchMedia("(hover: hover) and (pointer: fine)").matches;

	function onMouseEnter() {
		if (!hasHover || !ref.current) return;
		ref.current.style.transition = CONFIG.transitionEnter;
		ref.current.style.transform = `perspective(${CONFIG.perspective}px) rotateX(0deg) rotateY(0deg) scale(${CONFIG.scale})`;
	}

	function onMouseMove(e: React.MouseEvent<T>) {
		if (!hasHover || !ref.current) return;
		const rect = ref.current.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const dx = (e.clientX - cx) / (rect.width / 2);
		const dy = (e.clientY - cy) / (rect.height / 2);
		const rotateX = -dy * CONFIG.rotateMultiplierX;
		const rotateY = dx * CONFIG.rotateMultiplierY;
		ref.current.style.transition = CONFIG.transitionMove;
		ref.current.style.transform = `perspective(${CONFIG.perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${CONFIG.scale})`;
	}

	function onMouseLeave() {
		if (!hasHover || !ref.current) return;
		ref.current.style.transition = CONFIG.transitionLeave;
		ref.current.style.transform = `perspective(${CONFIG.perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
	}

	return { ref, onMouseEnter, onMouseMove, onMouseLeave };
}
