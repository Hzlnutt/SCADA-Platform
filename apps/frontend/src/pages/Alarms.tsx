import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { getJson, postJson } from "../services/api.client";
import { machineGroups } from "../data/machines";
import { useAlarmStore, type AlarmEvent, type AlarmItem } from "../store/alarm.store";
import { useTelemetryStore } from "../store/telemetry.store";

type AlarmActiveResponse = {
  data: Array<{
    alarmKey: string;
    tagId: string;
    deviceId?: string;
    unit?: string;
    area?: string;
    message: string;
    severity: "low" | "medium" | "high" | "critical";
    status: "active" | "ack";
    lastTs: string;
  }>;
};

const severityStyle: Record<AlarmItem["severity"], string> = {
  low: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  critical: "bg-rose-500/10 text-rose-300 border-rose-500/30"
};

const formatTime = (ts?: string) => {
  if (!ts) return "-";
  const date = new Date(ts);
  return date.toLocaleString();
};

type ThresholdItem = {
  groupId: string;
  groupName: string;
  metric: string;
  unit: string;
  tagIds: string[];
  lower: number | null;
  upper: number | null;
  warningPct: number;
  actionText?: string | null;
};

type ThresholdListResponse = {
  data: ThresholdItem[];
};

type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

const metricLabelMap: Record<string, string> = {
  kwh: "energi",
  kw: "daya",
  pressure: "tekanan",
  temperature: "suhu",
  flow: "debit",
  vibration: "getaran"
};

const formatMetric = (metric?: string) =>
  metric ? metricLabelMap[metric] ?? metric : "parameter";

const buildHealthStatus = (
  value: number | null,
  threshold?: ThresholdItem
): { status: HealthStatus; message: string; thresholdText?: string } => {
  if (value === null || !threshold) {
    return { status: "unknown", message: "Tidak ada data threshold" };
  }

  const upper = threshold.upper ?? null;
  const lower = threshold.lower ?? null;
  const warnPct = threshold.warningPct ?? 0.9;
  const metric = formatMetric(threshold.metric);
  const upperText = upper !== null ? `${upper.toFixed(2)} ${threshold.unit}` : null;
  const lowerText = lower !== null ? `${lower.toFixed(2)} ${threshold.unit}` : null;
  const thresholdText = upperText && lowerText
    ? `Batas atas ${upperText} · batas bawah ${lowerText}`
    : upperText
    ? `Batas atas ${upperText}`
    : lowerText
    ? `Batas bawah ${lowerText}`
    : undefined;

  if (upper !== null && value >= upper) {
    return {
      status: "critical",
      message: `Machine melewati ambang batas ${metric} atas.`,
      thresholdText
    };
  }
  if (lower !== null && value <= lower) {
    return {
      status: "critical",
      message: `Machine melewati ambang batas ${metric} bawah.`,
      thresholdText
    };
  }
  if (upper !== null && value >= upper * warnPct) {
    return {
      status: "warning",
      message: `Machine mendekati ambang batas ${metric} atas.`,
      thresholdText
    };
  }
  if (lower !== null && value <= lower / warnPct) {
    return {
      status: "warning",
      message: `Machine mendekati ambang batas ${metric} bawah.`,
      thresholdText
    };
  }

  return { status: "healthy", message: "Dalam batas threshold", thresholdText };
};

