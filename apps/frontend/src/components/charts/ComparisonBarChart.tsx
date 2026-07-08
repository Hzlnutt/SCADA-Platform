import { useMemo, useState } from "react";

type Thresholds = {
  upper?: number | null;
  lower?: number | null;
};

type ComparisonBarChartProps = {
  labels: string[];
  current: number[];
  previous?: number[];
  unit?: string;
  heightClassName?: string;
  thresholds?: Thresholds;
};

type HoverState = {
  index: number;
  series: "current" | "previous";
} | null;

export const ComparisonBarChart = ({
  labels,
  current,
  previous,
  unit,
  heightClassName = "h-40",
  thresholds
}: ComparisonBarChartProps) => {
  const [hoverState, setHoverState] = useState<HoverState>(null);
  const maxValue = useMemo(() => {
    const values = [...current, ...(previous ?? [])];
    const maxVal = values.length > 0 ? Math.max(...values) : 0;
    return maxVal > 0 ? maxVal * 1.15 : 1;
  }, [current, previous]);

  const formatValue = (value: number) =>
    unit ? `${value.toFixed(1)} ${unit}` : value.toFixed(1);

  const showUpper = thresholds?.upper !== null && thresholds?.upper !== undefined;
  const showLower = thresholds?.lower !== null && thresholds?.lower !== undefined;

  const shouldShowLabel = (index: number, total: number) => {
    if (total <= 8) return true;
    if (total <= 15) return index % 2 === 0;
    if (total <= 25) return index % 4 === 0;
    return index % 5 === 0;
  };

  const containerGap = labels.length > 15 ? "gap-1" : "gap-2";
  const barGap = labels.length > 15 ? "gap-0.5" : "gap-1.5";

  return (
    <div className="relative">
      <div className={`relative ${heightClassName}`}>
        {showUpper ? (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-amber-400/70"
            style={{
              top: `${100 - (Number(thresholds?.upper ?? 0) / maxValue) * 100}%`
            }}
          />
        ) : null}
        {showLower ? (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-emerald-400/70"
            style={{
              top: `${100 - (Number(thresholds?.lower ?? 0) / maxValue) * 100}%`
            }}
          />
        ) : null}

        <div className={`flex h-full items-end ${containerGap}`}>
          {labels.map((label, index) => {
            const currentValue = current[index] ?? 0;
            const previousValue = previous ? previous[index] ?? 0 : 0;
            const highlightCurrent =
              hoverState?.index === index && hoverState?.series === "current";
            const highlightPrevious =
              hoverState?.index === index && hoverState?.series === "previous";
            const dimCurrent =
              hoverState && hoverState.index === index && hoverState.series === "previous";
            const dimPrevious =
              hoverState && hoverState.index === index && hoverState.series === "current";

            return (
              <div
                key={`${label}-${index}`}
                className="flex h-full flex-1 flex-col justify-end"
                onMouseLeave={() => setHoverState(null)}
              >
                <div className="flex h-full w-full items-end gap-0.5">
                  {previous ? (
                    <div
                      className={[
                        "w-1/2 flex-1 rounded-t transition shadow-sm",
                        highlightPrevious 
                          ? "bg-slate-400 dark:bg-slate-300" 
                          : "bg-slate-300 dark:bg-slate-600",
                        dimPrevious ? "opacity-30" : ""
                      ].join(" ")}
                      style={{ 
                        height: previousValue > 0 
                          ? `${Math.max(4, (previousValue / maxValue) * 100)}%` 
                          : "0%",
                        transition: "height 0.3s ease-out, opacity 0.2s"
                      }}
                      onMouseEnter={() =>
                        setHoverState({ index, series: "previous" })
                      }
                    />
                  ) : null}
                  <div
                    className={[
                      previous ? "w-1/2 flex-1" : "w-full",
                      "rounded-t transition shadow-[0_0_8px_rgba(59,130,246,0.15)]",
                      highlightCurrent 
                        ? "bg-sky-400 dark:bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.5)]" 
                        : "bg-blue-600 dark:bg-blue-500",
                      dimCurrent ? "opacity-30" : ""
                    ].join(" ")}
                    style={{ 
                      height: currentValue > 0 
                        ? `${Math.max(4, (currentValue / maxValue) * 100)}%` 
                        : "0%",
                      transition: "height 0.3s ease-out, opacity 0.2s"
                    }}
                    onMouseEnter={() =>
                      setHoverState({ index, series: "current" })
                    }
                  />
                </div>
                <div className="mt-2 text-center text-[10px] text-slate-500 dark:text-slate-400 min-h-[14px]">
                  {shouldShowLabel(index, labels.length) ? label : "\u00A0"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-500" />
          Current Timeline
        </div>
        {previous ? (
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            Previous Timeline
          </div>
        ) : null}
        {hoverState ? (
          <div className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-300">
            {labels[hoverState.index]} · {formatValue(current[hoverState.index] ?? 0)}
            {previous ? ` / ${formatValue(previous[hoverState.index] ?? 0)}` : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
};
