import { useRef, useState, useMemo } from "react";

type LineSeries = {
  name: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
};

type MultiLineChartProps = {
  series: LineSeries[];
  labels?: string[];
  unit?: string;
  heightClassName?: string;
};

const formatNumber = (value: number, unit?: string) =>
  `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;

const getShortTickLabel = (label: string) => {
  if (!label) return "";
  // If hourly: "00:00 WIB" -> "00:00"
  if (label.endsWith(" WIB")) {
    return label.replace(" WIB", "");
  }
  // If daily: "Senin, 01 Agustus 2025" -> "01 Ags"
  if (label.includes(", ")) {
    const parts = label.split(", ");
    if (parts[1]) {
      const dateParts = parts[1].split(" ");
      if (dateParts.length >= 2) {
        const day = dateParts[0];
        const month = dateParts[1].substring(0, 3);
        return `${day} ${month}`;
      }
    }
  }
  // If monthly: "Januari 2025" -> "Jan '25"
  const spaceIdx = label.lastIndexOf(" ");
  if (spaceIdx !== -1) {
    const month = label.substring(0, spaceIdx);
    const year = label.substring(spaceIdx + 1);
    const shortMonth = month.substring(0, 3);
    const shortYear = year.substring(2);
    return `${shortMonth} '${shortYear}`;
  }
  return label;
};

/** Split a (number|null)[] into contiguous non-null segments with original indices */
const buildSegments = (values: (number | null)[]) => {
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      current.push({ index: i, value: values[i] as number });
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
};

