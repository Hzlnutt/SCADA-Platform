import { PageHeader } from "../components/ui/PageHeader";
import { industrialTags } from "../data/industrial-tags";
import { useTelemetryStore } from "../store/telemetry.store";

const formatValue = (value: number | string | boolean, unit: string) => {
  if (typeof value === "number") {
    return `${value.toFixed(2)} ${unit}`;
  }

  if (typeof value === "boolean") {
    return value ? "ON" : "OFF";
  }

  return `${value} ${unit}`;
};

const getCondition = (
  value: number | string | boolean | undefined,
  min?: number,
  max?: number
) => {
  if (typeof value !== "number" || min === undefined || max === undefined) {
    return "unknown";
  }

  if (value < min || value > max) {
    return "attention";
  }

  return "normal";
};

const conditionStyle = {
  normal: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  attention: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  unknown: "border-slate-700 bg-slate-900/70 text-slate-400"
};

export default function PlantLayout() {
  const latest = useTelemetryStore((state) => state.latest);

  return (
    <div>
      <PageHeader
        title="Plant Layout"
        description="Visual overview for Boiler, RO, WFI, and utilities."
      />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-500">
            Process Flow
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {industrialTags.map((tag, index) => {
              const point = latest[tag.tagId];
              const condition = getCondition(
                point?.value,
                tag.normalMin,
                tag.normalMax
              );

              return (
                <div
                  key={tag.tagId}
                  className="relative rounded-lg border border-slate-800 bg-slate-950 p-4"
                >
                  {index < industrialTags.length - 1 ? (
                    <div className="absolute -right-3 top-1/2 hidden h-px w-3 bg-slate-700 md:block" />
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">
                        {tag.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {tag.area} | {tag.category}
                      </div>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-[11px] capitalize",
                        conditionStyle[condition]
                      ].join(" ")}
                    >
                      {condition}
                    </span>
                  </div>
                  <div className="mt-5 font-mono text-xl text-slate-100">
                    {point ? formatValue(point.value, tag.unit) : "-"}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {point
                      ? new Date(point.ts).toLocaleString()
                      : "Waiting for data"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Operating Bands
          </div>
          <div className="mt-4 space-y-3">
            {industrialTags.map((tag) => (
              <div
                key={tag.tagId}
                className="flex items-center justify-between gap-4 border-b border-slate-900 pb-3 text-sm last:border-0"
              >
                <span className="text-slate-300">{tag.name}</span>
                <span className="font-mono text-xs text-slate-500">
                  {tag.normalMin ?? "-"} - {tag.normalMax ?? "-"} {tag.unit}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
