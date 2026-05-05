import { useEffect } from "react";
import { socket } from "../lib/socket";
import { useGameStore } from "../store/useGameStore";
import { toast } from "../lib/toast";
import { loadRoomSession } from "../lib/session";
import type { GameState } from "@shared/types";

const CONN_TOAST_ID = "conn-status";

export function useSocketInit(): void {
	useEffect(() => {
		const store = () => useGameStore.getState();

		let hasConnectedOnce = false;

		const onConnect = () => {
			const wasDisconnected = hasConnectedOnce;
			hasConnectedOnce = true;
			store()._setStatus("connected");

			if (wasDisconnected) {
				toast.success("Reconnected!", {
					id: CONN_TOAST_ID,
					duration: 2500,
				});
			}

			const session = loadRoomSession();
			if (session) store()._attemptRejoin(session);
		};

		const onDisconnect = () => {
			store()._setStatus("disconnected");
			toast.warning("Connection lost. Reconnecting…", {
				id: CONN_TOAST_ID,
				duration: 0,
			});
		};

		const onConnectError = () => {
			store()._setStatus("error");
			if (!hasConnectedOnce) {
				toast.error("Could not connect to server.", {
					id: CONN_TOAST_ID,
					duration: 0,
				});
			}
		};

		const onGameState = (state: GameState) => store()._syncState(state);
		const onRoomError = (msg: string) => toast.error(msg);
		const onRoomClosed = () => store()._closeRoom();
		const onRejoinFailed = () => store()._closeRoom();
		const onPlayerSecret = (payload: unknown) => store()._setSecret(payload);

		const onReconnectAttempt = () => {
			store()._setStatus("connecting");
			toast.warning("Connection lost. Reconnecting…", {
				id: CONN_TOAST_ID,
				duration: 0,
			});
		};

		const onReconnectFailed = () => {
			store()._setStatus("error");
			toast.error("Could not reconnect. Try refreshing.", {
				id: CONN_TOAST_ID,
				duration: 0,
			});
		};

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

		store().connect();
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
