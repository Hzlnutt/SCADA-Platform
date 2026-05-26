import type { Server } from "socket.io";

let socketServer: Server | null = null;

export const TELEMETRY_ALL_ROOM = "telemetry:all";

export const telemetryTagRoom = (tagId: string) => `telemetry:tag:${tagId}`;

export const setSocketServer = (server: Server) => {
  socketServer = server;
};

export const getSocketServer = () => socketServer;
