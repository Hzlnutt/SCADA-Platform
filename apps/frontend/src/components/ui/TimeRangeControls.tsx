import { useTimeRangeStore } from "../../store/timeRange.store";

const ranges = [
  { id: "5m", label: "5m" },
  { id: "1h", label: "1h" },
  { id: "1d", label: "1d" },
  { id: "1w", label: "1w" },
  { id: "1m", label: "1m" },
  { id: "1y", label: "1y" }
] as const;

export const TimeRangeControls = () => {
  const range = useTimeRangeStore((state) => state.range);
  const compare = useTimeRangeStore((state) => state.compare);
  const setRange = useTimeRangeStore((state) => state.setRange);
  const toggleCompare = useTimeRangeStore((state) => state.toggleCompare);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/70 p-1">
        {ranges.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              range === item.id
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:text-slate-200"
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleCompare}
        className={[
          "rounded-full border px-3 py-1 text-xs font-semibold",
          compare
            ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
            : "border-slate-700 text-slate-400"
        ].join(" ")}
      >
        Compare
      </button>
    </div>
  );
};
