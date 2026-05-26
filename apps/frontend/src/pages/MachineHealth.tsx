import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { machineGroups } from "../data/machines";
import { getJson } from "../services/api.client";
import { useTelemetryStore } from "../store/telemetry.store";

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

type GroupHealth = {
  id: string;
  name: string;
  status: HealthStatus;
  message: string;
  thresholdText?: string;
  actionText?: string | null;
  units: Array<{
    id: string;
    label: string;
    tagId: string;
    status: HealthStatus;
    value?: number;
    unit?: string;
    message: string;
  }>;
};

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

const buildStatus = (
  value: number | null,
  threshold?: ThresholdItem
): { status: HealthStatus; message: string; thresholdText?: string } => {
  if (value === null || !threshold) {
    return { status: "unknown", message: "No threshold data" };
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

const buildThresholdText = (threshold?: ThresholdItem) => {
  if (!threshold) {
    return undefined;
  }

  const upperText = threshold.upper !== null && threshold.upper !== undefined
    ? `${threshold.upper.toFixed(2)} ${threshold.unit}`
    : null;
  const lowerText = threshold.lower !== null && threshold.lower !== undefined
    ? `${threshold.lower.toFixed(2)} ${threshold.unit}`
    : null;

  if (upperText && lowerText) {
    return `Batas atas ${upperText} · batas bawah ${lowerText}`;
  }

  if (upperText) {
    return `Batas atas ${upperText}`;
  }

  if (lowerText) {
    return `Batas bawah ${lowerText}`;
  }

  return undefined;
};

export default function MachineHealth() {
  const latest = useTelemetryStore((state) => state.latest);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);

  useEffect(() => {
    getJson<ThresholdListResponse>("/thresholds")
      .then((result) => setThresholds(result.data))
      .catch(() => setThresholds([]));
  }, []);

  const healthRows = useMemo(() => {
    return machineGroups.map((group) => {
      const threshold = thresholds.find((item) => item.groupId === group.id);
      const units = group.units.map((unit) => {
        const raw = latest[unit.tagId]?.value;
        const value = typeof raw === "number" ? raw : null;
        const statusResult = buildStatus(value, threshold);

        return {
          id: unit.id,
          label: unit.unitLabel,
          tagId: unit.tagId,
          status: statusResult.status,
          value: value ?? undefined,
          unit: threshold?.unit ?? unit.unit,
          message: statusResult.message
        };
      });

      const statuses = units.map((unit) => unit.status);
      const status = statuses.includes("critical")
        ? "critical"
        : statuses.includes("warning")
        ? "warning"
        : statuses.every((item) => item === "unknown")
        ? "unknown"
        : "healthy";

      const warningCount = statuses.filter((item) => item === "warning").length;
      const criticalCount = statuses.filter((item) => item === "critical").length;
      const message =
        criticalCount > 0
          ? `${criticalCount} unit kritis, ${warningCount} unit warning.`
          : warningCount > 0
          ? `${warningCount} unit warning.`
          : "Semua unit dalam batas aman.";

      const thresholdText = buildThresholdText(threshold);

      return {
        id: group.id,
        name: group.name,
        status,
        message,
        thresholdText,
        actionText: threshold?.actionText ?? null,
        units
      } satisfies GroupHealth;
    });
  }, [latest, thresholds]);

  const statusClasses: Record<HealthStatus, string> = {
    healthy: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
    warning: "bg-amber-500/15 text-amber-200 border-amber-500/40",
    critical: "bg-red-500/15 text-red-200 border-red-500/40",
    unknown: "bg-slate-700/30 text-slate-300 border-slate-600"
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machine Health"
        description="Pantau status threshold dan rekomendasi tindakan untuk tiap group." 
      />

      <div className="grid gap-5">
        {healthRows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {row.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">{row.message}</div>
                {row.thresholdText ? (
                  <div className="mt-2 text-xs text-slate-500">
                    {row.thresholdText}
                  </div>
                ) : null}
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClasses[row.status]}`}
              >
                {row.status.toUpperCase()}
              </div>
            </div>

            {row.actionText ? (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                {row.actionText}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {row.units.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-100">
                      {unit.label}
                    </div>
                    <div
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses[unit.status]}`}
                    >
                      {unit.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {unit.message}
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-100">
                    {unit.value !== undefined
                      ? `${unit.value.toFixed(2)} ${unit.unit ?? ""}`
                      : "No data"}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {unit.tagId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
