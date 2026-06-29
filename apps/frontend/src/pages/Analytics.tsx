import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { DonutChart } from "../components/charts/DonutChart";
import { getJson } from "../services/api.client";

type AnalyticsSummary = {
  kpi: {
    oee: number;
    availability: number;
    performance: number;
    quality: number;
  };
  telemetryPointsLastHour: number;
  alarmEventsLastDay: number;
  activeAlarmCount: number;
  deviceStatus: {
    online: number;
    stale: number;
    unknown: number;
  };
  alarmsBySeverity: Array<{ severity: string; count: number }>;
  telemetryByArea: Array<{ area: string; count: number }>;
};

type AnalyticsResponse = {
  data: AnalyticsSummary;
};

// SVG circular gauge ring component
const GaugeRing = ({ value, label, detail, color }: { value: number; label: string; detail: string; color: string }) => {
  const pct = Math.round(value * 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value * circumference);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col items-center gap-3 shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="relative">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} strokeWidth="7" fill="none" className="stroke-slate-100 dark:stroke-slate-800" />
          <circle
            cx="50" cy="50" r={radius}
            strokeWidth="7" fill="none"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-slate-800 dark:text-white font-mono">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500">{detail}</div>
      </div>
    </div>
  );
};

// Mini sparkline component
const Sparkline = ({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 120;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={areaPoints} fill={color} opacity="0.1" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Severity color map
const severityConfig: Record<string, { bg: string; text: string; bar: string }> = {
  critical: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
  high: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
  warning: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  medium: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  low: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-600 dark:text-sky-400", bar: "bg-sky-500" },
  info: { bg: "bg-slate-50 dark:bg-slate-800/50", text: "text-slate-600 dark:text-slate-400", bar: "bg-slate-400" },
};

// Simulated 7-day sparkline data
const weeklyTelemetry = [12400, 15200, 13800, 16100, 14500, 17200, 15800];
const weeklyAlarms = [8, 5, 12, 3, 7, 4, 6];
const weekLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    getJson<AnalyticsResponse>("/analytics/summary").then((result) => {
      if (mounted) {
        setSummary(result.data);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!summary) {
    return (
      <div>
        <PageHeader title="Analytics" description="OEE, KPI, and operational efficiency dashboards." />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  const deviceTotal = summary.deviceStatus.online + summary.deviceStatus.stale + summary.deviceStatus.unknown;
  const maxAlarm = Math.max(...summary.alarmsBySeverity.map(a => a.count), 1);
  const maxArea = Math.max(...summary.telemetryByArea.map(a => a.count), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="OEE, KPI, and operational efficiency dashboards." />

      {/* KPI GAUGE RINGS */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <GaugeRing value={summary.kpi.oee} label="OEE" detail="Overall Equipment Effectiveness" color="#06b6d4" />
        <GaugeRing value={summary.kpi.availability} label="Availability" detail="Equipment uptime ratio" color="#10b981" />
        <GaugeRing value={summary.kpi.performance} label="Performance" detail="Throughput efficiency" color="#6366f1" />
        <GaugeRing value={summary.kpi.quality} label="Quality" detail="Alarm-weighted score" color="#f59e0b" />
      </div>

      {/* DATA VOLUME + WEEKLY TREND */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Data Volume */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-semibold mb-4">Data Volume</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="font-mono text-2xl font-bold text-slate-800 dark:text-white">
                    {summary.telemetryPointsLastHour.toLocaleString("id-ID")}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Points last hour</div>
                </div>
                <Sparkline data={weeklyTelemetry} color="#06b6d4" />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="font-mono text-2xl font-bold text-slate-800 dark:text-white">
                    {summary.alarmEventsLastDay}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Alarm events 24h</div>
                </div>
                <Sparkline data={weeklyAlarms} color="#f59e0b" />
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-semibold mb-4">Weekly Telemetry Trend</div>
          <div className="h-40 flex items-end gap-2">
            {weeklyTelemetry.map((val, i) => {
              const heightPct = (val / Math.max(...weeklyTelemetry)) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{(val / 1000).toFixed(1)}k</div>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-cyan-500 to-cyan-400 dark:from-cyan-600 dark:to-cyan-400 transition-all duration-500"
                    style={{ height: `${heightPct}%`, minHeight: 4 }}
                  />
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{weekLabels[i]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DEVICE HEALTH DONUT + ALARM SEVERITY + ACTIVE ALARMS */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Device Health Donut */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col items-center">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-semibold mb-4 self-start">Device Health</div>
          <DonutChart
            segments={[
              { label: "Online", value: summary.deviceStatus.online, color: "#10b981" },
              { label: "Stale", value: summary.deviceStatus.stale, color: "#f59e0b" },
              { label: "Unknown", value: summary.deviceStatus.unknown, color: "#64748b" },
            ]}
            centerLabel={String(deviceTotal)}
            size={140}
            thickness={16}
          />
          <div className="flex gap-4 mt-4">
            {[
              { label: "Online", value: summary.deviceStatus.online, color: "bg-emerald-500" },
              { label: "Stale", value: summary.deviceStatus.stale, color: "bg-amber-500" },
              { label: "Unknown", value: summary.deviceStatus.unknown, color: "bg-slate-500" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                <span>{item.label}: <strong className="text-slate-700 dark:text-slate-200">{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Alarm Severity */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-semibold mb-4">Alarm Severity</div>
          <div className="space-y-3">
            {summary.alarmsBySeverity.map((item) => {
              const cfg = severityConfig[item.severity.toLowerCase()] || severityConfig.info;
              const widthPct = (item.count / maxAlarm) * 100;
              return (
                <div key={item.severity} className={`rounded-lg p-3 ${cfg.bg}`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-xs font-semibold capitalize ${cfg.text}`}>{item.severity}</span>
                    <span className={`text-sm font-bold font-mono ${cfg.text}`}>{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.bar} transition-all duration-700`} style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Alarms */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-semibold mb-4">Active Alarms</div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={`font-mono text-5xl font-bold ${summary.activeAlarmCount > 0 ? "text-rose-500" : "text-emerald-500"}`}>
              {summary.activeAlarmCount}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {summary.activeAlarmCount > 0 ? "Alarm aktif yang memerlukan perhatian" : "Semua sistem dalam kondisi normal"}
            </div>
            {summary.activeAlarmCount > 0 && (
              <div className="mt-3 h-1 w-16 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* TELEMETRY BY AREA */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-semibold mb-4">Telemetry By Area</div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {summary.telemetryByArea.map((item) => {
            const widthPct = (item.count / maxArea) * 100;
            return (
              <div key={item.area} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.area}</span>
                  <span className="font-mono text-sm font-bold text-slate-800 dark:text-white">{item.count.toLocaleString("id-ID")}</span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all duration-700" style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
