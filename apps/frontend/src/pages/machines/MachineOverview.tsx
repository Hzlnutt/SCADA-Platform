import { useEffect, useMemo, useState } from "react";
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
  return values.map((value, index) => ({
    ts: new Date(now - (values.length - index) * stepMs),
    value
  }));
};

export default function MachineOverview() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const latest = useTelemetryStore((state) => state.latest);
  const [pidOpen, setPidOpen] = useState(false);

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

  useEffect(() => {
    if (!pidOpen) {
      return undefined;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPidOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [pidOpen]);

  if (!machine) {
    return null;
  }

  const liveValue = latest[machine.tagId];
  const liveValueLabel = liveValue
    ? typeof liveValue.value === "number"
      ? formatValue(liveValue.value, machine.unit)
      : String(liveValue.value)
    : "Waiting for live data";

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

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-500">
            Dashboard P&ID
          </div>
          <button
            type="button"
            onClick={() => setPidOpen(true)}
            className="flex min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/60 text-sm text-slate-500 transition hover:border-[#7fb3e4]"
          >
            P&ID SVG placeholder. Upload diagram for {machine.name}.
          </button>
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Live Telemetry
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {liveValueLabel}
            </div>
            <div className="text-xs text-slate-500">
              Tag {machine.tagId}
            </div>
          </div>
        </section>
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
              />
            </div>
          </div>
        </section>
      </div>

      {pidOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="relative h-[90vh] w-[90vw] rounded-2xl border border-[#acd3ff] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setPidOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-[#acd3ff] bg-white px-3 py-1 text-xs font-semibold text-[#003b75]"
            >
              Close
            </button>
            <div className="flex h-full items-center justify-center rounded-2xl bg-[#f7fbff] text-sm text-[#47729f]">
              P&ID SVG placeholder. Upload diagram for {machine.name}.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
