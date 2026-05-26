import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
    socket = io(baseUrl, {
      transports: ["websocket"],
      path: "/socket.io"
    });
  }

  return socket;
};
