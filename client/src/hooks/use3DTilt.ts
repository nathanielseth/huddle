import { useRef, useEffect } from "react";

const hasHover =
	typeof window !== "undefined" &&
	window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
	!window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const DEFAULTS = {
	scale: 1.05,
	perspective: 800,
	rotateX: 10,
	rotateY: 12,
	transitionEnter: "transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1)",
	transitionMove: "transform 0.1s ease-out",
	transitionLeave: "transform 0.5s cubic-bezier(0.23, 1.2, 0.32, 1)",
} as const;

type TiltConfig = Partial<typeof DEFAULTS>;

export function use3DTilt<T extends HTMLElement>(config?: TiltConfig) {
	const ref = useRef<T>(null);
	const raf = useRef<number | null>(null);

	const cfg = { ...DEFAULTS, ...config };

	useEffect(() => {
		return () => {
			if (raf.current !== null) cancelAnimationFrame(raf.current);
		};
	}, []);

	const onMouseEnter = () => {
		if (!hasHover || !ref.current) return;

		ref.current.style.willChange = "transform";
		ref.current.style.transition = cfg.transitionEnter;
		ref.current.style.transform = `perspective(${cfg.perspective}px) rotateX(0deg) rotateY(0deg) scale(${cfg.scale})`;
	};

	const onMouseMove = (e: React.MouseEvent<T>) => {
		if (!hasHover || !ref.current) return;

		const rect = ref.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const dx = (x - rect.width / 2) / (rect.width / 2);
		const dy = (y - rect.height / 2) / (rect.height / 2);

		if (raf.current !== null) cancelAnimationFrame(raf.current);

		raf.current = requestAnimationFrame(() => {
			if (!ref.current) return;
			ref.current.style.transition = cfg.transitionMove;
			ref.current.style.transform = `perspective(${cfg.perspective}px) rotateX(${-dy * cfg.rotateX}deg) rotateY(${dx * cfg.rotateY}deg) scale(${cfg.scale})`;
			ref.current.style.setProperty("--mouse-x", `${x}px`);
			ref.current.style.setProperty("--mouse-y", `${y}px`);
		});
	};

	const onMouseLeave = () => {
		if (!hasHover || !ref.current) return;
		if (raf.current !== null) cancelAnimationFrame(raf.current);

		ref.current.style.transition = cfg.transitionLeave;
		ref.current.style.transform = `perspective(${cfg.perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
		ref.current.style.setProperty("--mouse-x", "-9999px");
		ref.current.style.setProperty("--mouse-y", "-9999px");

		ref.current.addEventListener(
			"transitionend",
			() => {
				if (ref.current) ref.current.style.willChange = "auto";
			},
			{ once: true },
		);
	};

	return { ref, onMouseEnter, onMouseMove, onMouseLeave };
}
