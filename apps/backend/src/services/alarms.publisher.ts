import type { AlarmEventDoc } from "../modules/alarms/alarms.service";
import { getSocketServer } from "./socket.manager";

export const publishAlarmEvents = (events: AlarmEventDoc[]) => {
  const io = getSocketServer();
  if (!io || events.length === 0) {
    return;
  }

  const payload = events.map((event) => ({
    alarmKey: event.alarmKey,
    tagId: event.tagId,
    deviceId: event.deviceId,
    unit: event.unit,
    area: event.area,
    message: event.message,
    severity: event.severity,
    eventType: event.eventType,
    ts: event.ts.toISOString(),
    ack: event.ack
      ? { userId: event.ack.userId, note: event.ack.note, ts: event.ack.ts.toISOString() }
      : undefined,
    source: event.source
  }));

  io.emit("alarm:event", { events: payload });
};
