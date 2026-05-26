import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import { getLatestTelemetryByTags } from "../modules/telemetry/telemetry.service";
import {
  setSocketServer,
  TELEMETRY_ALL_ROOM,
  telemetryTagRoom
} from "../services/socket.manager";

const telemetrySubscribeSchema = z.object({
  tagIds: z.array(z.string().min(1)).max(250).optional(),
  all: z.boolean().optional()
});

const serializeTelemetryDocs = (
  docs: Awaited<ReturnType<typeof getLatestTelemetryByTags>>
) =>
  docs.map((doc) => ({
    ts: doc.ts.toISOString(),
    value: doc.value,
    quality: doc.quality,
    meta: doc.meta
  }));

export const createSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true }
  });

  setSocketServer(io);

  io.on("connection", (socket) => {
    logger.info({ id: socket.id }, "ws connected");

    socket.on("telemetry:subscribe", async (payload, ack) => {
      try {
        const parsed = telemetrySubscribeSchema.parse(payload ?? {});
        const currentRooms: string[] = Array.isArray(socket.data.telemetryRooms)
          ? socket.data.telemetryRooms
          : [];

        currentRooms.forEach((room) => socket.leave(room));

        const nextRooms = parsed.all
          ? [TELEMETRY_ALL_ROOM]
          : [...new Set(parsed.tagIds ?? [])].map(telemetryTagRoom);

        nextRooms.forEach((room) => socket.join(room));
        socket.data.telemetryRooms = nextRooms;

        const latest = parsed.all
          ? []
          : await getLatestTelemetryByTags([...new Set(parsed.tagIds ?? [])]);

        if (latest.length > 0) {
          socket.emit("telemetry:snapshot", {
            points: serializeTelemetryDocs(latest)
          });
        }

        if (typeof ack === "function") {
          ack({ ok: true, subscribed: nextRooms.length });
        }
      } catch (err) {
        logger.warn({ err, id: socket.id }, "invalid telemetry subscription");
        if (typeof ack === "function") {
          ack({ ok: false, error: "Invalid telemetry subscription" });
        }
      }
    });

    socket.on("disconnect", () => {
      logger.info({ id: socket.id }, "ws disconnected");
    });
  });

  return io;
};
