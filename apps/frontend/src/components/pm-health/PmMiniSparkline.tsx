import { memo } from "react";
import type { HealthStatus, SparklinePoint } from "./pmHealth.types";

export const PmMiniSparkline = memo(function PmMiniSparkline({
  points,
  status
}: {
  points: SparklinePoint[];
  status: HealthStatus;
}) {
  if (!points || points.length < 2) {
    return <span className="text-[11px] text-slate-400 dark:text-slate-600 font-mono">—</span>;
  }

  const width = 112;
  const height = 28;
  const padX = 3;
  const padY = 4;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const coords = points.map((p, idx) => {
    const x = padX + (idx / (points.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (p.v - min) / span) * (height - padY * 2);
    return { x, y, anomaly: Boolean(p.anomaly) };
  });

  const pathD = coords
    .map((c, idx) => `${idx === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  const strokeColor =
    status === "critical"
      ? "#f43f5e"
      : status === "warning"
      ? "#f59e0b"
      : status === "offline"
      ? "#94a3b8"
      : "#10b981";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-label="Active energy sparkline"
    >
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords
        .filter((c) => c.anomaly)
        .map((c, idx) => (
          <circle
            key={idx}
            cx={c.x}
            cy={c.y}
            r="2.6"
            fill="#e11d48"
            stroke="#ffffff"
            strokeWidth="1"
          />
        ))}
    </svg>
  );
});
