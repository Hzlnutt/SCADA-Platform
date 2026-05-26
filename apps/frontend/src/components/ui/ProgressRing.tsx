import type { CSSProperties } from "react";

type ProgressRingProps = {
  value: number;
  target: number;
  label: string;
  unit?: string;
  tone?: "cyan" | "amber" | "emerald";
};

const toneMap = {
  cyan: "from-cyan-400 via-sky-400 to-blue-500",
  amber: "from-amber-400 via-orange-400 to-rose-400",
  emerald: "from-emerald-400 via-lime-400 to-teal-400"
};

const ringColorMap = {
  cyan: "rgba(34, 211, 238, 0.95)",
  amber: "rgba(251, 191, 36, 0.95)",
  emerald: "rgba(52, 211, 153, 0.95)"
};

export const ProgressRing = ({
  value,
  target,
  label,
  unit,
  tone = "cyan"
}: ProgressRingProps) => {
  const safeTarget = target === 0 ? 1 : target;
  const ratio = Math.min(value / safeTarget, 1);
  const percentage = Math.round(ratio * 100);
  const ringStyle = {
    background: `conic-gradient(var(--ring-color) ${ratio * 360}deg, rgba(148, 163, 184, 0.2) 0deg)`
  } as CSSProperties;

  return (
    <div className="flex items-center gap-4">
      <div
        className={[
          "relative h-20 w-20 rounded-full p-[3px]",
          `bg-gradient-to-br ${toneMap[tone]}`
        ].join(" ")}
        style={{ "--ring-color": ringColorMap[tone] } as CSSProperties}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-slate-950/90"
          style={ringStyle}
        >
          <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-slate-100">
            {percentage}%
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-lg font-semibold text-slate-100">
          {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          {unit ? ` ${unit}` : ""}
        </div>
        <div className="text-[11px] text-slate-500">
          Target {target.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          {unit ? ` ${unit}` : ""}
        </div>
      </div>
    </div>
  );
};
