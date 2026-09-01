import { useEffect, useRef } from "react";

function clamp(value: number, min = 0, max = 100) {
	return Math.min(Math.max(value, min), max);
}

function round(value: number, precision = 3) {
	const f = 10 ** precision;
	return Math.round(value * f) / f;
}

function adjust(
	value: number,
	fromMin: number,
	fromMax: number,
	toMin: number,
	toMax: number,
) {
	return round(
		toMin + ((value - fromMin) * (toMax - toMin)) / (fromMax - fromMin),
	);
}

interface FoilTarget {
	px: number;
	py: number;
	fromCenter: number;
	rotateX: number;
	rotateY: number;
	bgX: number;
	bgY: number;
}

const RESTING: FoilTarget = {
	px: 50,
	py: 50,
	fromCenter: 0,
	rotateX: 0,
	rotateY: 0,
	bgX: 50,
	bgY: 50,
};

export function useFoilHover<T extends HTMLElement>(enabled: boolean) {
	const ref = useRef<T | null>(null);
	const target = useRef<FoilTarget>({ ...RESTING });
	const current = useRef<FoilTarget>({ ...RESTING });
	const rafId = useRef<number | null>(null);
	const tickRef = useRef<() => void>(() => {});

	useEffect(() => {
		tickRef.current = () => {
			const el = ref.current;
			const t = target.current;
			const c = current.current;
			const k = 0.2; // approximates the original spring stiffness
			(Object.keys(t) as (keyof FoilTarget)[]).forEach((key) => {
				c[key] = round(c[key] + (t[key] - c[key]) * k);
			});

			if (el) {
				el.style.setProperty("--foil-px", `${c.px}%`);
				el.style.setProperty("--foil-py", `${c.py}%`);
				el.style.setProperty("--foil-from-center", `${c.fromCenter}`);
				el.style.setProperty("--foil-rotate-x", `${c.rotateX}deg`);
				el.style.setProperty("--foil-rotate-y", `${c.rotateY}deg`);
				el.style.setProperty("--foil-bg-x", `${c.bgX}%`);
				el.style.setProperty("--foil-bg-y", `${c.bgY}%`);
			}

			const settled = (Object.keys(t) as (keyof FoilTarget)[]).every(
				(key) => Math.abs(t[key] - c[key]) < 0.05,
			);
			if (!settled) {
				rafId.current = requestAnimationFrame(() => tickRef.current());
			} else {
				rafId.current = null;
			}
		};
	});

	function kick() {
		if (rafId.current === null) {
			rafId.current = requestAnimationFrame(() => tickRef.current());
		}
	}

	function onPointerMove(e: React.PointerEvent<HTMLElement>) {
		if (!enabled) return;
		const el = ref.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const absolute = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const percent = {
			x: clamp(round((100 / rect.width) * absolute.x)),
			y: clamp(round((100 / rect.height) * absolute.y)),
		};
		const center = { x: percent.x - 50, y: percent.y - 50 };

		target.current = {
			px: percent.x,
			py: percent.y,
			fromCenter: clamp(
				Math.sqrt(center.x * center.x + center.y * center.y) / 50,
				0,
				1,
			),
			rotateX: round(-(center.x / 3.5)),
			rotateY: round(center.y / 3.5),
			// wider remap than reference to make the sweep travel more on flat color cards
			bgX: adjust(percent.x, 0, 100, 10, 90),
			bgY: adjust(percent.y, 0, 100, 5, 95),
		};
		el.classList.add("foil-interacting");
		kick();
	}

	function onPointerLeave() {
		if (!enabled) return;
		const el = ref.current;
		target.current = { ...RESTING };
		el?.classList.remove("foil-interacting");
		kick();
	}

	useEffect(() => {
		return () => {
			const id = rafId.current;
			if (id !== null) cancelAnimationFrame(id);
		};
	}, []);

	// direct DOM writes avoid React re-renders at pointermove frequency
	return { ref, onPointerMove, onPointerLeave };
}