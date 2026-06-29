import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { DonutChart } from "../components/charts/DonutChart";
import { getJson } from "../services/api.client";

type DeviceStatus = {
  id: string;
  name: string;
  area: string;
  category: string;
  status: "online" | "stale" | "unknown";
  lastTs?: string;
  lastValue?: number | string | boolean;
  unit?: string;
};

type DeviceStatusResponse = {
  data: DeviceStatus[];
};

const statusConfig = {
  online: {
    label: "Online",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800/50",
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
  },
  stale: {
    label: "Stale",
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800/50",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-slate-400",
    bg: "bg-slate-50 dark:bg-slate-800/30",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-500 dark:text-slate-400",
    badge: "bg-slate-400/10 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700",
  },
};

const formatRelativeTime = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function Devices() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    const loadDevices = () => {
      getJson<DeviceStatusResponse>("/devices/status")
        .then((result) => {
          if (mounted) setDevices(result.data);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    };

    loadDevices();
    const interval = window.setInterval(loadDevices, 10000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, []);

  const areas = Array.from(new Set(devices.map(d => d.area))).sort();
  const counts = {
    online: devices.filter(d => d.status === "online").length,
    stale: devices.filter(d => d.status === "stale").length,
    unknown: devices.filter(d => d.status === "unknown").length,
  };
  const total = devices.length || 1;
  const filtered = areaFilter === "all" ? devices : devices.filter(d => d.area === areaFilter);

  return (
    <div className="space-y-6">
      <PageHeader title="Device Health" description="PLC communication and equipment diagnostics." />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* SUMMARY STATS + DONUT */}
          <div className="grid gap-4 xl:grid-cols-4">
            {(["online", "stale", "unknown"] as const).map(status => {
              const cfg = statusConfig[status];
              const pct = ((counts[status] / total) * 100).toFixed(1);
              return (
                <div key={status} className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5 shadow-sm transition-all hover:shadow-md`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`h-3 w-3 rounded-full ${cfg.dot}`} />
                    <span className={`text-xs uppercase tracking-[0.2em] font-semibold ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <div className={`text-3xl font-bold font-mono ${cfg.text}`}>{counts[status]}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{pct}% of total</div>
                </div>
              );
            })}

            {/* Donut */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col items-center justify-center">
              <DonutChart
                segments={[
                  { label: "Online", value: counts.online, color: "#10b981" },
                  { label: "Stale", value: counts.stale, color: "#f59e0b" },
                  { label: "Unknown", value: counts.unknown, color: "#64748b" },
                ]}
                centerLabel={String(devices.length)}
                size={120}
                thickness={14}
              />
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Filter Area:</span>
            <select
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{filtered.length} devices</span>
          </div>

          {/* DEVICE CARDS GRID */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(device => {
              const cfg = statusConfig[device.status];
              return (
                <div
                  key={device.id}
                  className={`rounded-xl border ${cfg.border} bg-white dark:bg-slate-900 p-4 hover:shadow-lg transition-all duration-200 group`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{device.name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{device.category}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}>
                      {device.status === "online" && (
                        <span className="relative inline-flex h-1.5 w-1.5 mr-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                      )}
                      {device.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Area</div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">{device.area}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Value</div>
                      <div className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200 mt-0.5">
                        {device.lastValue !== undefined ? `${device.lastValue}${device.unit ? ` ${device.unit}` : ""}` : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Last Seen</div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                        {device.lastTs ? formatRelativeTime(device.lastTs) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
