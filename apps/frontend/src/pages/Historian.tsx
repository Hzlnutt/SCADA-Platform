import { useEffect, useMemo, useState } from "react";
import { TrendChart } from "../components/charts/TrendChart";
import { PageHeader } from "../components/ui/PageHeader";
import { industrialTags } from "../data/industrial-tags";
import { getJson } from "../services/api.client";

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

export default function Historian() {
  const [tagId, setTagId] = useState(industrialTags[0].tagId);
  const [rangeMinutes, setRangeMinutes] = useState(60);
  const [resolution, setResolution] = useState<"1m" | "1h">("1m");
  const [data, setData] = useState<HistorianDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedTag = useMemo(
    () => industrialTags.find((tag) => tag.tagId === tagId) ?? industrialTags[0],
    [tagId]
  );

  useEffect(() => {
    let mounted = true;
    const to = new Date();
    const from = new Date(to.getTime() - rangeMinutes * 60 * 1000);
    const params = new URLSearchParams({
      tagId,
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
  }, [tagId, rangeMinutes, resolution]);

  return (
    <div>
      <PageHeader
        title="Historian"
        description="Trend and query historical telemetry."
      />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
          Tag
          <select
            value={tagId}
            onChange={(event) => {
              const nextTagId = event.target.value;
              if (nextTagId !== tagId) {
                setLoading(true);
                setTagId(nextTagId);
              }
            }}
            className="min-w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
          >
            {industrialTags.map((tag) => (
              <option key={tag.tagId} value={tag.tagId}>
                {tag.name} - {tag.tagId}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-md border border-slate-800 p-1">
            {ranges.map((range) => (
              <button
                key={range.label}
                type="button"
                onClick={() => {
                  if (range.minutes !== rangeMinutes) {
                    setLoading(true);
                    setRangeMinutes(range.minutes);
                  }
                }}
                className={[
                  "px-3 py-1.5 text-xs",
                  rangeMinutes === range.minutes
                    ? "rounded bg-cyan-500/20 text-cyan-200"
                    : "text-slate-400"
                ].join(" ")}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-slate-800 p-1">
            {(["1m", "1h"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  if (item !== resolution) {
                    setLoading(true);
                    setResolution(item);
                  }
                }}
                className={[
                  "px-3 py-1.5 text-xs",
                  resolution === item
                    ? "rounded bg-teal-500/20 text-teal-200"
                    : "text-slate-400"
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              {selectedTag.name}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {data.length} samples | {resolution}
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-slate-500">Loading...</div>
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
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Samples</th>
                <th className="px-3 py-2">Min</th>
                <th className="px-3 py-2">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {data.slice(-12).reverse().map((row) => (
                <tr key={`${row.meta.tagId}-${row.ts}`} className="text-slate-300">
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(row.ts).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {typeof row.value === "number"
                      ? row.value.toFixed(3)
                      : String(row.value)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {row.meta.count ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {row.meta.min?.toFixed(3) ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {row.meta.max?.toFixed(3) ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
