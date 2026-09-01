const BASE_MAX_ANGLE = 12;
const BASE_MAX_ANGLE_HOVER = 22;
const BASE_SPACING = 52;
const BASE_SPACING_HOVER = 78;
const BASE_ARC_LIFT = 24;
const BASE_ARC_LIFT_HOVER = 48;
const FAN_REFERENCE_COUNT = 6;
const FRONT_Z = 100;

export interface HandFanSlot {
	el: HTMLElement;
}

// avoid duplicate listeners on re-register of same element
const LISTENERS_ATTACHED = new WeakSet<HTMLElement>();

function getFanParams(count: number, uiScale: number) {
	const mid = (count - 1) / 2;
	const curveScale = count > 1 ? (count - 1) / (FAN_REFERENCE_COUNT - 1) : 0;
	const angleMax = BASE_MAX_ANGLE * curveScale;
	const angleHoverMax = BASE_MAX_ANGLE_HOVER * curveScale;
	const arcLift = BASE_ARC_LIFT * curveScale * uiScale;
	const arcLiftHover = BASE_ARC_LIFT_HOVER * curveScale * uiScale;
	const spacingFactor = count > 1 ? (FAN_REFERENCE_COUNT / count) ** 0.35 : 1;
	const spacing = BASE_SPACING * spacingFactor * uiScale;
	const spacingHover = BASE_SPACING_HOVER * spacingFactor * uiScale;
	return {
		mid,
		angleMax,
		angleHoverMax,
		arcLift,
		arcLiftHover,
		spacing,
		spacingHover,
	};
}

export class HandFanController {
	private slots: HandFanSlot[] = [];
	private handEl: HTMLElement;
	private uiScale = 1;
	private hasMeasured = false;
	private reducedMotion = false;
	private frontOwner: HTMLElement | null = null;
	private dragging = false;
	private resizeObserver: ResizeObserver | null = null;

	constructor(handEl: HTMLElement) {
		this.handEl = handEl;
		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(() => this.recomputeScale());
			this.resizeObserver.observe(handEl);
		}
		// first read can be zero before paint; confirm after paint
		this.recomputeScale();
		requestAnimationFrame(() => this.recomputeScale());
	}

	setReducedMotion(value: boolean) {
		this.reducedMotion = value;
		this.layout();
	}

	registerSlots(slots: HandFanSlot[]) {
		if (this.frontOwner && !slots.some((s) => s.el === this.frontOwner)) {
			this.frontOwner = null;
		}
		for (const slot of slots) {
			if (LISTENERS_ATTACHED.has(slot.el)) continue;
			LISTENERS_ATTACHED.add(slot.el);
			slot.el.addEventListener("transitionrun", (e) => {
				if (e.propertyName === "transform") {
					slot.el.classList.add("is-transitioning");
				}
			});
			slot.el.addEventListener("transitionend", (e) => {
				if (e.propertyName === "transform") {
					slot.el.classList.remove("is-transitioning");
				}
			});
			slot.el.addEventListener("transitioncancel", (e) => {
				if (e.propertyName === "transform") {
					slot.el.classList.remove("is-transitioning");
				}
			});
		}
		this.slots = slots;
		this.layout();
	}

	private recomputeScale() {
		const width = this.handEl.getBoundingClientRect().width;
		// skip zero width read before first paint
		if (width <= 0) return;
		const REFERENCE_WIDTH = 900;
		const next = Math.max(0.55, Math.min(1, width / REFERENCE_WIDTH));
		const changed = Math.abs(next - this.uiScale) > 0.001;
		if (changed || !this.hasMeasured) {
			this.uiScale = next;
			this.hasMeasured = true;
			this.layout();
		}
	}

	private layout() {
		const count = this.slots.length;
		const params = getFanParams(count, this.uiScale);
		this.slots.forEach((slot, i) => {
			const offset = i - params.mid;
			const angle =
				params.mid > 0 && !this.reducedMotion
					? (offset / params.mid) * (params.angleMax / 2)
					: 0;
			const angleHover =
				params.mid > 0 && !this.reducedMotion
					? (offset / params.mid) * (params.angleHoverMax / 2)
					: 0;
			const shift = this.reducedMotion ? 0 : offset * params.spacing;
			const shiftHover = this.reducedMotion ? 0 : offset * params.spacingHover;
			const lift =
				params.mid > 0 && !this.reducedMotion
					? (offset / params.mid) ** 2 * params.arcLift
					: 0;
			const liftHover =
				params.mid > 0 && !this.reducedMotion
					? (offset / params.mid) ** 2 * params.arcLiftHover
					: 0;

			const style = slot.el.style;
			style.setProperty("--shift", `${shift.toFixed(1)}px`);
			style.setProperty("--shift-hover", `${shiftHover.toFixed(1)}px`);
			style.setProperty("--rot", `${angle.toFixed(2)}deg`);
			style.setProperty("--rot-hover", `${angleHover.toFixed(2)}deg`);
			style.setProperty("--lift", `${lift.toFixed(1)}px`);
			style.setProperty("--lift-hover", `${liftHover.toFixed(1)}px`);
			slot.el.dataset.restZ = String(i);
			if (slot.el !== this.frontOwner) {
				style.setProperty("--z", String(i));
			}
		});
	}

	setHandHovering(hovering: boolean) {
		if (this.dragging) return;
		this.handEl.classList.toggle("is-hand-hovering", hovering);
		if (!hovering) this.clearFrontOwner();
	}

	focusSlot(slot: HandFanSlot) {
		if (this.dragging) return;
		if (this.frontOwner === slot.el) return;
		this.clearFrontOwner();
		this.frontOwner = slot.el;
		slot.el.classList.add("is-card-hovered");
		slot.el.style.setProperty("--z", String(FRONT_Z));
	}

	blurSlot(slot: HandFanSlot) {
		if (this.frontOwner !== slot.el) return;
		this.clearFrontOwner();
	}

	private clearFrontOwner() {
		if (!this.frontOwner) return;
		this.frontOwner.classList.remove("is-card-hovered");
		this.frontOwner.style.setProperty(
			"--z",
			this.frontOwner.dataset.restZ ?? "0",
		);
		this.frontOwner = null;
	}

	setDragging(dragging: boolean) {
		this.dragging = dragging;
		if (dragging) {
			this.handEl.classList.remove("is-hand-hovering");
			this.clearFrontOwner();
		}
	}

	destroy() {
		this.resizeObserver?.disconnect();
	}
}