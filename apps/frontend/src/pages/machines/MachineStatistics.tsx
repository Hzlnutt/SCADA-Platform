import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { BarChart } from "../../components/charts/BarChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { MultiLineChart } from "../../components/charts/MultiLineChart";
import { TimeRangeControls } from "../../components/ui/TimeRangeControls";
import { getUnitById } from "../../data/machines";
import { useTimeRangeStore } from "../../store/timeRange.store";
import type { MachineOutletContext } from "./MachineLayout";

const rangePoints: Record<string, number> = {
  "5m": 8,
  "1h": 12,
  "1d": 24,
  "1w": 7,
  "1m": 30,
  "1y": 12
};

const sliceSeries = (values: number[], points: number) => {
  if (values.length >= points) {
    return values.slice(-points);
  }

  const padding = Array.from({ length: points - values.length }, () => values[0] ?? 0);
  return [...padding, ...values];
};

export default function MachineStatistics() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const range = useTimeRangeStore((state) => state.range);

  const trendSeries = useMemo(() => {
    if (!machine) {
      return [];
    }
    const points = rangePoints[range] ?? 24;
    return machine.trend.series.map((series) => ({
      ...series,
      values: sliceSeries(series.values, points)
    }));
  }, [machine, range]);

  const consumptionValues = useMemo(() => {
    if (!machine) {
      return [];
    }

    const points = rangePoints[range] ?? 24;
    return sliceSeries(machine.dailyConsumption, points);
  }, [machine, range]);

  const summary = useMemo(() => {
    if (!machine) {
      return null;
    }

    const values = trendSeries[0]?.values ?? [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

    return {
      min,
      max,
      avg
    };
  }, [machine, trendSeries]);

  if (!machine) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Data Statistik Secara Rinci
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {machine.description}
          </div>
        </div>
        <TimeRangeControls />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Status Distribution
          </div>
          <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-start">
            <DonutChart
              segments={machine.statusDistribution}
              centerLabel={range.toUpperCase()}
            />
            <div className="space-y-2 text-sm">
              {machine.statusDistribution.map((segment) => (
                <div key={segment.label} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-slate-300">{segment.label}</span>
                  <span className="ml-auto font-mono text-slate-100">
                    {segment.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Daily Consumption
          </div>
          <div className="mt-3">
            <BarChart
              values={consumptionValues}
              unit={machine.consumptionUnit}
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Parameter Trend
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {machine.trend.label} ({machine.unit})
            </div>
          </div>
          {summary ? (
            <div className="flex gap-4 text-xs text-slate-500">
              <span>Min {summary.min.toFixed(2)}</span>
              <span>Avg {summary.avg.toFixed(2)}</span>
              <span>Max {summary.max.toFixed(2)}</span>
            </div>
          ) : null}
        </div>
        <MultiLineChart series={trendSeries} unit={machine.unit} />
      </section>
    </div>
  );
}
