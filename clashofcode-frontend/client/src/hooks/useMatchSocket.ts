import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type MatchSocket = Socket;

const socketUrl =
  import.meta.env.VITE_MATCH_SERVER_URL || "http://localhost:4100";

export function useMatchSocket() {
  const socketRef = useRef<MatchSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
      auth: token ? { token } : undefined,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.connect();
    socketRef.current = socket;

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  return { socket: socketRef.current, connected };
}
