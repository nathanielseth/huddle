import { useEffect } from "react";
import { socket } from "../../lib/network/socket";
import { useGameStore } from "../../app/store";
import { toast } from "../../lib/utils/toast";
import { loadRoomSession } from "../../lib/network/session";
import type { GameState } from "@shared/core/room";

const CONN_TOAST_ID = "conn-status";

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
				_intentional = false;
				return;
			}
		};

		const onConnectError = () => {
			getStore()._setStatus("error");
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
					onClick: () => { window.location.reload(); },
				},
			});
		};

		const onGameState = (state: GameState) => { getStore()._syncState(state); };
		const onRoomError = (msg: string) => toast.error(msg);
		const onRoomClosed = () => { getStore()._closeRoom(); };
		const onRoomAbandoned = (msg: string) => {
			getStore()._abandonRoom(msg);
			toast.error(msg, { duration: 6000 });
		};
		const onKicked = () => {
			toast.error("You were removed from the room by the host.");
			getStore()._closeRoom();
		};
		const onRejoinFailed = () => { getStore()._closeRoom(); };
		const onPlayerSecret = (payload: unknown) => { getStore()._setSecret(payload); };

		socket.on("connect", onConnect);
		socket.on("disconnect", onDisconnect);
		socket.on("connect_error", onConnectError);
		socket.on("game_state", onGameState);
		socket.on("room_error", onRoomError);
		socket.on("room_closed", onRoomClosed);
		socket.on("room_abandoned", onRoomAbandoned);
		socket.on("kicked", onKicked);
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
			socket.off("room_abandoned", onRoomAbandoned);
			socket.off("kicked", onKicked);
			socket.off("rejoin_failed", onRejoinFailed);
			socket.off("player_secret", onPlayerSecret);
			socket.io.off("reconnect_attempt", onReconnectAttempt);
			socket.io.off("reconnect_failed", onReconnectFailed);
		};
	}, []);
}