import { useEffect, useState } from "react";
import { StatCard } from "../components/cards/StatCard";
import { PageHeader } from "../components/ui/PageHeader";
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

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

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

  const metrics = summary
    ? [
        { label: "OEE", value: percent(summary.kpi.oee), detail: "Plant model" },
        {
          label: "Availability",
          value: percent(summary.kpi.availability),
          detail: "Device health"
        },
        {
          label: "Performance",
          value: percent(summary.kpi.performance),
          detail: "Telemetry throughput"
        },
        {
          label: "Quality",
          value: percent(summary.kpi.quality),
          detail: "Alarm-weighted score"
        }
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="OEE, KPI, and operational efficiency dashboards."
      />
      {summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <StatCard
                key={metric.label}
                title={metric.label}
                value={metric.value}
                detail={metric.detail}
              />
            ))}
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Data Volume
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="font-mono text-2xl text-slate-100">
                    {summary.telemetryPointsLastHour}
                  </div>
                  <div className="text-xs text-slate-500">Points last hour</div>
                </div>
                <div>
                  <div className="font-mono text-2xl text-slate-100">
                    {summary.alarmEventsLastDay}
                  </div>
                  <div className="text-xs text-slate-500">Alarm events 24h</div>
                </div>
              </div>
            </section>
            <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Device Health
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {Object.entries(summary.deviceStatus).map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-900/70 p-3">
                    <div className="font-mono text-xl text-slate-100">{value}</div>
                    <div className="text-xs capitalize text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Active Alarms
              </div>
              <div className="mt-4 font-mono text-3xl text-slate-100">
                {summary.activeAlarmCount}
              </div>
              <div className="mt-3 space-y-2">
                {summary.alarmsBySeverity.map((item) => (
                  <div
                    key={item.severity}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="capitalize text-slate-400">
                      {item.severity}
                    </span>
                    <span className="font-mono text-slate-200">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="mt-6 rounded-lg border border-slate-800 bg-slate-950/70 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Telemetry By Area
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {summary.telemetryByArea.map((item) => (
                <div
                  key={item.area}
                  className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 p-3"
                >
                  <span className="text-sm text-slate-300">{item.area}</span>
                  <span className="font-mono text-sm text-slate-100">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="text-sm text-slate-400">Loading summary...</div>
      )}
    </div>
  );
}
