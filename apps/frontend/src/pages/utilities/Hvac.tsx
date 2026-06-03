import { useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { UtilityBarChart } from "../../components/charts/UtilityBarChart";
import { hvacEquipment } from "../../data/equipment";
import { buildLabels, buildSeries } from "../../utils/series";

const ranges = [
  { id: "day", label: "Per Hari", points: 24, stepMs: 60 * 60 * 1000, type: "time", scale: 1 },
  { id: "week", label: "Per Minggu", points: 7, stepMs: 24 * 60 * 60 * 1000, type: "day", scale: 7 }
] as const;

export default function Hvac() {
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("day");
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const loadSeries = useMemo(() => {
    const base = 320 * config.scale;
    return buildSeries(config.points, base, base * 0.2, 1);
  }, [config]);

  const labels = useMemo(() => buildLabels(config.points, config.stepMs, config.type), [config]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="HVAC"
        description="Kondisi pendingin, airflow, dan AHU utama."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Avg Temp</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">21.6 degC</div>
          <div className="mt-1 text-xs text-[#4c78a6]">Rata-rata ruangan kritikal.</div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Humidity</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">48%</div>
          <div className="mt-1 text-xs text-[#4c78a6]">Kelembaban area produksi.</div>
        </div>
        <div className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-4 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Active AHU</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b3a68]">6/10</div>
          <div className="mt-1 text-xs text-[#4c78a6]">Unit AHU berjalan.</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Cooling Load</div>
            <div className="text-sm text-[#2a5b91]">Beban pendinginan HVAC.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ranges.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={[
                  "rounded-full border px-3 py-1 font-semibold",
                  range === item.id
                    ? "border-[#2f8ae5] bg-[#e6f2ff] text-[#0b3a68]"
                    : "border-[#c7dbf2] text-[#4c78a6]"
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <UtilityBarChart
            labels={labels}
            values={loadSeries}
            unit="kW"
            color="#2f8ae5"
            height={220}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#c7dbf2] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#4c78a6]">Peralatan HVAC</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {hvacEquipment.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] px-3 py-2">
              <div className="text-xs font-semibold text-[#0b3a68]">{item.name}</div>
              <div className="text-xs text-[#4c78a6]">{item.code}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
