import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const devFallback = "http://localhost:3001";
    const prodFallback = typeof window !== "undefined" ? window.location.origin : "";
    const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? devFallback : prodFallback);
    socket = io(baseUrl, {
      transports: ["websocket"],
      path: "/socket.io"
    });
  }

  return socket;
};
