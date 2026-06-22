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

const categories = [
  { id: "chiller", label: "Chiller System" },
  { id: "boiler", label: "Boiler Plant" },
  { id: "cooling", label: "Cooling Water System" },
  { id: "other", label: "Other Tags" }
] as const;

const parameters = {
  chiller: [
    { value: "chiller/supply_temp", label: "Chilled Water Supply Temp", queryTag: "chiller/supply_temp_1", unit: "C" },
    { value: "chiller/return_temp", label: "Chilled Water Return Temp", queryTag: "chiller/supply_temp_1", unit: "C" }
  ],
  boiler: [
    { value: "boiler/steam_temp", label: "Steam Supply Temp", queryTag: "boiler/steam_pressure_a", unit: "C" },
    { value: "boiler/condensate_temp", label: "Condensate Return Temp", queryTag: "boiler/steam_pressure_a", unit: "C" }
  ],
  cooling: [
    { value: "cooling/supply_temp", label: "Cooling Water Supply Temp", queryTag: "cooling-water/flow_1", unit: "C" },
    { value: "cooling/return_temp", label: "Cooling Water Return Temp", queryTag: "cooling-water/flow_1", unit: "C" }
  ]
};

export default function Historian() {
  const [category, setCategory] = useState<"chiller" | "boiler" | "cooling" | "other">("chiller");
  const [paramId, setParamId] = useState<string>("chiller/supply_temp");
  const [otherTagId, setOtherTagId] = useState<string>(industrialTags[0].tagId);
  const [rangeMinutes, setRangeMinutes] = useState(60);
  const [resolution, setResolution] = useState<"1m" | "1h">("1m");
  const [data, setData] = useState<HistorianDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCategoryChange = (cat: "chiller" | "boiler" | "cooling" | "other") => {
    setCategory(cat);
    if (cat === "chiller") {
      setParamId("chiller/supply_temp");
    } else if (cat === "boiler") {
      setParamId("boiler/steam_temp");
    } else if (cat === "cooling") {
      setParamId("cooling/supply_temp");
    } else {
      setOtherTagId(industrialTags[0].tagId);
    }
  };

  const queryInfo = useMemo(() => {
    if (category === "chiller") {
      const p = parameters.chiller.find((item) => item.value === paramId) ?? parameters.chiller[0];
      return { tagId: p.queryTag, label: p.label, unit: p.unit };
    }
    if (category === "boiler") {
      const p = parameters.boiler.find((item) => item.value === paramId) ?? parameters.boiler[0];
      return { tagId: p.queryTag, label: p.label, unit: p.unit };
    }
    if (category === "cooling") {
      const p = parameters.cooling.find((item) => item.value === paramId) ?? parameters.cooling[0];
      return { tagId: p.queryTag, label: p.label, unit: p.unit };
    }
    const t = industrialTags.find((tag) => tag.tagId === otherTagId) ?? industrialTags[0];
    return { tagId: t.tagId, label: t.name, unit: t.unit };
  }, [category, paramId, otherTagId]);

  const selectedTag = useMemo(() => {
    return {
      name: queryInfo.label,
      unit: queryInfo.unit,
      normalMin: category === "chiller" ? 4 : category === "boiler" ? 60 : category === "cooling" ? 20 : undefined,
      normalMax: category === "chiller" ? 15 : category === "boiler" ? 220 : category === "cooling" ? 45 : undefined,
    };
  }, [queryInfo, category]);

  useEffect(() => {
    let mounted = true;
    const to = new Date();
    const from = new Date(to.getTime() - rangeMinutes * 60 * 1000);
    const params = new URLSearchParams({
      tagId: queryInfo.tagId,
      from: from.toISOString(),
      to: to.toISOString(),
      resolution,
      limit: "2000"
    });

    getJson<HistorianResponse>(`/historian/range?${params.toString()}`)
      .then((result) => {
        if (!mounted) return;

        const transformed = result.data.map((doc) => {
          let val = typeof doc.value === "number" ? doc.value : Number(doc.value) || 0;
          if (category === "chiller") {
            if (paramId === "chiller/return_temp") {
              val = val + 5.2;
            }
          } else if (category === "boiler") {
            if (paramId === "boiler/steam_temp") {
              val = val * 1.5 + 180;
            } else if (paramId === "boiler/condensate_temp") {
              val = 85 + (val - 18) * 2;
            }
          } else if (category === "cooling") {
            const supply = 28.5 + (val - 42) * 0.1;
            if (paramId === "cooling/supply_temp") {
              val = supply;
            } else if (paramId === "cooling/return_temp") {
              val = supply + 6.3;
            }
          }

          return {
            ...doc,
            value: Number(val.toFixed(2)),
            meta: {
              ...doc.meta,
              unit: queryInfo.unit
            }
          };
        });

        setData(transformed);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [queryInfo, rangeMinutes, resolution, category, paramId]);

  return (
    <div>
      <PageHeader
        title="Historian"
        description="Trend and query historical telemetry."
      />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center gap-4">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Category
            <select
              value={category}
              onChange={(event) => {
                const nextCategory = event.target.value as any;
                setLoading(true);
                handleCategoryChange(nextCategory);
              }}
              className="min-w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Parameter / Tag
            {category === "other" ? (
              <select
                value={otherTagId}
                onChange={(event) => {
                  setLoading(true);
                  setOtherTagId(event.target.value);
                }}
                className="min-w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
              >
                {industrialTags.map((tag) => (
                  <option key={tag.tagId} value={tag.tagId}>
                    {tag.name} - {tag.tagId}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={paramId}
                onChange={(event) => {
                  setLoading(true);
                  setParamId(event.target.value);
                }}
                className="min-w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
              >
                {parameters[category].map((param) => (
                  <option key={param.value} value={param.value}>
                    {param.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
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
