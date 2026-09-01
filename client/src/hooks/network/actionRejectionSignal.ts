// Tiny external pub/sub, outside React state, that fires once per
// "action_rejected" socket event (see useSocketInit.ts). useActionLock
// subscribes to this when asked (see its `releaseOnRejection` option) so a
// locked action bar can release the moment the server tells us why it
// rejected the last thing we sent, instead of always waiting out the fixed
// timeout with no explanation. Kept as a bare listener array rather than
// zustand: this only ever needs "notify everyone listening right now", no
// stored value, no selectors.

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeToActionRejection(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

// called once from useSocketInit.ts's action_rejected handler. Deliberately
// takes no payload — the toast in useSocketInit already shows the reason,
// this channel only needs to say "something you sent just got rejected,
// stop waiting."
export function pulseActionRejection(): void {
	for (const listener of listeners) listener();
}