export const MultiLineChart = ({
  series,
  labels,
  unit,
  heightClassName = "h-56"
}: MultiLineChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const length = Math.max(...series.map((line) => line.values.length), 0);
  const nonNull = series.flatMap((line) => line.values.filter((v): v is number => v !== null));
  const min = nonNull.length > 0 ? Math.min(...nonNull, 0) : 0;
  const max = nonNull.length > 0 ? Math.max(...nonNull, 1) : 1;
  const range = max - min || 1;
  
  const width = 640;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 18;
  const paddingY = 20;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingY * 2;

  const buildPoints = (segment: { index: number; value: number }[]) =>
    segment
      .map(({ index, value }) => {
        const x = paddingLeft + (index / Math.max(length - 1, 1)) * plotWidth;
        const y = paddingY + (1 - (value - min) / range) * plotHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  const lastNonZero = series[0]?.values.filter((v): v is number => v !== null).at(-1);

  // Compute axis tick labels (show ~6-8 evenly spaced labels)
  const axisTicks = useMemo(() => {
    if (!labels || labels.length === 0) return [];
    
    const isDaily = labels[0]?.includes(", ");
    const isHourly = labels[0]?.endsWith(" WIB");
    const maxTicks = isDaily ? 8 : isHourly ? 8 : 12;
    
    const step = Math.ceil((labels.length - 1) / (maxTicks - 1)) || 1;
    
    const ticks: { index: number; label: string }[] = [];
    for (let i = 0; i < labels.length; i += step) {
      ticks.push({ index: i, label: labels[i] });
    }
    // Always include last
    if (ticks[ticks.length - 1]?.index !== labels.length - 1) {
      ticks.push({ index: labels.length - 1, label: labels[labels.length - 1] });
    }
    return ticks;
  }, [labels]);

  // Compute Y-axis tick labels
  const yAxisTicks = useMemo(() => {
    const ratios = [0, 0.25, 0.5, 0.75, 1];
    return ratios.map((r) => {
      const val = max - r * range;
      const y = paddingY + r * plotHeight;
      
      let label = "";
      if (val >= 1000000) label = `${(val / 1000000).toFixed(1)}M`;
      else if (val >= 1000) label = `${(val / 1000).toFixed(1)}k`;
      else label = val.toFixed(val < 10 && val > 0 ? 1 : 0);
      
      return { y, label };
    });
  }, [min, max, range, paddingY, plotHeight]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!containerRef.current || length === 0) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - containerRect.left;
    const clientY = e.clientY - containerRect.top;
    
    const pctX = clientX / containerRect.width;
    const svgX = pctX * width;
    
    const relativeX = svgX - paddingLeft;
    let idx = Math.round((relativeX / plotWidth) * (length - 1));
    if (idx < 0) idx = 0;
    if (idx >= length) idx = length - 1;

    console.log("MultiLineChart hover debug:", {
      clientX,
      clientY,
      pctX,
      svgX,
      relativeX,
      idx,
      length
    });

    setHoverIndex(idx);
    setMousePos({ x: clientX, y: clientY });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setMousePos(null);
  };

  // Compute percentage-based guide line position
  const guideLinePct = useMemo(() => {
    if (hoverIndex === null) return 0;
    const svgCx = paddingLeft + (hoverIndex / Math.max(length - 1, 1)) * plotWidth;
    return (svgCx / width) * 100;
  }, [hoverIndex, length, plotWidth, paddingLeft, width]);

  // Compute percentage-based indicator dots
  const dotPositions = useMemo(() => {
    if (hoverIndex === null) return [];
    return series.map((line) => {
      const val = line.values[hoverIndex];
      if (val === null || val === undefined) return null;
      const svgCx = paddingLeft + (hoverIndex / Math.max(length - 1, 1)) * plotWidth;
      const svgCy = paddingY + (1 - (val - min) / range) * plotHeight;
      return {
        name: line.name,
        color: line.color,
        value: val,
        leftPct: (svgCx / width) * 100,
        topPct: (svgCy / height) * 100
      };
    }).filter(Boolean);
  }, [hoverIndex, series, length, min, range, plotWidth, plotHeight, paddingLeft, paddingY, width, height]);

  // Tooltip position: clamp to stay within container
  const tooltipStyle = useMemo(() => {
    if (!mousePos || !containerRef.current) return { left: 0, top: 0 };
    const cw = containerRef.current.offsetWidth;
    const tooltipW = 280;
    let left = mousePos.x + 16;
    if (left + tooltipW > cw) left = mousePos.x - tooltipW - 16;
    let top = mousePos.y - 50;
    if (top < 0) top = mousePos.y + 16;
    return { left, top };
  }, [mousePos]);

  return (
    <div
      ref={containerRef}
      className={`relative ${heightClassName} min-h-0`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Telemetry trend"
        className="h-[calc(100%-2.5rem)] w-full overflow-visible cursor-crosshair"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={paddingY + line * plotHeight}
            y2={paddingY + line * plotHeight}
            stroke="rgba(100, 159, 220, 0.12)"
            strokeWidth="1"
          />
        ))}

        {/* Y-axis line */}
        <line
          x1={paddingLeft}
          x2={paddingLeft}
          y1={paddingY}
          y2={height - paddingY}
          stroke="rgba(100, 159, 220, 0.2)"
          strokeWidth="1"
        />

        {/* Y-axis tick labels */}
        {yAxisTicks.map((tick, i) => (
          <text
            key={i}
            x={paddingLeft - 6}
            y={tick.y + 3}
            textAnchor="end"
            fontSize="8"
            className="font-mono fill-slate-400 dark:fill-slate-500 font-medium"
          >
            {tick.label}
          </text>
        ))}

        {/* Area fill under lines */}
        {series.map((line) => {
          const segments = buildSegments(line.values);
          return segments.map((seg, segIdx) => {
            const pts = seg.map(({ index, value }) => {
              const x = paddingLeft + (index / Math.max(length - 1, 1)) * plotWidth;
              const y = paddingY + (1 - (value - min) / range) * plotHeight;
              return { x, y };
            });
            if (pts.length < 2) return null;
            const areaPath = `M${pts[0].x},${height - paddingY} L${pts.map(p => `${p.x},${p.y}`).join(" L")} L${pts[pts.length - 1].x},${height - paddingY} Z`;
            return (
              <path
                key={`area-${line.name}-${segIdx}`}
                d={areaPath}
                fill={line.color}
                fillOpacity="0.06"
              />
            );
          });
        })}

        {/* Polylines */}
        {series.map((line) => {
          const segments = buildSegments(line.values);
          return segments.map((seg, segIdx) => (
            <polyline
              key={`${line.name}-${segIdx}`}
              points={buildPoints(seg)}
              fill="none"
              stroke={line.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              strokeDasharray={line.dashed ? "6 6" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ));
        })}
      </svg>

      {/* HTML-based hover elements wrapper */}
      <div className="absolute top-0 left-0 right-0 bottom-[2.5rem] pointer-events-none overflow-hidden">
        {/* Guideline */}
        {hoverIndex !== null && (
          <div
            className="absolute top-0 bottom-0 w-[1px]"
            style={{
              left: `${guideLinePct}%`,
              background: "linear-gradient(to bottom, transparent, rgba(59,130,246,0.3), rgba(59,130,246,0.5), transparent)"
            }}
          />
        )}

        {/* Indicator dots */}
        {hoverIndex !== null && dotPositions.map((dot: any) => (
          <div
            key={dot.name}
            className="absolute"
            style={{
              left: `${dot.leftPct}%`,
              top: `${dot.topPct}%`,
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: dot.color,
              border: "2px solid white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3), 0 0 8px " + dot.color + "40",
              transform: "translate(-50%, -50%)",
              transition: "left 50ms ease, top 50ms ease"
            }}
          />
        ))}
      </div>

      {/* Bottom axis labels + legend */}
      <div className="h-[2.5rem] flex flex-col gap-1 mt-0.5">
        {/* Axis tick labels */}
        <div className="relative h-4 text-[9px] font-mono text-slate-400 dark:text-slate-500">
          {axisTicks.map((tick) => {
            const pct = length <= 1 ? 50 : ((paddingLeft + (tick.index / (length - 1)) * plotWidth) / width) * 100;
            return (
              <span
                key={tick.index}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${pct}%`,
                  transform: tick.index === 0 ? "translateX(0)" : tick.index === length - 1 ? "translateX(-100%)" : "translateX(-50%)"
                }}
              >
                {getShortTickLabel(tick.label)}
              </span>
            );
          })}
        </div>
        {/* Series legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          {series.map((line) => (
            <div key={line.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              <span>{line.name}</span>
            </div>
          ))}
          {lastNonZero !== undefined && (
            <span className="ml-auto font-mono text-slate-300 dark:text-slate-400 text-[10px]">
              Latest: {formatNumber(lastNonZero, unit)}
            </span>
          )}
        </div>
      </div>

      {/* Floating Interactive Tooltip */}
      {hoverIndex !== null && mousePos && (
        <div
          className="absolute z-30 rounded-xl bg-slate-950/95 border border-slate-700/60 px-3.5 py-2.5 shadow-2xl pointer-events-none text-xs text-white backdrop-blur-md"
          style={{
            left: `${tooltipStyle.left}px`,
            top: `${tooltipStyle.top}px`,
            minWidth: "200px"
          }}
        >
          <div className="font-bold border-b border-slate-700/50 pb-1.5 mb-2 flex items-center gap-2">
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-semibold">📅 Timeline</span>
            <span className="font-mono text-emerald-400 text-[11px]">
              {labels && labels[hoverIndex] ? labels[hoverIndex] : `Index ${hoverIndex}`}
            </span>
          </div>
          <div className="space-y-1.5">
            {series.map((line) => {
              const val = line.values[hoverIndex];
              return (
                <div key={line.name} className="flex justify-between items-center gap-4">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
                    {line.name}
                  </span>
                  <span className="font-bold font-mono text-[11px]">
                    {val !== null && val !== undefined ? formatNumber(val, unit) : "N/A"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


