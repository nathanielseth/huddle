import { useEffect } from "react";
import { socket } from "../../lib/network/socket";
import { useGameStore } from "../../app/store";
import { toast } from "../../lib/utils/toast";
import { loadRoomSession } from "../../lib/network/session";
import type { GameState } from "@shared/types";

const CONN_TOAST_ID = "conn-status";

// call this before socket.disconnect() to suppress the spurious warning toast
// e.g. when the user intentionally leaves a room
export function markIntentionalDisconnect() {
	_intentional = true;
}

let _intentional = false;

export function useSocketInit(): void {
	useEffect(() => {
		const getStore = () => useGameStore.getState();
		let hasConnectedOnce = false;

		const onConnect = () => {
			const wasDisconnected = hasConnectedOnce;
			hasConnectedOnce = true;
			getStore()._setStatus("connected");

			toast.dismiss(CONN_TOAST_ID);

			if (wasDisconnected) {
				toast.success("Reconnected!", { id: CONN_TOAST_ID, duration: 2500 });
			}

			const session = loadRoomSession();
			if (session) getStore()._attemptRejoin(session);
		};

		const onDisconnect = () => {
			getStore()._setStatus("disconnected");

			if (_intentional) {
				// user-triggered — no toast needed
				_intentional = false;
				return;
			}

			// don't show a toast here — onReconnectAttempt fires immediately after
			// and is the right place for it. showing here would cause a double-set
			// on the same id within the same tick.
		};

		const onConnectError = () => {
			getStore()._setStatus("error");

			// only show on the very first attempt — after that onReconnectAttempt covers it
			if (!hasConnectedOnce) {
				toast.error("Could not connect to server.", {
					id: CONN_TOAST_ID,
					duration: 0,
				});
			}
		};

		const onReconnectAttempt = () => {
			getStore()._setStatus("connecting");
			toast.warning("Connection lost. Reconnecting…", {
				id: CONN_TOAST_ID,
				duration: 0,
			});
		};

		const onReconnectFailed = () => {
			getStore()._setStatus("error");
			toast.error("Could not reconnect.", {
				id: CONN_TOAST_ID,
				duration: 0,
				action: {
					label: "Refresh",
					onClick: () => window.location.reload(),
				},
			});
		};

		const onGameState = (state: GameState) => getStore()._syncState(state);
		const onRoomError = (msg: string) => toast.error(msg);
		const onRoomClosed = () => getStore()._closeRoom();
		const onRejoinFailed = () => getStore()._closeRoom();
		const onPlayerSecret = (payload: unknown) => getStore()._setSecret(payload);

		socket.on("connect", onConnect);
		socket.on("disconnect", onDisconnect);
		socket.on("connect_error", onConnectError);
		socket.on("game_state", onGameState);
		socket.on("room_error", onRoomError);
		socket.on("room_closed", onRoomClosed);
		socket.on("rejoin_failed", onRejoinFailed);
		socket.on("player_secret", onPlayerSecret);
		socket.io.on("reconnect_attempt", onReconnectAttempt);
		socket.io.on("reconnect_failed", onReconnectFailed);

		getStore().connect();

		if (socket.connected) onConnect();

		return () => {
			socket.off("connect", onConnect);
			socket.off("disconnect", onDisconnect);
			socket.off("connect_error", onConnectError);
			socket.off("game_state", onGameState);
			socket.off("room_error", onRoomError);
			socket.off("room_closed", onRoomClosed);
			socket.off("rejoin_failed", onRejoinFailed);
			socket.off("player_secret", onPlayerSecret);
			socket.io.off("reconnect_attempt", onReconnectAttempt);
			socket.io.off("reconnect_failed", onReconnectFailed);
		};
	}, []);
}
