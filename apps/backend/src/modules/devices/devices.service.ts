import { TELEMETRY_COLLECTION } from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import type { TelemetryDoc } from "../telemetry/telemetry.service";
import { deviceCatalog } from "./devices.catalog";

export type DeviceStatus = "online" | "stale" | "unknown";

export type DeviceStatusEntry = {
  id: string;
  name: string;
  area: string;
  category: string;
  tagId?: string;
  unit?: string;
  status: DeviceStatus;
  lastTs?: string;
  lastValue?: number | string | boolean;
  quality?: "good" | "bad" | "uncertain";
  ageSeconds?: number;
};

const STALE_SECONDS = 60;

export const listDeviceStatus = async () => {
  const db = getMongoDb();
  const collection = db.collection<TelemetryDoc>(TELEMETRY_COLLECTION);

  const rows = await Promise.all(
    deviceCatalog.map(async (device) => {
      if (!device.tagId) {
        return { ...device, status: "unknown" } as DeviceStatusEntry;
      }

      const doc = await collection
        .find({ "meta.tagId": device.tagId })
        .sort({ ts: -1 })
        .limit(1)
        .next();

      if (!doc) {
        return { ...device, status: "unknown" } as DeviceStatusEntry;
      }

      const ageSeconds = Math.round((Date.now() - doc.ts.getTime()) / 1000);
      const status: DeviceStatus =
        ageSeconds <= STALE_SECONDS ? "online" : "stale";

      return {
        ...device,
        status,
        lastTs: doc.ts.toISOString(),
        lastValue: doc.value,
        quality: doc.quality,
        ageSeconds
      };
    })
  );

  return rows;
};
