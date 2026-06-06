import { createStore } from "zustand/vanilla";

// types

export type ModalVariant = "alert" | "confirm" | "destructive";

export interface ModalEntry {
	id: string;
	variant: ModalVariant;
	title: string;
	body?: string;
	confirmLabel: string;
	cancelLabel: string | null; // single-button (alert)
	resolve: (value: boolean) => void;
}

export type AlertOptions = {
	title: string;
	body?: string;
	confirmLabel?: string;
};

export type ConfirmOptions = {
	title: string;
	body?: string;
	confirmLabel?: string;
	cancelLabel?: string;
};

// store

interface ModalState {
	stack: ModalEntry[];
}

interface ModalActions {
	_push: (entry: ModalEntry) => void;
	_resolve: (id: string, value: boolean) => void;
	// settle every pending entry as false
	_flush: () => void;
}

type ModalStore = ModalState & ModalActions;

export const modalStore = createStore<ModalStore>((set, get) => ({
	stack: [],

	_push(entry) {
		set((s) => ({ stack: [...s.stack, entry] }));
	},

	_resolve(id, value) {
		set((s) => {
			const entry = s.stack.find((e) => e.id === id);
			if (entry) {
				Promise.resolve().then(() => entry.resolve(value));
			}
			return { stack: s.stack.filter((e) => e.id !== id) };
		});
	},

	_flush() {
		// resolve every pending entry as false (cancelled / navigated away)
		const { stack } = get();
		set({ stack: [] });
		for (const entry of stack) {
			Promise.resolve().then(() => entry.resolve(false));
		}
	},
}));

// internal builder

function push(
	variant: ModalVariant,
	defaults: { confirmLabel: string; cancelLabel: string | null },
	opts: AlertOptions | ConfirmOptions,
): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const id = crypto.randomUUID();
		modalStore.getState()._push({
			id,
			variant,
			title: opts.title,
			body: opts.body,
			confirmLabel: opts.confirmLabel ?? defaults.confirmLabel,
			cancelLabel:
				"cancelLabel" in opts
					? (opts.cancelLabel ?? defaults.cancelLabel)
					: defaults.cancelLabel,
			resolve,
		});
	});
}

// public api

export const modal = {
	// single button
	alert(opts: AlertOptions): Promise<boolean> {
		return push("alert", { confirmLabel: "OK", cancelLabel: null }, opts);
	},

	// two-button choice
	confirm(opts: ConfirmOptions): Promise<boolean> {
		return push(
			"confirm",
			{ confirmLabel: "Confirm", cancelLabel: "Cancel" },
			opts,
		);
	},

	// auto-focuses cancel to prevent accidental destructive confirmations
	destructive(opts: ConfirmOptions): Promise<boolean> {
		return push(
			"destructive",
			{ confirmLabel: "Delete", cancelLabel: "Cancel" },
			opts,
		);
	},

	// programmatically dismiss the top modal (resolves false)
	dismiss() {
		const top = modalStore.getState().stack[0];
		if (top) modalStore.getState()._resolve(top.id, false);
	},

	// resolve every pending modal as false
	// call this in a router's beforeunload / onunmount hook so no promise hangs
	flush() {
		modalStore.getState()._flush();
	},
} as const;