import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { StatCard } from "../../components/cards/StatCard";
import { TrendChart } from "../../components/charts/TrendChart";
import { useTelemetryStore } from "../../store/telemetry.store";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";

const formatValue = (value: number, unit: string) =>
  `${value.toFixed(1)} ${unit}`;

const buildFallbackPoints = (values: number[]) => {
  const now = Date.now();
  const stepMs = 60 * 1000;
  return values.map<{ ts: Date | string; value: number }>((value, index) => ({
    ts: new Date(now - (values.length - index) * stepMs),
    value
  }));
};

export default function MachineOverview() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const latest = useTelemetryStore((state) => state.latest);

  const trendPoints = useMemo(() => {
    if (!machine) {
      return [];
    }

    const base = buildFallbackPoints(machine.trend.series[0].values.slice(-30));
    const point = latest[machine.tagId];

    if (point && base.length > 0) {
      base[base.length - 1] = { ts: point.ts, value: Number(point.value) };
    }

    return base;
  }, [latest, machine]);



  const minThreshold = useMemo(() => {
    return machine?.trend.series.find((s) => s.name === "Min" || s.name === "min")?.values[0];
  }, [machine]);

  const maxThreshold = useMemo(() => {
    return machine?.trend.series.find((s) => s.name === "Max" || s.name === "max")?.values[0];
  }, [machine]);

  if (!machine) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {machine.summaryCards.map((card) => (
          <StatCard
            key={card.label}
            title={card.label}
            value={formatValue(card.value, card.unit)}
            detail={card.caption}
          />
        ))}
      </div>

      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Ringkasan Operasi
          </div>
          <div className="mt-4 space-y-3">
            {machine.highlights.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between border-b border-slate-900 pb-3 text-sm last:border-0"
              >
                <span className="text-slate-400">{item.label}</span>
                <span className="font-mono text-slate-100">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Latest Trend Snapshot
            </div>
            <div className="mt-3">
              <TrendChart
                points={trendPoints}
                unit={machine.unit}
                heightClassName="h-32"
                minThreshold={minThreshold}
                maxThreshold={maxThreshold}
              />
            </div>
          </div>
        </section>
      </div>



    </div>
  );
}
