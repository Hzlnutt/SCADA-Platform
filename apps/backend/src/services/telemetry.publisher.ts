import type { TelemetryDoc } from "../modules/telemetry/telemetry.service";
import {
  getSocketServer,
  TELEMETRY_ALL_ROOM,
  telemetryTagRoom
} from "./socket.manager";

export const publishTelemetry = (docs: TelemetryDoc[]) => {
  const io = getSocketServer();
  if (!io || docs.length === 0) {
    return;
  }

  const points = docs.map((doc) => ({
    ts: doc.ts.toISOString(),
    value: doc.value,
    quality: doc.quality,
    meta: doc.meta
  }));

  io.to(TELEMETRY_ALL_ROOM).emit("telemetry:update", { points });

  points.forEach((point) => {
    io.to(telemetryTagRoom(point.meta.tagId)).emit("telemetry:update", {
      points: [point]
    });
  });
};
