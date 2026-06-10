import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useTelemetryStore } from "../../store/telemetry.store";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";

// ─── Helper functions for multi-series chart ──────────────────────────────
const generateMetricTimeSeries = (
  metricId: string,
  pointsCount: number = 30,
  currentValue: number,
  avgValue: number
) => {
  const now = Date.now();
  const stepMs = 60 * 60 * 1000; // 1 hour steps
  const result = [];
  let baseline = avgValue;
  let variation = (currentValue - avgValue) * 0.8;

  for (let i = 0; i < pointsCount; i++) {
    const ts = new Date(now - (pointsCount - i) * stepMs);
    let value = baseline + variation * Math.sin((i / pointsCount) * Math.PI * 2);
    if (metricId === "ph_level") {
      value = baseline + variation * Math.sin((i / pointsCount) * Math.PI * 2) * 0.3;
    }
    if (metricId === "tds") {
      value = baseline + variation * Math.cos((i / pointsCount) * Math.PI);
    }
    result.push({ ts: ts.toISOString(), value: Number(value.toFixed(1)) });
  }
  return result;
};

const getMetricCurrentAndAvg = (filterId: string) => {
  const data: Record<string, { cur: number; avg: number }> = {
    supply_temp: { cur: 29.5, avg: 28.8 },
    return_temp: { cur: 32.2, avg: 31.8 },
    ph_level: { cur: 7.2, avg: 7.3 },
    tds: { cur: 145, avg: 152 },
    total_flow: { cur: 105.5, avg: 105 },
    energy: { cur: 1250.5, avg: 1150 },
    ambient_temp: { cur: 28.5, avg: 28.2 },
    humidity: { cur: 74, avg: 72 },
  };
  return data[filterId] || { cur: 0, avg: 0 };
};

// ─── Sub-components (updated for white theme) ─────────────────────────────
function CardHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-gray-200">
      <i className={`ti ${icon} text-gray-500 text-sm`} aria-hidden="true" />
      <span className="text-[10px] uppercase tracking-[0.14em] text-gray-500 font-medium">
        {title}
      </span>
    </div>
  );
}

