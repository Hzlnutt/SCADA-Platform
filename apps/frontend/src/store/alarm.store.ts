import { create } from "zustand";
import { useTelemetryStore, type TelemetryPoint } from "./telemetry.store";

export type AlarmEvent = {
  alarmKey: string;
  tagId: string;
  deviceId?: string;
  unit?: string;
  area?: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  eventType: "active" | "ack" | "clear";
  ts: string;
};

export type AlarmItem = {
  alarmKey: string;
  tagId: string;
  deviceId?: string;
  unit?: string;
  area?: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "ack";
  lastTs: string;
};

type AlarmState = {
  activeByKey: Record<string, AlarmItem>;
  activeList: AlarmItem[];
  setActive: (alarms: AlarmItem[]) => void;
  pushEvents: (events: AlarmEvent[]) => void;
  updatePidAlarms: (points: TelemetryPoint[]) => void;
  reEvaluateAllAlarms: () => void;
};

const runEvaluation = (next: Record<string, AlarmItem>, points: TelemetryPoint[]): boolean => {
  return false;
};

export const useAlarmStore = create<AlarmState>((set) => ({
  activeByKey: {},
  activeList: [],
  setActive: (alarms) =>
    set(() => {
      const next: Record<string, AlarmItem> = {};
      alarms.forEach((alarm) => {
        next[alarm.alarmKey] = alarm;
      });

      const activeList = Object.values(next).sort(
        (a, b) => new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime()
      );

      return { activeByKey: next, activeList };
    }),
  pushEvents: (events) =>
    set((state) => {
      const next = { ...state.activeByKey };

      events.forEach((event) => {
        if (event.eventType === "clear") {
          delete next[event.alarmKey];
        } else {
          const status = event.eventType === "ack" ? "ack" : "active";
          next[event.alarmKey] = {
            alarmKey: event.alarmKey,
            tagId: event.tagId,
            deviceId: event.deviceId,
            unit: event.unit,
            area: event.area,
            message: event.message,
            severity: event.severity,
            status,
            lastTs: event.ts
          };
        }
      });

      const activeList = Object.values(next).sort(
        (a, b) => new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime()
      );

      return { activeByKey: next, activeList };
    }),
  updatePidAlarms: (points) =>
    set((state) => {
      const next = { ...state.activeByKey };
      const changed = runEvaluation(next, points);
      if (!changed) return {};

      const activeList = Object.values(next).sort(
        (a, b) => new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime()
      );
      return { activeByKey: next, activeList };
    }),
  reEvaluateAllAlarms: () =>
    set((state) => {
      const next = { ...state.activeByKey };
      const latest = useTelemetryStore.getState().latest;
      const points = Object.values(latest);
      const changed = runEvaluation(next, points);
      if (!changed) return {};

      const activeList = Object.values(next).sort(
        (a, b) => new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime()
      );
      return { activeByKey: next, activeList };
    })
}));
