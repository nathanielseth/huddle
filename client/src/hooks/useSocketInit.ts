import { useEffect } from "react";
import { socket } from "../lib/socket";
import { useGameStore } from "../store/useGameStore";
import { loadRoomSession } from "../lib/session";
import type { GameState } from "@shared/types";

// wires up all socket.io listeners and kicks off the initial connection
export function useSocketInit(): void {
	useEffect(() => {
		const store = () => useGameStore.getState();

		const onConnect = () => {
			store()._setStatus("connected");
			const session = loadRoomSession();
			if (session) store()._attemptRejoin(session);
		};
		const onDisconnect = () => store()._setStatus("disconnected");
		const onConnectError = () => {
			store()._setStatus("error");
			store()._setError("Could not connect to server.");
		};
		const onGameState = (state: GameState) => store()._syncState(state);
		const onRoomError = (msg: string) => store()._setError(msg);
		const onRoomClosed = () => store()._closeRoom();
		const onRejoinFailed = () => store()._closeRoom();
		const onPlayerSecret = (payload: unknown) => store()._setSecret(payload);
		const onReconnectAttempt = () => store()._setStatus("connecting");
		const onReconnectFailed = () =>
			store()._setError("Lost connection to server.");

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
