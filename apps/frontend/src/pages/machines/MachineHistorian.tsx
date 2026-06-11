import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendChart } from "../../components/charts/TrendChart";
import { getUnitById } from "../../data/machines";
import { industrialTags } from "../../data/industrial-tags";
import { getJson } from "../../services/api.client";
import type { MachineOutletContext } from "./MachineLayout";

type HistorianDoc = {
  ts: string;
  value: number | string | boolean;
  quality?: "good" | "bad" | "uncertain";
  meta: {
    tagId: string;
    unit?: string;
    count?: number;
    min?: number;
    max?: number;
    last?: number;
  };
};

type HistorianResponse = {
  data: HistorianDoc[];
};

const ranges = [
  { label: "1H", minutes: 60 },
  { label: "6H", minutes: 360 },
  { label: "24H", minutes: 1440 }
];

export default function MachineHistorian() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);

  const [rangeMinutes, setRangeMinutes] = useState(60);
  const [resolution, setResolution] = useState<"1m" | "1h">("1m");
  const [data, setData] = useState<HistorianDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedTag = useMemo(() => {
    if (!machine) return null;
    return industrialTags.find((tag) => tag.tagId === machine.tagId) ?? {
      id: machine.id,
      name: machine.name,
      area: machine.area,
      category: machine.category,
      tagId: machine.tagId,
      unit: machine.unit,
      normalMin: undefined,
      normalMax: undefined
    };
  }, [machine]);

  useEffect(() => {
    if (!machine) return;
    let mounted = true;
    setLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - rangeMinutes * 60 * 1000);
    const params = new URLSearchParams({
      tagId: machine.tagId,
      from: from.toISOString(),
      to: to.toISOString(),
      resolution,
      limit: "2000"
    });

    getJson<HistorianResponse>(`/historian/range?${params.toString()}`)
      .then((result) => {
        if (mounted) {
          setData(result.data);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [machine, rangeMinutes, resolution]);

  if (!machine || !selectedTag) {
    return (
      <div className="rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 text-center text-sm text-[#47729f] dark:text-slate-400">
        Machine telemetry configuration not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-4 transition-colors duration-300">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
            Machine Historian
          </div>
          <div className="mt-1 text-sm text-[#002b5c] dark:text-slate-300 font-semibold">
            {selectedTag.name} <span className="font-mono text-xs opacity-60">({machine.tagId})</span>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 px-1 py-1 text-xs">
            {ranges.map((range) => (
              <button
                key={range.label}
                type="button"
                onClick={() => {
                  if (range.minutes !== rangeMinutes) {
                    setRangeMinutes(range.minutes);
                  }
                }}
                className={[
                  "rounded-full px-3 py-1 font-semibold transition",
                  rangeMinutes === range.minutes
                    ? "bg-[#1f6fb5] text-white"
                    : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-300"
                ].join(" ")}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 px-1 py-1 text-xs">
            {(["1m", "1h"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  if (item !== resolution) {
                    setResolution(item);
                  }
                }}
                className={[
                  "rounded-full px-3 py-1 font-semibold transition",
                  resolution === item
                    ? "bg-[#1f6fb5] text-white"
                    : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-300"
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#002b5c] dark:text-slate-100">
              Telemetry History
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-500">
              {data.length} samples | {resolution} resolution
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-[#47729f] dark:text-slate-400 animate-pulse">Loading...</div>
          ) : null}
        </div>
        
        <TrendChart
          points={data}
          unit={selectedTag.unit}
          heightClassName="h-72"
          minThreshold={selectedTag.normalMin}
          maxThreshold={selectedTag.normalMax}
          title={selectedTag.name}
        />

        <div className="mt-5 overflow-x-auto border border-[#acd3ff] dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7fbff] dark:bg-slate-900/50 text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500">
              <tr>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Timestamp</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Value</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Samples</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Min</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#acd3ff] dark:divide-slate-800">
              {data.slice(-12).reverse().map((row) => (
                <tr key={`${row.meta.tagId}-${row.ts}`} className="text-[#002b5c] dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {new Date(row.ts).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">
                    {typeof row.value === "number"
                      ? row.value.toFixed(3)
                      : String(row.value)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {row.meta.count ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {row.meta.min?.toFixed(3) ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {row.meta.max?.toFixed(3) ?? "-"}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#47729f] dark:text-slate-500">
                    No data points found for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
