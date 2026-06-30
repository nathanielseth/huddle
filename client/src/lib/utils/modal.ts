import { createStore } from "zustand/vanilla";
import { generateUUID } from "./uuid";

export type ModalVariant = "alert" | "confirm" | "destructive";

export interface ModalEntry {
	id: string;
	variant: ModalVariant;
	title: string;
	body?: string;
	confirmLabel: string;
	cancelLabel: string | null;
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

interface ModalState {
	stack: ModalEntry[];
}

interface ModalActions {
	_push: (entry: ModalEntry) => void;
	_resolve: (id: string, value: boolean) => void;
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
				void Promise.resolve().then(() => { entry.resolve(value); });
			}
			return { stack: s.stack.filter((e) => e.id !== id) };
		});
	},

	_flush() {
		const { stack } = get();
		set({ stack: [] });
		for (const entry of stack) {
			void Promise.resolve().then(() => { entry.resolve(false); });
		}
	},
}));

function push(
	variant: ModalVariant,
	defaults: { confirmLabel: string; cancelLabel: string | null },
	opts: AlertOptions | ConfirmOptions,
): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const id = generateUUID();
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

export const modal = {
	alert(opts: AlertOptions): Promise<boolean> {
		return push("alert", { confirmLabel: "OK", cancelLabel: null }, opts);
	},
	confirm(opts: ConfirmOptions): Promise<boolean> {
		return push(
			"confirm",
			{ confirmLabel: "Confirm", cancelLabel: "Cancel" },
			opts,
		);
	},
	destructive(opts: ConfirmOptions): Promise<boolean> {
		return push(
			"destructive",
			{ confirmLabel: "Delete", cancelLabel: "Cancel" },
			opts,
		);
	},
	dismiss() {
		const top = modalStore.getState().stack[0];
		if (top) modalStore.getState()._resolve(top.id, false);
	},
	flush() {
		modalStore.getState()._flush();
	},
} as const;