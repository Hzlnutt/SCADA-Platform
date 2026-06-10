import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { MultiLineChart } from "../../components/charts/MultiLineChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { hvacEquipment } from "../../data/equipment";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "day", label: "Per Hari", points: 24, type: "time" as const, scale: 1 },
  { id: "week", label: "Per Minggu", points: 7, type: "day" as const, scale: 7 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 }
] as const;

export default function Hvac() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const loadSeries = useMemo(() => {
    const base = 320 * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.2, 1, maxIdx);
  }, [config, maxIdx]);

  const labels = useMemo(() => buildTimeLabels(config.points, config.type), [config]);

  const envSeries = useMemo(() => ({
    temp: buildTimeAwareSeries(config.points, 22, 1.2, 1, maxIdx),
    hum: buildTimeAwareSeries(config.points, 50, 4, 2, maxIdx)
  }), [config, maxIdx]);

  const multiSeries = useMemo(() => [
    { name: "Avg Temp (degC)", values: envSeries.temp, color: "#f4c542" },
    { name: "Avg Humidity (%)", values: envSeries.hum, color: "#2f8ae5", dashed: true }
  ], [envSeries]);

  const donutSegments = useMemo(() => [
    { label: "Clean Room / Production", value: 65, color: "rgba(47, 138, 229, 0.88)" },
    { label: "Warehouse", value: 20, color: "rgba(59, 183, 126, 0.85)" },
    { label: "Lab / Office", value: 15, color: "rgba(244, 197, 66, 0.85)" }
  ], []);

  const activeAhu = 6;
  const totalAhu = 10;
  const totalLoad = loadSeries.reduce((s, v) => s + (v ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="HVAC" description="Kondisi pendingin, airflow, dan AHU utama." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg Temperature</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">21.6°C</div>
          <div className="mt-1 text-xs text-slate-400">Rata-rata ruangan kritikal</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Humidity</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">48%</div>
          <div className="mt-1 text-xs text-slate-400">Kelembaban area produksi</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active AHU</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{activeAhu}/{totalAhu}</div>
          <div className="mt-1 text-xs text-slate-400">Unit AHU berjalan</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Cooling Load</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{totalLoad.toFixed(0)} kW</div>
          <div className="mt-1 text-xs text-slate-400">Beban pendinginan total</div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Trend Suhu & Kelembaban</div>
              <div className="mt-1 text-sm text-slate-400">Average temperature vs humidity — realtime hingga saat ini.</div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/80 px-1 text-xs">
              {ranges.map((item) => (
                <button key={item.id} type="button" onClick={() => setRange(item.id)}
                  className={["rounded-full px-3 py-1.5 font-semibold transition", range === item.id ? "bg-slate-500 text-white" : "text-slate-400 hover:text-slate-300"].join(" ")}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <MultiLineChart series={multiSeries} heightClassName="h-56" />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Distribusi Cooling Load</div>
          <div className="mt-1 text-sm text-slate-400">Clean Room, Warehouse, Lab/Office.</div>
          <div className="mt-4 flex justify-center">
            <DonutChart segments={donutSegments} size={180} thickness={22} centerLabel="100%" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Parameter & Rate Limit</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Target Temp</div>
            <div className="mt-1 font-semibold text-slate-200">22°C &plusmn; 2°C</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Humidity Limit</div>
            <div className="mt-1 font-semibold text-slate-200">&le; 60% RH</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">Air Changes Target</div>
            <div className="mt-1 font-semibold text-slate-200">&ge; 20 ACH</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bar Chart Cooling Load</div>
          <div className="text-sm text-slate-400">Beban pendinginan (data realtime, masa depan kosong).</div>
        </div>
        <div className="mt-4">
          <UtilityBarChart labels={labels} values={loadSeries} unit="kW" color="#2f8ae5" height={220} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Peralatan HVAC</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {hvacEquipment.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 transition hover:border-slate-700">
              <div className="text-xs font-semibold text-slate-200">{item.name}</div>
              <div className="text-xs text-slate-400">{item.code}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
