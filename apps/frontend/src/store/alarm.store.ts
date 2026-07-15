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
  let changed = false;
  
  let configList: any[] = [];
  const saved = localStorage.getItem("scada.config.cooling-water-1");
  if (saved) {
    try {
      configList = JSON.parse(saved);
    } catch (e) {
      // ignore
    }
  }

  points.forEach((point) => {
    const tagId = point.meta?.tagId;
    if (!tagId) return;
    const value = point.value;

    const config = configList.find((x) => x.tagKey === tagId);
    const alarmKey = `pid-threshold:${tagId}`;

    if (!config || !config.enableAlert || typeof value !== "number") {
      if (next[alarmKey]) {
        delete next[alarmKey];
        changed = true;
      }
      return;
    }

    const warning = config.baseline;
    const alarm = config.highLimit;
    const direction = config.direction || "above";

    let status: "active" | "cleared" = "cleared";
    let severity: "medium" | "high" = "medium";
    let msg = "";

    if (direction === "above") {
      if (value >= alarm) {
        status = "active";
        severity = "high";
        msg = `[${config.tagName}] exceeds Alarm Limit of ${alarm} ${config.unit} (Current: ${value.toFixed(1)} ${config.unit})`;
      } else if (value >= warning) {
        status = "active";
        severity = "medium";
        msg = `[${config.tagName}] exceeds Warning Limit of ${warning} ${config.unit} (Current: ${value.toFixed(1)} ${config.unit})`;
      }
    } else {
      if (value <= alarm) {
        status = "active";
        severity = "high";
        msg = `[${config.tagName}] is below Alarm Limit of ${alarm} ${config.unit} (Current: ${value.toFixed(1)} ${config.unit})`;
      } else if (value <= warning) {
        status = "active";
        severity = "medium";
        msg = `[${config.tagName}] is below Warning Limit of ${warning} ${config.unit} (Current: ${value.toFixed(1)} ${config.unit})`;
      }
    }

    if (status === "active") {
      const existing = next[alarmKey];
      if (!existing || existing.severity !== severity || existing.message !== msg) {
        next[alarmKey] = {
          alarmKey,
          tagId,
          deviceId: "cooling-water-1",
          unit: "WF1U3",
          area: "Cooling Water System",
          message: msg,
          severity,
          status: "active",
          lastTs: new Date().toISOString()
        };
        changed = true;
      }
    } else {
      if (next[alarmKey]) {
        delete next[alarmKey];
        changed = true;
      }
    }
  });

  return changed;
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
