import { createStore } from "zustand/vanilla";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface Toast {
	id: string;
	variant: ToastVariant;
	message: string;
	action?: ToastAction;
	duration: number; // ms — 0 means persistent (no auto-dismiss)
	createdAt: number; // used to trigger timer resets on dedup updates
}

export type ToastOptions = Partial<Pick<Toast, "id" | "duration" | "action">>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4000;

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

interface ToastState {
	toasts: Toast[];
	queue: Toast[];
}

interface ToastActions {
	_add: (input: Omit<Toast, "createdAt">) => string;
	_dismiss: (id: string) => void;
	_update: (
		id: string,
		patch: Partial<Pick<Toast, "message" | "variant" | "action">>,
	) => void;
}

type ToastStore = ToastState & ToastActions;

export const toastStore = createStore<ToastStore>((set) => ({
	toasts: [],
	queue: [],

	_add(input) {
		set((s) => {
			// ── Deduplicate: already visible → update in place and bump createdAt
			// to reset the timer in ToastItem.
			if (s.toasts.some((t) => t.id === input.id)) {
				return {
					toasts: s.toasts.map((t) =>
						t.id === input.id ? { ...t, ...input, createdAt: Date.now() } : t,
					),
				};
			}

			// ── Deduplicate: waiting in queue → update quietly (no timer reset
			// needed since it hasn't started yet).
			if (s.queue.some((t) => t.id === input.id)) {
				return {
					queue: s.queue.map((t) =>
						t.id === input.id ? { ...t, ...input } : t,
					),
				};
			}

			const toast: Toast = { ...input, createdAt: Date.now() };

			if (s.toasts.length < MAX_VISIBLE) {
				return { toasts: [...s.toasts, toast] };
			}

			return { queue: [...s.queue, toast] };
		});

		return input.id;
	},

	_dismiss(id) {
		// Everything happens inside set() so we always read the latest state
		// atomically — no separate get() call that could race with another action.
		set((s) => {
			const isVisible = s.toasts.some((t) => t.id === id);

			if (isVisible) {
				// Pull the next queued toast into the visible slot being freed.
				const [next, ...rest] = s.queue;
				return {
					toasts: [
						...s.toasts.filter((t) => t.id !== id),
						...(next ? [next] : []),
					],
					queue: next ? rest : s.queue,
				};
			}

			if (s.queue.some((t) => t.id === id)) {
				return { queue: s.queue.filter((t) => t.id !== id) };
			}

			// ID not found — no-op.
			return s;
		});
	},

	_update(id, patch) {
		set((s) => ({
			// Patch both visible and queued — silently ignoring queued toasts was
			// a previous bug.
			toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
			queue: s.queue.map((t) => (t.id === id ? { ...t, ...patch } : t)),
		}));
	},
}));

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

// `createdAt` is set exclusively inside `_add` so callers never need to
// supply it. `id` is resolved here (not in buildToast) so the returned id
// is always the one that ends up in the store.
function add(
	variant: ToastVariant,
	message: string,
	opts: ToastOptions = {},
): string {
	const id = opts.id ?? crypto.randomUUID();
	return toastStore.getState()._add({
		id,
		variant,
		message,
		action: opts.action,
		duration: opts.duration ?? DEFAULT_DURATION,
	});
}

export const toast = {
	success: (msg: string, opts?: ToastOptions) => add("success", msg, opts),
	error: (msg: string, opts?: ToastOptions) => add("error", msg, opts),
	warning: (msg: string, opts?: ToastOptions) => add("warning", msg, opts),
	info: (msg: string, opts?: ToastOptions) => add("info", msg, opts),
	dismiss: (id: string) => toastStore.getState()._dismiss(id),
	update: (
		id: string,
		patch: Partial<Pick<Toast, "message" | "variant" | "action">>,
	) => toastStore.getState()._update(id, patch),
} as const;
