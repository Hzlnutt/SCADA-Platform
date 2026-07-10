import type { Server } from "socket.io";

let socketServer: Server | null = null;

export const TELEMETRY_ALL_ROOM = "telemetry:all";

export const telemetryTagRoom = (tagId: string) => `telemetry:tag:${tagId}`;

export const setSocketServer = (server: Server) => {
  socketServer = server;
};

export const getSocketServer = () => socketServer;

// --- IN-MEMORY CACHE FOR REALTIME TELEMETRY ---
const telemetryCache = new Map<string, any>();

export const updateTelemetryCache = (points: any[]) => {
  points.forEach((point) => {
    telemetryCache.set(point.meta.tagId, point);
  });
};

export const getTelemetryFromCache = (tagIds: string[]) => {
  const result: any[] = [];
  tagIds.forEach((tagId) => {
    const val = telemetryCache.get(tagId);
    if (val) {
      result.push(val);
    }
  });
  return result;
};