function KVRow({
  label,
  value,
  valueClass = "text-gray-800",
  icon,
  noBorder = false,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  icon?: string;
  noBorder?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-1.5 text-sm ${
        noBorder ? "" : "border-b border-gray-100"
      }`}
    >
      <span className="text-gray-500 flex items-center gap-1.5">
        {icon && <i className={`ti ${icon} text-xs text-gray-400`} aria-hidden="true" />}
        {label}
      </span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function ProgressBar({
  value,
  colorClass = "bg-blue-600",
}: {
  value: number;
  colorClass?: string;
}) {
  return (
    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mt-1 mb-2">
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

type BadgeVariant = "green" | "amber" | "red" | "blue" | "gray";
function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  const styles: Record<BadgeVariant, string> = {
    green: "bg-green-100 text-green-800 border border-green-200",
    amber: "bg-amber-100 text-amber-800 border border-amber-200",
    red: "bg-red-100 text-red-800 border border-red-200",
    blue: "bg-blue-100 text-blue-800 border border-blue-200",
    gray: "bg-gray-100 text-gray-600 border border-gray-200",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${styles[variant]}`}>
      {label}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  valueClass = "text-gray-800",
  accentLeft,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  unit?: string;
  valueClass?: string;
  accentLeft?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-3.5 ${accentLeft ?? ""}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <i className={`ti ${icon} text-gray-400 text-xs`} aria-hidden="true" />
        <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">{label}</span>
      </div>
      <div className={`text-2xl font-semibold leading-tight ${valueClass}`}>{value}</div>
      {unit && <div className="text-[10px] text-gray-400 mt-0.5">{unit}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MachineOverview() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const latest = useTelemetryStore((state) => state.latest);
  const [selectedFilters, setSelectedFilters] = useState<
    Array<
      | "supply_temp"
      | "return_temp"
      | "ph_level"
      | "tds"
      | "total_flow"
      | "energy"
      | "ambient_temp"
      | "humidity"
    >
  >(["supply_temp", "return_temp"]); // Default multiple selections

  const [currentTime, setCurrentTime] = useState(new Date());
  useMemo(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!machine) return null;

  // ── Sample data ──────────────────────────────────────────────────────────
  const systemStatus = "Normal";
  const activeAlarms = 2;
  const maintenanceTasks = 3;
  const energyToday = 1250.5;
  const runningHours = 8.5;
  const co2Emissions = 3.25;

  const supplyTemp = 29.5;
  const returnTemp = 32.2;
  const deltaTemp = 2.7;
  const ambientTemp = 28.5;
  const ctEfficiency = 94.2;
  const totalEnergy = 1250.5;

  const parametersData = [
    { name: "Supply Temp (°C)", current: 29.5, average: 28.8, baseline: 28.0, status: "normal" },
    { name: "Supply Water TDS", current: 145, average: 142, baseline: 140, status: "normal" },
    { name: "Supply Water pH", current: 7.2, average: 7.3, baseline: 7.4, status: "normal" },
    { name: "Return Water Temp (°C)", current: 32.2, average: 31.8, baseline: 31.0, status: "warning" },
    { name: "Makeup Water Vol (m³)", current: 45.3, average: 42.1, baseline: 40.0, status: "normal" },
    { name: "Makeup Water TDS", current: 150, average: 148, baseline: 145, status: "warning" },
    { name: "Makeup Water pH", current: 7.1, average: 7.2, baseline: 7.3, status: "normal" },
    { name: "Blowdown Vol (m³)", current: 12.5, average: 11.8, baseline: 10.0, status: "normal" },
  ];

  const alarmsList = [
    { id: 1, time: "14:30", message: "High Delta Temperature", severity: "warning" as const },
    { id: 2, time: "13:45", message: "Low TDS Level", severity: "alert" as const },
    { id: 3, time: "12:15", message: "CT-1 Vibration High", severity: "warning" as const },
    { id: 4, time: "11:00", message: "Pump Pressure Low", severity: "info" as const },
    { id: 5, time: "10:30", message: "Tank Level Critical", severity: "alert" as const },
  ];

  const coolingTowerData = [
    {
      name: "Cooling Tower 1",
      status: "Running",
      fanSpeed: 850,
      motorCurrent: 12.5,
      motorPower: 8.5,
      pressure: 1.9,
      vibrationFan: 2.1,
      vibrationMotor: 1.5,
      runningHours: 8.5,
    },
    {
      name: "Cooling Tower 2",
      status: "Running",
      fanSpeed: 920,
      motorCurrent: 13.2,
      motorPower: 9.2,
      pressure: 2.0,
      vibrationFan: 2.3,
      vibrationMotor: 1.6,
      runningHours: 8.5,
    },
    {
      name: "Cooling Tower 3",
      status: "Standby",
      fanSpeed: 0,
      motorCurrent: 0,
      motorPower: 0,
      pressure: 0.2,
      vibrationFan: 0,
      vibrationMotor: 0,
      runningHours: 8.5,
    },
  ];

  const areaData = [
    { area: "DU-03", status: "Normal", flow: 24.5, pressure: 1.9, current: 8.2, power: 5.8, runningHours: 8.5, maintenance: "OK" },
    { area: "BP-03", status: "Normal", flow: 18.3, pressure: 1.5, current: 6.5, power: 4.2, runningHours: 8.5, maintenance: "OK" },
    { area: "PREP-03", status: "Warning", flow: 15.8, pressure: 1.1, current: 5.2, power: 3.5, runningHours: 8.5, maintenance: "Planned" },
    { area: "ST-03", status: "Normal", flow: 22.1, pressure: 1.9, current: 7.8, power: 5.5, runningHours: 8.5, maintenance: "OK" },
    { area: "WASHING", status: "Normal", flow: 16.5, pressure: 1.5, current: 5.9, power: 4.0, runningHours: 8.5, maintenance: "OK" },
    { area: "MINI LAB", status: "Normal", flow: 8.3, pressure: 2.0, current: 3.2, power: 2.1, runningHours: 8.5, maintenance: "OK" },
  ];

  const chartFilters = [
    { id: "supply_temp" as const, label: "Supply Temp", unit: "°C", color: "#3b82f6" },
    { id: "return_temp" as const, label: "Return Temp", unit: "°C", color: "#ef4444" },
    { id: "ph_level" as const, label: "pH Level", unit: "pH", color: "#10b981" },
    { id: "tds" as const, label: "TDS", unit: "ppm", color: "#f59e0b" },
    { id: "total_flow" as const, label: "Total Flow", unit: "m³/h", color: "#8b5cf6" },
    { id: "energy" as const, label: "Energy", unit: "kWh", color: "#ec489a" },
    { id: "ambient_temp" as const, label: "Ambient Temp", unit: "°C", color: "#06b6d4" },
    { id: "humidity" as const, label: "Humidity", unit: "%", color: "#84cc16" },
  ];

  // Prepare chart data for multi-series
  const chartTimeSeriesData = useMemo(() => {
    if (!machine) return [];
    const pointsCount = 24; // 24 hours
    const allSeries: Record<string, any[]> = {};

    for (const filter of chartFilters) {
      const { cur, avg } = getMetricCurrentAndAvg(filter.id);
      const series = generateMetricTimeSeries(filter.id, pointsCount, cur, avg);
      allSeries[filter.id] = series;
    }

    // Combine into array of objects with timestamp and values per metric
    const combined = [];
    for (let i = 0; i < pointsCount; i++) {
      const dataPoint: any = {
        timeLabel: new Date(allSeries[chartFilters[0].id][i].ts).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        fullTimestamp: allSeries[chartFilters[0].id][i].ts,
      };
      for (const filter of chartFilters) {
        dataPoint[filter.id] = allSeries[filter.id][i].value;
      }
      combined.push(dataPoint);
    }
    return combined;
  }, [machine]);

  const toggleFilter = (filterId: typeof selectedFilters[number]) => {
    setSelectedFilters((prev) =>
      prev.includes(filterId) ? prev.filter((f) => f !== filterId) : [...prev, filterId]
    );
  };

  // ── Alarm helpers ─────────────────────────────────────────────────────────
  const alarmIcon = (s: "warning" | "alert" | "info") =>
    s === "alert" ? "ti-alert-octagon" : s === "warning" ? "ti-alert-triangle" : "ti-info-circle";
  const alarmIconColor = (s: "warning" | "alert" | "info") =>
    s === "alert" ? "text-red-500" : s === "warning" ? "text-amber-500" : "text-blue-500";
  const alarmBadge = (s: "warning" | "alert" | "info"): BadgeVariant =>
    s === "alert" ? "red" : s === "warning" ? "amber" : "blue";

  return (
    <div className="space-y-4 pb-8 bg-gray-50">
      {/* ── ROW 1: Key Metrics (Single Card with separators) ───────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-y divide-gray-100 md:divide-y-0 md:divide-x divide-gray-100">
          {/* Date & Time */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ti ti-calendar text-gray-400 text-xs" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                Tanggal / Jam
              </span>
            </div>
            <div className="text-sm font-medium text-gray-600 leading-tight">
              {currentTime.toLocaleDateString("id-ID")}
            </div>
            <div className="text-xl font-semibold text-blue-700 leading-tight mt-0.5">
              {currentTime.toLocaleTimeString("id-ID")}
            </div>
          </div>
          {/* System Status */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ti ti-activity text-gray-400 text-xs" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                Sistem
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${systemStatus === "Normal" ? "bg-green-500" : "bg-red-500"}`} />
              <span className={`text-lg font-semibold ${systemStatus === "Normal" ? "text-green-700" : "text-red-700"}`}>
                {systemStatus}
              </span>
            </div>
          </div>
          {/* Active Alarms */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ti ti-bell-ringing text-gray-400 text-xs" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                Alarm Aktif
              </span>
            </div>
            <div className="text-2xl font-semibold text-red-600">{activeAlarms}</div>
          </div>
          {/* Maintenance */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ti ti-tool text-gray-400 text-xs" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                Maintenance
              </span>
            </div>
            <div className="text-2xl font-semibold text-amber-600">{maintenanceTasks}</div>
          </div>
          {/* Energy Today */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ti ti-bolt text-gray-400 text-xs" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                Energi Hari Ini
              </span>
            </div>
            <div className="text-2xl font-semibold text-violet-700">{energyToday.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">kWh</div>
          </div>
          {/* Running Hours */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ti ti-clock text-gray-400 text-xs" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                Jam Operasi
              </span>
            </div>
            <div className="text-2xl font-semibold text-gray-800">{runningHours.toFixed(1)}h</div>
          </div>
          {/* CO2 */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ti ti-leaf text-gray-400 text-xs" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                CO₂ Emisi
              </span>
            </div>
            <div className="text-2xl font-semibold text-teal-700">{co2Emissions.toFixed(2)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Ton/hari</div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Temperature & Efficiency ───────────────────────────────── */}
      <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon="ti-temperature" label="Supply Temp" value={`${supplyTemp}°C`} valueClass="text-amber-700" />
        <MetricCard icon="ti-temperature-plus" label="Return Temp" value={`${returnTemp}°C`} valueClass="text-red-700" />
        <MetricCard icon="ti-arrows-diff" label="Delta Temp" value={`${deltaTemp}°C`} valueClass="text-blue-700" />
        <MetricCard icon="ti-sun" label="Ambient Temp" value={`${ambientTemp}°C`} valueClass="text-gray-800" />
        <div className="rounded-lg border border-gray-200 bg-white p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <i className="ti ti-gauge text-gray-400 text-xs" />
            <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">Efisiensi CT</span>
          </div>
          <div className="text-2xl font-semibold text-green-700">{ctEfficiency.toFixed(1)}%</div>
          <ProgressBar value={ctEfficiency} colorClass="bg-green-600" />
        </div>
        <MetricCard icon="ti-plug" label="Total Energi" value={totalEnergy.toFixed(1)} unit="kWh" valueClass="text-violet-700" />
      </div>

      {/* ── ROW 3: Parameters Table + Latest Alarms (all visible, scrollable) ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Parameters Table */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-5">
          <CardHeader icon="ti-table" title="Parameter Data" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Parameter</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">Saat Ini</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">Rata-rata</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">Baseline</th>
                </tr>
              </thead>
              <tbody>
                {parametersData.map((param, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-2 text-gray-700 text-xs">{param.name}</td>
                    <td className={`text-right py-2 px-2 font-semibold text-sm ${
                      param.status === "warning" ? "text-amber-600" : "text-blue-700"
                    }`}>
                      {param.current}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-500 text-xs">{param.average}</td>
                    <td className="text-right py-2 px-2 text-gray-500 text-xs">{param.baseline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latest Alarms (All alarms, scrollable) */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 flex flex-col">
          <CardHeader icon="ti-alert-triangle" title="Alarm Terbaru" />
          <div className="space-y-2 flex-1 overflow-y-auto max-h-64">
            {alarmsList.map((alarm) => (
              <div
                key={alarm.id}
                className="flex gap-2.5 items-start p-2.5 rounded-md bg-gray-50 border border-gray-200"
              >
                <i
                  className={`ti ${alarmIcon(alarm.severity)} text-base flex-shrink-0 mt-0.5 ${alarmIconColor(alarm.severity)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-500">{alarm.time}</div>
                  <div className="text-xs text-gray-800 leading-snug">{alarm.message}</div>
                  <div className="mt-1">
                    <Badge label={alarm.severity} variant={alarmBadge(alarm.severity)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 4: Cooling Towers ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {coolingTowerData.map((tower, idx) => {
          const isRunning = tower.status === "Running";
          return (
            <div
              key={idx}
              className={`rounded-lg border bg-white p-5 ${
                isRunning ? "border-gray-200 border-l-4 border-l-green-500" : "border-gray-200 border-l-4 border-l-gray-400"
              }`}
            >
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <i className="ti ti-wind text-gray-500 text-sm" />
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {tower.name}
                  </span>
                </div>
                <Badge label={tower.status} variant={isRunning ? "green" : "gray"} />
              </div>
              <KVRow icon="ti-propeller" label="Fan Speed" value={isRunning ? `${tower.fanSpeed} RPM` : "—"} valueClass={isRunning ? "text-gray-800" : "text-gray-400"} />
              <KVRow icon="ti-cpu" label="Motor Current" value={isRunning ? `${tower.motorCurrent} A` : "—"} valueClass={isRunning ? "text-gray-800" : "text-gray-400"} />
              <KVRow icon="ti-bolt" label="Motor Power" value={isRunning ? `${tower.motorPower} kW` : "—"} valueClass={isRunning ? "text-gray-800" : "text-gray-400"} />
              <KVRow icon="ti-gauge" label="Pressure" value={`${tower.pressure} Bar`} valueClass="text-gray-800" />
              <KVRow icon="ti-wave-sine" label="Vibrasi Fan" value={isRunning ? `${tower.vibrationFan} mm/s` : "—"} valueClass={isRunning ? "text-gray-800" : "text-gray-400"} />
              <KVRow icon="ti-wave-sine" label="Vibrasi Motor" value={isRunning ? `${tower.vibrationMotor} mm/s` : "—"} valueClass={isRunning ? "text-gray-800" : "text-gray-400"} />
              <KVRow icon="ti-clock" label="Jam Operasi" value={`${tower.runningHours}h`} valueClass="text-blue-600" noBorder />
            </div>
          );
        })}
      </div>

      {/* ── ROW 5: System Components (Aligned columns) ──────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column: Cooling Tank, Makeup Water, Blowdown with thresholds */}
        <div className="space-y-4">
          {/* Cooling Tank */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <CardHeader icon="ti-droplet" title="Cooling Tank" />
            <KVRow label="pH Level" value="7.2" valueClass="text-blue-600" icon="ti-test-pipe" />
            <KVRow label="TDS" value="145 ppm" valueClass="text-gray-800" icon="ti-ripple" />
            <KVRow label="Conductivity" value="290 µS/cm" valueClass="text-gray-800" icon="ti-bolt" />
            <div>
              <div className="flex justify-between items-center py-1.5 text-sm border-b border-gray-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <i className="ti ti-chart-area text-xs text-gray-400" />
                  Tank Level
                </span>
                <span className="font-medium text-blue-600">85%</span>
              </div>
              <ProgressBar value={85} colorClass="bg-blue-600" />
              <div className="text-right text-[10px] text-gray-400 mt-0.5">Ambang batas: 100%</div>
            </div>
            <KVRow label="Temperature" value="32.2°C" valueClass="text-amber-600" icon="ti-temperature" noBorder />
          </div>

          {/* Makeup Water */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <CardHeader icon="ti-droplets" title="Makeup Water" />
            <KVRow label="pH" value="7.1" valueClass="text-blue-600" icon="ti-test-pipe" />
            <KVRow label="TDS" value="150 ppm" valueClass="text-gray-800" icon="ti-ripple" />
            <div>
              <div className="flex justify-between items-center py-1.5 text-sm border-b border-gray-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <i className="ti ti-bucket text-xs text-gray-400" />
                  Volume
                </span>
                <span className="font-medium text-gray-800">45.3 m³</span>
              </div>
              <ProgressBar value={(45.3 / 100) * 100} colorClass="bg-green-600" />
              <div className="text-right text-[10px] text-gray-400 mt-0.5">Ambang batas: 100 m³</div>
            </div>
            <KVRow label="Flow Rate" value="2.5 m³/h" valueClass="text-gray-800" icon="ti-arrows-right" noBorder />
          </div>

          {/* Blowdown Water */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <CardHeader icon="ti-arrow-down-circle" title="Blowdown Water" />
            <div className="flex justify-between items-center py-1.5 text-sm border-b border-gray-100">
              <span className="text-gray-500">Status</span>
              <Badge label="Normal" variant="green" />
            </div>
            <div>
              <div className="flex justify-between items-center py-1.5 text-sm border-b border-gray-100">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <i className="ti ti-bucket text-xs text-gray-400" />
                  Volume
                </span>
                <span className="font-medium text-gray-800">12.5 m³</span>
              </div>
              <ProgressBar value={(12.5 / 50) * 100} colorClass="bg-amber-600" />
              <div className="text-right text-[10px] text-gray-400 mt-0.5">Ambang batas: 50 m³</div>
            </div>
            <KVRow label="Flow" value="0.85 m³/h" valueClass="text-gray-800" icon="ti-arrows-right" noBorder />
          </div>
        </div>

        {/* Right column: Chemical Dosing System with SVG */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <CardHeader icon="ti-flask" title="Chemical Dosing System" />

          {/* Pump A */}
          <div className="rounded-md bg-gray-50 p-3.5 mb-3 border-l-2 border-blue-500">
            <div className="flex items-center gap-2 mb-2.5">
              {/* SVG Icon for Pump A */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500">
                <path d="M4 8H20V16H4V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M9 12H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <path d="M12 8V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              <span className="text-xs font-semibold text-blue-700">Pump A — Chemical 357</span>
            </div>
            <div className="flex justify-between items-center text-xs mb-0.5">
              <span className="text-gray-500">Tank Level</span>
              <span className="font-medium text-green-600">72%</span>
            </div>
            <ProgressBar value={72} colorClass="bg-green-600" />
            <div className="space-y-1 mt-1">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Flow Rate</span><span className="text-gray-800 font-medium">2.5 L/h</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Jam Operasi</span><span className="text-gray-800 font-medium">156 h</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Konsumsi</span><span className="text-gray-800 font-medium">390 L</span></div>
            </div>
          </div>

          {/* Pump B */}
          <div className="rounded-md bg-gray-50 p-3.5 border-l-2 border-green-500">
            <div className="flex items-center gap-2 mb-2.5">
              {/* SVG Icon for Pump B */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-500">
                <path d="M4 8H20V16H4V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M9 12H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <path d="M12 8V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              <span className="text-xs font-semibold text-green-700">Pump B — Chemical 327/317</span>
            </div>
            <div className="flex justify-between items-center text-xs mb-0.5">
              <span className="text-gray-500">Tank Level</span>
              <span className="font-medium text-amber-600">58%</span>
            </div>
            <ProgressBar value={58} colorClass="bg-amber-600" />
            <div className="space-y-1 mt-1">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Flow Rate</span><span className="text-gray-800 font-medium">1.8 L/h</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Jam Operasi</span><span className="text-gray-800 font-medium">156 h</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Konsumsi</span><span className="text-gray-800 font-medium">280 L</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 6: Area Distribution Table ────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <CardHeader icon="ti-layout-distribute-horizontal" title="Area Distribution" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Area</th>
                <th className="text-center py-2.5 px-3 text-gray-500 font-medium">Status</th>
                <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Flow (m³/h)</th>
                <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Tekanan (bar)</th>
                <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Arus (A)</th>
                <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Daya (kW)</th>
                <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Jam</th>
                <th className="text-center py-2.5 px-3 text-gray-500 font-medium">Maintenance</th>
              </tr>
            </thead>
            <tbody>
              {areaData.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-gray-800">{row.area}</td>
                  <td className="py-2.5 px-3 text-center">
                    <Badge label={row.status} variant={row.status === "Normal" ? "green" : "amber"} />
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{row.flow.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{row.pressure.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{row.current.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{row.power.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{row.runningHours}</td>
                  <td className="py-2.5 px-3 text-center">
                    {row.maintenance === "OK" ? (
                      <i className="ti ti-circle-check text-green-600 text-base" />
                    ) : (
                      <i className="ti ti-clock-hour-4 text-amber-600 text-base" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ROW 7: Multi-Series Trend Chart (24h) ──────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <CardHeader icon="ti-chart-line" title="Tren 24 Jam (Multi Parameter)" />

        {/* Multi-select Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-5">
          {chartFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => toggleFilter(filter.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                selectedFilters.includes(filter.id)
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}