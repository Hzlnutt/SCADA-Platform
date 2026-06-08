import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { MultiLineChart } from "../../components/charts/MultiLineChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { wwtpEquipment } from "../../data/equipment";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 }
] as const;

export default function Wwtp() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const flowSeries = useMemo(() => {
    const base = 820 * config.scale;
    return buildTimeAwareSeries(config.points, base, base * 0.2, 2, maxIdx);
  }, [config, maxIdx]);

  const labels = useMemo(() => buildTimeLabels(config.points, config.type), [config]);
  const totalFlow = flowSeries.reduce((sum, v) => sum + (v ?? 0), 0);

  const wwtpMlSeries = useMemo(() => {
    const base = 820 * config.scale;
    return [
      { name: "Influent Flow", values: buildTimeAwareSeries(config.points, base, base * 0.2, 1, maxIdx), color: "#f4c542" },
      { name: "Effluent Discharge", values: buildTimeAwareSeries(config.points, base * 0.85, base * 0.15, 2, maxIdx), color: "#2f8ae5", dashed: true }
    ];
  }, [config, maxIdx]);

  const donutSegments = useMemo(() => [
    { label: "Aeration", value: 40, color: "rgba(47, 138, 229, 0.88)" },
    { label: "Clarifier", value: 35, color: "rgba(59, 183, 126, 0.85)" },
    { label: "Sludge Press", value: 25, color: "rgba(244, 197, 66, 0.85)" }
  ], []);

  const effluentQuality = 98.2;
  const chemicalUsage = 1.4;

  return (
    <div className="space-y-5">
      <PageHeader title="WWTP" description="Status pengolahan air limbah dan kualitas effluent." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Influent Flow</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{totalFlow.toFixed(0)} m³</div>
          <div className="mt-1 text-xs text-slate-400">Total debit masuk</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Effluent Quality</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{effluentQuality}%</div>
          <div className="mt-1 text-xs text-slate-400">Kepatuhan baku mutu</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Chemical Usage</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{chemicalUsage} ton</div>
          <div className="mt-1 text-xs text-slate-400">Dosis kimia bulan ini</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-950/80">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Compliance</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">PASS</div>
          <div className="mt-1 text-xs text-slate-400">Baku mutu terpenuhi</div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Trend Influent vs Effluent</div>
              <div className="mt-1 text-sm text-slate-400">Pola debit masuk dan keluar WWTP — realtime hingga saat ini.</div>
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
            <MultiLineChart series={wwtpMlSeries} unit="m³" heightClassName="h-56" />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Distribusi Beban Stage</div>
          <div className="mt-1 text-sm text-slate-400">Aeration, Clarifier, Sludge Press.</div>
          <div className="mt-4 flex justify-center">
            <DonutChart segments={donutSegments} size={180} thickness={22} centerLabel="100%" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Parameter & Rate Limit</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">pH Limit</div>
            <div className="mt-1 font-semibold text-slate-200">6.0 - 9.0</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">COD MAX</div>
            <div className="mt-1 font-semibold text-slate-200">100 mg/L</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700">
            <div className="text-xs text-slate-400">BOD MAX</div>
            <div className="mt-1 font-semibold text-slate-200">30 mg/L</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bar Chart Influent</div>
          <div className="text-sm text-slate-400">Debit masuk WWTP (data realtime, masa depan kosong).</div>
        </div>
        <div className="mt-4">
          <UtilityBarChart labels={labels} values={flowSeries} unit="m³" color="#2f8ae5" height={220} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Peralatan WWTP</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {wwtpEquipment.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 transition hover:border-slate-700">
              <div className="text-xs font-semibold text-slate-200">{item.name}</div>
              <div className="text-xs text-slate-400">{item.code} &middot; {item.unit}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
