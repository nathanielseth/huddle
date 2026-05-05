import { createStore } from "zustand/vanilla";

// types
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
	duration: number; // ms. 0 = persistent until manually dismissed
	createdAt: number;
}

export type ToastOptions = Partial<Pick<Toast, "id" | "duration" | "action">>;

// store
const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4000;

interface ToastState {
	// currently rendered toasts (max MAX_VISIBLE)
	toasts: Toast[];
	// overflow waiting to be promoted
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

function buildToast(
	variant: ToastVariant,
	message: string,
	opts: ToastOptions = {},
): Toast {
	return {
		id: opts.id ?? crypto.randomUUID(),
		variant,
		message,
		action: opts.action,
		duration: opts.duration ?? DEFAULT_DURATION,
		createdAt: Date.now(),
	};
}

export const toastStore = createStore<ToastStore>((set, get) => ({
	toasts: [],
	queue: [],

	_add(input) {
		const { toasts, queue } = get();

		// dedupe: if same id already exists, update in place
		const inVisible = toasts.some((t) => t.id === input.id);
		if (inVisible) {
			set((s) => ({
				toasts: s.toasts.map((t) =>
					t.id === input.id ? { ...t, ...input, createdAt: Date.now() } : t,
				),
			}));
			return input.id;
		}

		const inQueue = queue.some((t) => t.id === input.id);
		if (inQueue) {
			set((s) => ({
				queue: s.queue.map((t) => (t.id === input.id ? { ...t, ...input } : t)),
			}));
			return input.id;
		}

		// normal insertion
		const toast: Toast = { ...input, createdAt: Date.now() };

		if (toasts.length < MAX_VISIBLE) {
			set((s) => ({ toasts: [...s.toasts, toast] }));
		} else {
			set((s) => ({ queue: [...s.queue, toast] }));
		}

		return input.id;
	},

	_dismiss(id) {
		const { toasts, queue } = get();

		if (toasts.some((t) => t.id === id)) {
			const [next, ...rest] = queue;
			set((s) => ({
				toasts: [
					...s.toasts.filter((t) => t.id !== id),
					...(next ? [next] : []),
				],
				queue: next ? rest : s.queue,
			}));
			return;
		}

		if (queue.some((t) => t.id === id)) {
			set((s) => ({
				queue: s.queue.filter((t) => t.id !== id),
			}));
		}
	},

	_update(id, patch) {
		set((s) => ({
			toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
		}));
	},
}));

// imperative API
function add(
	variant: ToastVariant,
	message: string,
	opts?: ToastOptions,
): string {
	const resolved = opts?.id ?? crypto.randomUUID();
	return toastStore
		.getState()
		._add(buildToast(variant, message, { ...opts, id: resolved }));
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