export default function Alarms() {
  const setActive = useAlarmStore((state) => state.setActive);
  const activeList = useAlarmStore((state) => state.activeList);
  const pushEvents = useAlarmStore((state) => state.pushEvents);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const latest = useTelemetryStore((state) => state.latest);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);

  useEffect(() => {
    let mounted = true;

    getJson<AlarmActiveResponse>("/alarms/active?limit=200")
      .then((result) => {
        if (!mounted) return;
        const items: AlarmItem[] = result.data.map((alarm) => ({
          alarmKey: alarm.alarmKey,
          tagId: alarm.tagId,
          deviceId: alarm.deviceId,
          unit: alarm.unit,
          area: alarm.area,
          message: alarm.message,
          severity: alarm.severity,
          status: alarm.status,
          lastTs: alarm.lastTs
        }));
        setActive(items);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [setActive]);

  useEffect(() => {
    getJson<ThresholdListResponse>("/thresholds")
      .then((result) => setThresholds(result.data))
      .catch(() => setThresholds([]));
  }, []);

  const totalActive = useMemo(
    () => activeList.filter((alarm) => alarm.status !== "ack").length,
    [activeList]
  );

  const healthAlerts = useMemo(() => {
    return machineGroups
      .map((group) => {
        const threshold = thresholds.find((item) => item.groupId === group.id);
        const tagIds = threshold?.tagIds ?? group.units.map((unit) => unit.tagId);
        const values = tagIds
          .map((tagId) => latest[tagId]?.value)
          .filter((value): value is number => typeof value === "number");
        const value = values.length > 0
          ? values.reduce((sum, val) => sum + val, 0) / values.length
          : null;
        const statusResult = buildHealthStatus(value, threshold);
        return {
          id: group.id,
          name: group.name,
          status: statusResult.status,
          value,
          unit: threshold?.unit ?? group.units[0]?.unit,
          message: statusResult.message,
          thresholdText: statusResult.thresholdText,
          actionText: threshold?.actionText
        };
      })
      .filter((item) => item.status === "warning" || item.status === "critical");
  }, [latest, thresholds]);

  const handleAck = async (alarm: AlarmItem) => {
    setBusyKey(alarm.alarmKey);
    try {
      await postJson("/alarms/ack", {
        alarmKey: alarm.alarmKey,
        userId: "operator-demo",
        note: "ack from console"
      });

      const ackEvent: AlarmEvent = {
        alarmKey: alarm.alarmKey,
        tagId: alarm.tagId,
        deviceId: alarm.deviceId,
        unit: alarm.unit,
        area: alarm.area,
        message: alarm.message,
        severity: alarm.severity,
        eventType: "ack",
        ts: new Date().toISOString()
      };
      pushEvents([ackEvent]);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Alarm Console"
        description="Acknowledge, filter, and review active alarms."
      />
      {healthAlerts.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Machine Health Alerts
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {healthAlerts.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>{item.name}</span>
                  <span className="text-xs text-amber-300">{item.status.toUpperCase()}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {item.message}
                </div>
                {item.thresholdText ? (
                  <div className="mt-1 text-xs text-slate-500">
                    {item.thresholdText}
                  </div>
                ) : null}
                <div className="mt-2 text-xs text-slate-500">
                  {item.value !== null && item.value !== undefined
                    ? `${item.value.toFixed(2)} ${item.unit ?? ""}`
                    : "No data"}
                </div>
                {item.actionText ? (
                  <div className="mt-2 text-xs text-slate-400">
                    {item.actionText}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mb-4 text-xs text-slate-400">
        Active alarms: <span className="text-slate-200">{totalActive}</span>
      </div>
      <div className="rounded-2xl border border-slate-900 bg-slate-950/60 p-4">
        {loading ? (
          <div className="text-sm text-slate-400">Loading alarms...</div>
        ) : activeList.length === 0 ? (
          <div className="text-sm text-slate-400">No active alarms.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Alarm</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last Update</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {activeList.map((alarm) => (
                  <tr key={alarm.alarmKey} className="text-slate-200">
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium">
                        {alarm.message}
                      </div>
                      <div className="text-xs text-slate-400">
                        {alarm.tagId} {alarm.unit ? `(${alarm.unit})` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-xs",
                          severityStyle[alarm.severity]
                        ].join(" ")}
                      >
                        {alarm.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs capitalize">
                      {alarm.status}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {formatTime(alarm.lastTs)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={busyKey === alarm.alarmKey || alarm.status === "ack"}
                        onClick={() => handleAck(alarm)}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {alarm.status === "ack" ? "Acked" : "Acknowledge"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
