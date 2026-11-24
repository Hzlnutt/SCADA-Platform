import type { MutableRefObject } from "react";
import type { Plugin } from "chart.js";

export type PltsWeatherKey =
  | "clear_day"
  | "clear_night"
  | "mainly_clear"
  | "partly_cloudy"
  | "partly_cloudy_night"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain_light"
  | "rain_moderate"
  | "rain_heavy"
  | "thunderstorm";

export interface PltsWeatherSegment {
  startMinute: number;
  endMinute: number;
  range: string;
  weatherCode: number;
  weatherKey: PltsWeatherKey;
  label: string;
  avgTempC: number | null;
  avgCloudPct: number | null;
  avgRadiationWm2: number | null;
  precipMm: number | null;
  minutesCount: number;
}

export interface PltsHourlyWeatherPoint {
  date: string;
  hour: number;
  dominantWeatherCode: number;
  dominantWeatherKey: PltsWeatherKey;
  dominantLabel: string;
  avgTempC: number | null;
  avgHumidityPct: number | null;
  avgCloudPct: number | null;
  totalPrecipMm: number | null;
  avgRadiationWm2: number | null;
  isDay: boolean;
  sampleMinutes: number;
  source: string;
  segments: PltsWeatherSegment[];
}

export interface PltsDailyWeatherPoint {
  date: string;
  dominantWeatherKey: PltsWeatherKey;
  dominantLabel: string;
  avgTempC: number | null;
  avgCloudPct: number | null;
  avgRadiationWm2: number | null;
  totalPrecipMm: number | null;
  daytimeSummary: string;
  segments: { range: string; weatherKey: PltsWeatherKey; label: string }[];
}

export interface PltsMonthlyWeatherPoint {
  month: string;
  dominantWeatherKey: PltsWeatherKey;
  dominantLabel: string;
  avgTempC: number | null;
  avgRadiationWm2: number | null;
  totalPrecipMm: number | null;
  recordedDays: number;
  sunnyDays: number;
  cloudyDays: number;
  rainyDays: number;
}

export interface PltsLiveWeatherSnapshot {
  t_stamp: string;
  weatherCode: number;
  weatherKey: PltsWeatherKey;
  label: string;
  temperatureC: number | null;
  humidityPct: number | null;
  cloudPct: number | null;
  effectiveCloudPct: number | null;
  precipitationMm: number | null;
  radiationWm2: number | null;
  directRadiationWm2: number | null;
  windSpeedKmh: number | null;
  isDay: boolean;
  source: string;
}

export interface PltsWeatherPayload {
  location: {
    name: string;
    address: string;
    lat: number;
    lon: number;
    bmkgAdm4: string;
  };
  current: PltsLiveWeatherSnapshot | null;
  targetDate: string;
  hourly: (PltsHourlyWeatherPoint | null)[];
  daily: Record<string, PltsDailyWeatherPoint>;
  monthly: Record<string, PltsMonthlyWeatherPoint>;
}

export interface PltsBarWeatherSlot {
  mode: "hourly" | "daily" | "monthly";
  weatherKey: PltsWeatherKey;
  label: string;
  tempC: number | null;
  cloudPct: number | null;
  radiationWm2: number | null;
  precipMm: number | null;
  transitionCount: number;
  hourlyPoint?: PltsHourlyWeatherPoint;
  dailyPoint?: PltsDailyWeatherPoint;
  monthlyPoint?: PltsMonthlyWeatherPoint;
}

export function getPltsWeatherMeta(key: PltsWeatherKey): {
  emoji: string;
  label: string;
  pillClass: string;
} {
  switch (key) {
    case "clear_day":
      return {
        emoji: "☀️",
        label: "Cerah",
        pillClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      };
    case "mainly_clear":
      return {
        emoji: "🌤️",
        label: "Sebagian Cerah",
        pillClass: "bg-amber-400/15 text-amber-700 dark:text-amber-300 border-amber-400/30",
      };
    case "partly_cloudy":
      return {
        emoji: "⛅",
        label: "Cerah Berawan",
        pillClass: "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/30",
      };
    case "overcast":
      return {
        emoji: "☁️",
        label: "Berawan / Mendung",
        pillClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/35",
      };
    case "fog":
      return {
        emoji: "🌫️",
        label: "Berkabut",
        pillClass: "bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30",
      };
    case "drizzle":
      return {
        emoji: "🌦️",
        label: "Gerimis",
        pillClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
      };
    case "rain_light":
      return {
        emoji: "🌧️",
        label: "Hujan Ringan",
        pillClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
      };
    case "rain_moderate":
      return {
        emoji: "🌧️",
        label: "Hujan Sedang",
        pillClass: "bg-blue-600/15 text-blue-800 dark:text-blue-300 border-blue-600/35",
      };
    case "rain_heavy":
      return {
        emoji: "⛈️",
        label: "Hujan Lebat",
        pillClass: "bg-indigo-600/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/35",
      };
    case "thunderstorm":
      return {
        emoji: "⛈️",
        label: "Hujan Petir",
        pillClass: "bg-purple-600/15 text-purple-800 dark:text-purple-300 border-purple-500/35",
      };
    case "clear_night":
      return {
        emoji: "🌙",
        label: "Cerah Malam",
        pillClass: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-400/30",
      };
    case "partly_cloudy_night":
      return {
        emoji: "☁️",
        label: "Berawan Malam",
        pillClass: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
      };
  }
}

function fmtId1(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

export function buildPltsWeatherTooltipLines(slot: PltsBarWeatherSlot | null | undefined): string[] {
  if (!slot) return [];
  const meta = getPltsWeatherMeta(slot.weatherKey);
  const lines: string[] = [
    "────────────────────────────",
    `${meta.emoji} Cuaca Sidomukti, Pandaan: ${slot.label}`,
  ];

  const metrics: string[] = [];
  if (slot.tempC !== null) metrics.push(`Suhu ${fmtId1(slot.tempC)}°C`);
  if (slot.cloudPct !== null) metrics.push(`Awan ${Math.round(slot.cloudPct)}%`);
  if (slot.radiationWm2 !== null && slot.radiationWm2 > 0) metrics.push(`Radiasi ${Math.round(slot.radiationWm2)} W/m²`);
  if (slot.precipMm !== null && slot.precipMm > 1.0) metrics.push(`Hujan ${fmtId1(slot.precipMm)} mm`);
  if (metrics.length > 0) {
    lines.push(metrics.join(" • "));
  }

  if (slot.mode === "hourly" && slot.hourlyPoint) {
    const segs = slot.hourlyPoint.segments || [];
    if (segs.length > 1) {
      lines.push(`Perubahan Cuaca (${segs.length} kondisi):`);
      segs.slice(0, 12).forEach((seg) => {
        const sMeta = getPltsWeatherMeta(seg.weatherKey);
        const detailParts: string[] = [];
        if (seg.avgTempC !== null) detailParts.push(`${fmtId1(seg.avgTempC)}°C`);
        if (seg.precipMm !== null && seg.precipMm > 1.0) detailParts.push(`Hujan ${fmtId1(seg.precipMm)} mm`);
        else if (seg.avgCloudPct !== null) detailParts.push(`Awan ${Math.round(seg.avgCloudPct)}%`);
        const suffix = detailParts.length > 0 ? ` (${detailParts.join(", ")})` : "";
        lines.push(`• ${seg.range} | ${sMeta.emoji} ${seg.label}${suffix}`);
      });
      if (segs.length > 12) {
        lines.push(`• Lainnya | +${segs.length - 12} transisi menit lainnya`);
      }
    } else if (segs.length === 1) {
      const only = segs[0];
      const sMeta = getPltsWeatherMeta(only.weatherKey);
      const detailParts: string[] = [];
      if (only.avgTempC !== null) detailParts.push(`${fmtId1(only.avgTempC)}°C`);
      if (only.precipMm !== null && only.precipMm > 1.0) detailParts.push(`Hujan ${fmtId1(only.precipMm)} mm`);
      else if (only.avgCloudPct !== null) detailParts.push(`Awan ${Math.round(only.avgCloudPct)}%`);
      const suffix = detailParts.length > 0 ? ` (${detailParts.join(", ")})` : "";
      lines.push("Rentang Cuaca:");
      lines.push(`• ${only.range} | ${sMeta.emoji} ${only.label}${suffix}`);
    }
  } else if (slot.mode === "daily" && slot.dailyPoint) {
    const segs = slot.dailyPoint.segments || [];
    if (segs.length > 0) {
      lines.push("Kondisi Siang (06:00–17:59):");
      segs.slice(0, 5).forEach((seg) => {
        const sMeta = getPltsWeatherMeta(seg.weatherKey);
        lines.push(`• ${seg.range} | ${sMeta.emoji} ${seg.label}`);
      });
    }
  } else if (slot.mode === "monthly" && slot.monthlyPoint) {
    const m = slot.monthlyPoint;
    lines.push(`Rekap ${m.recordedDays} hari: ${m.sunnyDays} Cerah • ${m.cloudyDays} Berawan • ${m.rainyDays} Hujan`);
  }

  return lines;
}

/* ═══ CRISP VECTOR CANVAS WEATHER ICONS ABOVE CHART BARS ═══ */
function drawCloudPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.beginPath();
  ctx.arc(cx - 4.2 * scale, cy + 1.2 * scale, 3.6 * scale, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(cx - 0.8 * scale, cy - 1.8 * scale, 4.4 * scale, Math.PI * 1.05, Math.PI * 1.92);
  ctx.arc(cx + 4.0 * scale, cy + 0.6 * scale, 3.4 * scale, Math.PI * 1.45, Math.PI * 0.5);
  ctx.closePath();
}

function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, withRays: boolean) {
  ctx.save();
  if (withRays) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = Math.max(1.2, r * 0.28);
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (r * 1.32), cy + Math.sin(ang) * (r * 1.32));
      ctx.lineTo(cx + Math.cos(ang) * (r * 1.85), cy + Math.sin(ang) * (r * 1.85));
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, isDark: boolean) {
  ctx.save();
  ctx.fillStyle = isDark ? "#c7d2fe" : "#6366f1";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.25 * Math.PI, 1.75 * Math.PI, false);
  ctx.arc(cx + r * 0.48, cy - r * 0.15, r * 0.78, 1.65 * Math.PI, 0.35 * Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPltsCanvasWeatherIcon(
  ctx: CanvasRenderingContext2D,
  key: PltsWeatherKey,
  cx: number,
  cy: number,
  size: number,
  isDark: boolean,
  transitionCount = 1,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const s = size / 18;

  const cloudFillLight = key === "thunderstorm" || key === "rain_heavy"
    ? "#475569"
    : key === "rain_moderate" || key === "rain_light" || key === "overcast"
    ? "#64748b"
    : isDark
    ? "#cbd5e1"
    : "#94a3b8";

  const cloudStroke = isDark ? "#1e293b" : "#ffffff";

  switch (key) {
    case "clear_day":
      drawSun(ctx, cx, cy, 4.4 * s, true);
      break;

    case "clear_night":
      drawMoon(ctx, cx, cy, 5.4 * s, isDark);
      break;

    case "mainly_clear":
      drawSun(ctx, cx + 2.8 * s, cy - 2.4 * s, 3.6 * s, true);
      drawCloudPath(ctx, cx - 1.2 * s, cy + 2.2 * s, 0.85 * s);
      ctx.fillStyle = isDark ? "#e2e8f0" : "#cbd5e1";
      ctx.fill();
      ctx.strokeStyle = cloudStroke;
      ctx.lineWidth = 0.9 * s;
      ctx.stroke();
      break;

    case "partly_cloudy":
      drawSun(ctx, cx + 3.4 * s, cy - 3.0 * s, 3.1 * s, true);
      drawCloudPath(ctx, cx - 0.8 * s, cy + 1.8 * s, 1.0 * s);
      ctx.fillStyle = isDark ? "#cbd5e1" : "#94a3b8";
      ctx.fill();
      ctx.strokeStyle = cloudStroke;
      ctx.lineWidth = 0.9 * s;
      ctx.stroke();
      break;

    case "partly_cloudy_night":
      drawMoon(ctx, cx + 3.4 * s, cy - 3.0 * s, 3.5 * s, isDark);
      drawCloudPath(ctx, cx - 0.8 * s, cy + 1.8 * s, 0.95 * s);
      ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
      ctx.fill();
      break;

    case "overcast":
      drawCloudPath(ctx, cx + 1.8 * s, cy - 1.6 * s, 0.85 * s);
      ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
      ctx.fill();
      drawCloudPath(ctx, cx - 1.0 * s, cy + 1.4 * s, 1.0 * s);
      ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
      ctx.fill();
      ctx.strokeStyle = cloudStroke;
      ctx.lineWidth = 0.8 * s;
      ctx.stroke();
      break;

    case "fog":
      drawCloudPath(ctx, cx, cy - 1.4 * s, 0.9 * s);
      ctx.fillStyle = isDark ? "#94a3b8" : "#94a3b8";
      ctx.fill();
      ctx.strokeStyle = isDark ? "#cbd5e1" : "#64748b";
      ctx.lineWidth = 1.4 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 5.5 * s, cy + 4.4 * s);
      ctx.lineTo(cx + 5.5 * s, cy + 4.4 * s);
      ctx.moveTo(cx - 4.0 * s, cy + 7.0 * s);
      ctx.lineTo(cx + 4.0 * s, cy + 7.0 * s);
      ctx.stroke();
      break;

    case "drizzle":
    case "rain_light":
    case "rain_moderate":
    case "rain_heavy": {
      drawCloudPath(ctx, cx, cy - 1.8 * s, 0.98 * s);
      ctx.fillStyle = cloudFillLight;
      ctx.fill();
      const dropCount = key === "drizzle" ? 2 : key === "rain_heavy" ? 4 : 3;
      const dropOffsets =
        dropCount === 2
          ? [-2.2, 2.2]
          : dropCount === 3
          ? [-3.8, 0, 3.8]
          : [-4.8, -1.6, 1.6, 4.8];
      ctx.strokeStyle = key === "drizzle" ? "#38bdf8" : "#2563eb";
      ctx.lineWidth = (key === "rain_heavy" ? 1.7 : 1.4) * s;
      ctx.lineCap = "round";
      for (const dx of dropOffsets) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * s, cy + 3.2 * s);
        ctx.lineTo(cx + (dx - 1.2) * s, cy + (key === "drizzle" ? 5.8 : 7.0) * s);
        ctx.stroke();
      }
      break;
    }

    case "thunderstorm": {
      drawCloudPath(ctx, cx, cy - 2.0 * s, 1.0 * s);
      ctx.fillStyle = "#475569";
      ctx.fill();
      // Lightning bolt
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.moveTo(cx + 0.5 * s, cy + 1.2 * s);
      ctx.lineTo(cx - 2.4 * s, cy + 5.0 * s);
      ctx.lineTo(cx - 0.1 * s, cy + 5.0 * s);
      ctx.lineTo(cx - 1.5 * s, cy + 8.6 * s);
      ctx.lineTo(cx + 2.8 * s, cy + 4.1 * s);
      ctx.lineTo(cx + 0.4 * s, cy + 4.1 * s);
      ctx.closePath();
      ctx.fill();
      // Side raindrop
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.3 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 4.6 * s, cy + 3.4 * s);
      ctx.lineTo(cx - 5.6 * s, cy + 6.4 * s);
      ctx.moveTo(cx + 4.6 * s, cy + 3.4 * s);
      ctx.lineTo(cx + 3.6 * s, cy + 6.4 * s);
      ctx.stroke();
      break;
    }
  }

  // Transition indicator badge (+1, +2) when weather changed multiple times inside the same hour
  if (transitionCount > 1) {
    const bx = cx + 7.2 * s;
    const by = cy - 6.6 * s;
    const br = Math.max(4.5, 4.8 * s);
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDark ? "#0f172a" : "#ffffff";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.max(7, Math.round(7.5 * s))}px "IBM Plex Mono", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${Math.min(9, transitionCount - 1)}`, bx, by + 0.4);
  }

  ctx.restore();
}

export function createPltsWeatherIconsPlugin(
  slotsRef: MutableRefObject<(PltsBarWeatherSlot | null)[]>,
  isDarkRef: MutableRefObject<boolean>
): Plugin<"bar"> {
  return {
    id: "pltsWeatherIcons",
    afterDatasetsDraw(chart) {
      const slots = slotsRef.current;
      if (!slots || slots.length === 0) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales?.x;
      if (!xScale || !chartArea) return;

      const count = slots.length;
      const slotWidth = (chartArea.right - chartArea.left) / Math.max(1, count);
      const iconSize = slotWidth >= 28 ? 18 : slotWidth >= 20 ? 15 : 13;
      const stride = slotWidth < 15 ? 2 : 1;
      const isDark = isDarkRef.current;

      for (let i = 0; i < count; i += stride) {
        const slot = slots[i];
        if (!slot) continue;

        // Find highest (minimum pixel Y) visible bar across real POI datasets
        let topBarY: number | null = null;
        let barX: number | null = null;

        chart.data.datasets.forEach((ds: any, dsIndex: number) => {
          if (ds?._isWeatherAnchor) return;
          if (!chart.isDatasetVisible(dsIndex)) return;
          const raw = ds.data?.[i];
          if (raw === null || raw === undefined || Number(raw) <= 0) return;
          const meta = chart.getDatasetMeta(dsIndex);
          const el = meta?.data?.[i];
          if (!el) return;
          const props = el.getProps(["x", "y"], true);
          if (Number.isFinite(props.x) && Number.isFinite(props.y)) {
            barX = props.x;
            if (topBarY === null || props.y < topBarY) {
              topBarY = props.y;
            }
          }
        });

        const cx = barX !== null ? barX : xScale.getPixelForValue(i);
        if (!Number.isFinite(cx) || cx < chartArea.left - 4 || cx > chartArea.right + 4) continue;

        if (topBarY !== null) {
          const cy = Math.max(chartArea.top - 12, topBarY - Math.round(iconSize * 0.82) - 4);
          drawPltsCanvasWeatherIcon(ctx, slot.weatherKey, cx, cy, iconSize, isDark, slot.transitionCount, 1);
        } else if (slot.mode === "hourly") {
          // For 0 kWh hours that still have actual weather (e.g., heavy rain / overcast / night),
          // place a clean subtle icon near the baseline so the entire day's weather timeline stays visible.
          const cy = chartArea.bottom - Math.round(iconSize * 0.72) - 2;
          drawPltsCanvasWeatherIcon(ctx, slot.weatherKey, cx, cy, Math.max(12, iconSize - 2), isDark, slot.transitionCount, 0.78);
        }
      }
    },
  };
}

/* ═══ INLINE SVG ICON FOR LIVE WEATHER HEADER BADGE ═══ */
export function PltsWeatherSvgIcon({ weatherKey, className = "w-4 h-4" }: { weatherKey: PltsWeatherKey; className?: string }) {
  switch (weatherKey) {
    case "clear_day":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" fill="#f59e0b" />
          <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
          </g>
        </svg>
      );
    case "mainly_clear":
    case "partly_cloudy":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <circle cx="15.5" cy="8.5" r="3.5" fill="#f59e0b" />
          <path d="M15.5 2.8v1.4M21.2 8.5h-1.4M19.5 4.5l-1 1" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M7.5 19h9a3.5 3.5 0 0 0 .4-6.98A4.8 4.8 0 0 0 7.4 10.7 3.8 3.8 0 0 0 7.5 19Z" fill="#94a3b8" />
        </svg>
      );
    case "clear_night":
    case "partly_cloudy_night":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M15.5 3.8a7.2 7.2 0 1 0 4.7 12.6 6 6 0 0 1-4.7-12.6Z" fill="#6366f1" />
        </svg>
      );
    case "overcast":
    case "fog":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M6.8 17.5h10.5a3.7 3.7 0 0 0 .3-7.38A5.2 5.2 0 0 0 7.4 9a4.2 4.2 0 0 0-.6 8.5Z" fill="#64748b" />
        </svg>
      );
    case "drizzle":
    case "rain_light":
    case "rain_moderate":
    case "rain_heavy":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M6.5 14.5h11a3.4 3.4 0 0 0 .3-6.78A4.9 4.9 0 0 0 8.1 6.7a3.9 3.9 0 0 0-1.6 7.8Z" fill="#64748b" />
          <path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "thunderstorm":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M6.5 14h11a3.4 3.4 0 0 0 .3-6.78A4.9 4.9 0 0 0 8.1 6.2a3.9 3.9 0 0 0-1.6 7.8Z" fill="#475569" />
          <path d="M13 13.5l-2.6 4.2h2.1l-1.1 3.5 3.6-4.8h-2.2l1.2-2.9Z" fill="#facc15" />
        </svg>
      );
  }
}

const PLTS_TOOLTIP_EL_ID = "plts-weather-external-tooltip";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function destroyPltsExternalTooltip(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(PLTS_TOOLTIP_EL_ID);
  if (el) el.remove();
}

/**
 * Unclipped viewport-clamped HTML external tooltip for the PLTS Bar Chart.
 * Prevents long intra-hour minute-range weather lists (e.g. 6–12 segments from :00 to :59)
 * from being cut off at the bottom edge of the 290px chart canvas.
 */
export function createPltsExternalTooltipHandler(isDarkRef: MutableRefObject<boolean>) {
  return (context: { chart: any; tooltip: any }) => {
    if (typeof document === "undefined") return;
    const { chart, tooltip } = context;

    let tooltipEl = document.getElementById(PLTS_TOOLTIP_EL_ID) as HTMLDivElement | null;
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.id = PLTS_TOOLTIP_EL_ID;
      tooltipEl.style.position = "fixed";
      tooltipEl.style.pointerEvents = "none";
      tooltipEl.style.zIndex = "9999";
      tooltipEl.style.transition = "opacity 140ms ease, transform 140ms ease";
      tooltipEl.style.opacity = "0";
      tooltipEl.style.visibility = "hidden";
      document.body.appendChild(tooltipEl);
    }

    if (!tooltip || tooltip.opacity === 0) {
      tooltipEl.style.opacity = "0";
      tooltipEl.style.visibility = "hidden";
      return;
    }

    const isDark = isDarkRef.current;
    const textPrimary = isDark ? "#f8fafc" : "#0f172a";
    const textMuted = isDark ? "#94a3b8" : "#475569";
    const accentSky = isDark ? "#38bdf8" : "#0369a1";
    const dividerCol = isDark ? "rgba(71, 85, 105, 0.7)" : "rgba(226, 232, 240, 1)";

    tooltipEl.style.background = isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.99)";
    tooltipEl.style.color = textPrimary;
    tooltipEl.style.border = isDark ? "1px solid rgba(71, 85, 105, 0.85)" : "1px solid rgba(203, 213, 225, 0.95)";
    tooltipEl.style.borderRadius = "12px";
    tooltipEl.style.boxShadow = isDark
      ? "0 14px 32px rgba(2, 6, 23, 0.65)"
      : "0 12px 28px rgba(15, 23, 42, 0.14)";
    tooltipEl.style.padding = "13px 15px";
    tooltipEl.style.fontFamily = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    tooltipEl.style.fontVariantNumeric = "tabular-nums";
    tooltipEl.style.fontSize = "12.5px";
    tooltipEl.style.lineHeight = "1.5";
    tooltipEl.style.maxWidth = "min(430px, calc(100vw - 24px))";
    tooltipEl.style.minWidth = "290px";
    tooltipEl.style.letterSpacing = "0";

    const parts: string[] = [];

    // Collect rendered data lines first so we NEVER display an empty white box on 0-kWh / future slots
    const bodyItems: any[] = tooltip.body || [];
    const labelColors: any[] = tooltip.labelColors || [];
    const bodyParts: string[] = [];
    bodyItems.forEach((bItem, i) => {
      const lines: string[] = bItem?.lines || [];
      const col = labelColors[i];
      lines.forEach((line) => {
        if (!line) return;
        const swatch = col?.backgroundColor
          ? `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:7px;flex-shrink:0;background:${escapeHtml(
              String(col.backgroundColor)
            )};border:1px solid ${escapeHtml(String(col.borderColor || col.backgroundColor))}"></span>`
          : "";
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const k = line.slice(0, colonIdx).trim();
          const v = line.slice(colonIdx + 1).trim();
          bodyParts.push(
            `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:3px;font-size:12.5px;">` +
              `<span style="display:flex;align-items:center;color:${textMuted};font-weight:500;">${swatch}${escapeHtml(k)}</span>` +
              `<span style="color:${textPrimary};font-weight:600;text-align:right;">${escapeHtml(v)}</span>` +
            `</div>`
          );
        } else {
          bodyParts.push(
            `<div style="display:flex;align-items:center;font-size:12.5px;font-weight:600;margin-bottom:3px;color:${textPrimary};">${swatch}<span>${escapeHtml(
              line
            )}</span></div>`
          );
        }
      });
    });

    const afterBody: string[] = (tooltip.afterBody || []).filter(Boolean);
    const footerLines: string[] = (tooltip.footer || []).filter(Boolean);

    // Hide completely when no consumption/metrics exist (e.g. future hours or 0-kWh slots)
    if (bodyParts.length === 0 && afterBody.length === 0 && footerLines.length === 0) {
      tooltipEl.style.opacity = "0";
      tooltipEl.style.visibility = "hidden";
      return;
    }

    // Helper to render key-value or plain summary rows uniformly across PLN, PLTS, Monthly, and Equipment charts
    const renderKeyValOrLine = (rawLine: string, isSummarySection = false) => {
      const colonIdx = rawLine.indexOf(":");
      if (colonIdx > 0 && !rawLine.startsWith("http")) {
        const k = rawLine.slice(0, colonIdx).trim();
        const v = rawLine.slice(colonIdx + 1).trim();
        const isTotal = k === "Total" || k.startsWith("Total Konsumsi");
        const isDiff = k.startsWith("Selisih");
        let valColor = textPrimary;
        if (isDiff) {
          if (v.startsWith("+")) valColor = isDark ? "#f87171" : "#dc2626";
          else if (v.startsWith("-")) valColor = isDark ? "#34d399" : "#059669";
        }
        return (
          `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px;font-size:12.5px;margin-top:${
            isSummarySection ? "3px" : "2px"
          };">` +
            `<span style="color:${isTotal ? textPrimary : textMuted};font-weight:${isTotal ? "600" : "500"};flex-shrink:0;">${escapeHtml(
              k
            )}</span>` +
            `<span style="color:${valColor};font-weight:${isTotal ? "700" : "600"};text-align:right;">${escapeHtml(v)}</span>` +
          `</div>`
        );
      }
      return `<div style="font-size:12.5px;font-weight:600;margin-top:2px;color:${textPrimary};">${escapeHtml(rawLine)}</div>`;
    };

    // Title
    const titles: string[] = (tooltip.title || []).filter(Boolean);
    if (titles.length > 0) {
      parts.push(
        `<div style="font-size:13.5px;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${dividerCol};color:${textPrimary};">${titles
          .map(escapeHtml)
          .join("<br/>")}</div>`
      );
    }

    parts.push(...bodyParts);

    // AfterBody lines (PLTS totals & weather transitions, Monthly comparison breakdown & totals)
    let insertedMonthlySummaryDivider = false;
    afterBody.forEach((rawLine) => {
      if (rawLine.startsWith("────")) {
        parts.push(`<hr style="border:none;border-top:1px solid ${dividerCol};margin:8px 0;"/>`);
        return;
      }
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("•")) {
        const body = trimmed.slice(1).trim();
        const pipeIdx = body.indexOf("|");
        const isTimeRangeRow =
          pipeIdx > 0 && (/^\d{2}:\d{2}/.test(body) || body.startsWith("Lainnya"));
        if (isTimeRangeRow) {
          const timeCol = body.slice(0, pipeIdx).trim();
          const descCol = body.slice(pipeIdx + 1).trim();
          parts.push(
            `<div style="display:flex;align-items:baseline;gap:8px;font-size:12px;margin-top:3px;">` +
              `<span style="color:${textPrimary};font-weight:600;min-width:84px;flex-shrink:0;">${escapeHtml(timeCol)}</span>` +
              `<span style="color:${textPrimary};font-weight:500;">${escapeHtml(descCol)}</span>` +
            `</div>`
          );
        } else {
          const colonIdx = body.indexOf(":");
          if (colonIdx > 0 && !body.includes("|")) {
            parts.push(renderKeyValOrLine(body));
          } else if (colonIdx > 0) {
            const k = body.slice(0, colonIdx).trim();
            const v = body.slice(colonIdx + 1).trim();
            parts.push(
              `<div style="font-size:12px;margin-top:3px;color:${textMuted};">` +
                `<span style="font-weight:500;">${escapeHtml(k)}:</span> ` +
                `<span style="color:${textPrimary};font-weight:600;">${escapeHtml(v)}</span>` +
              `</div>`
            );
          } else {
            parts.push(
              `<div style="font-size:12px;font-weight:500;color:${textPrimary};margin-top:3px;">${escapeHtml(body)}</div>`
            );
          }
        }
      } else if (rawLine.includes("Cuaca Sidomukti")) {
        parts.push(
          `<div style="font-size:12.5px;font-weight:700;color:${accentSky};margin-bottom:3px;">${escapeHtml(rawLine)}</div>`
        );
      } else if (
        rawLine.startsWith("Perubahan Cuaca") ||
        rawLine.startsWith("Rentang Cuaca") ||
        rawLine.startsWith("Kondisi Siang")
      ) {
        parts.push(
          `<div style="font-size:12px;font-weight:600;margin-top:6px;margin-bottom:2px;color:${textMuted};">${escapeHtml(rawLine)}</div>`
        );
      } else if (
        rawLine.startsWith("Suhu ") ||
        rawLine.startsWith("Awan ") ||
        rawLine.startsWith("Radiasi ") ||
        rawLine.startsWith("Hujan ") ||
        rawLine.startsWith("Rekap ")
      ) {
        parts.push(
          `<div style="font-size:12px;font-weight:500;color:${textMuted};margin-bottom:2px;">${escapeHtml(rawLine)}</div>`
        );
      } else {
        if (!insertedMonthlySummaryDivider && (rawLine.startsWith("Total Konsumsi") || rawLine.startsWith("Total:"))) {
          insertedMonthlySummaryDivider = true;
          if (bodyParts.length > 0) {
            parts.push(`<hr style="border:none;border-top:1px solid ${dividerCol};margin:7px 0;"/>`);
          }
        }
        parts.push(renderKeyValOrLine(rawLine, true));
      }
    });

    // Footer lines (used by Konsumsi PLN stacked bar chart)
    if (footerLines.length > 0) {
      if (bodyParts.length > 0 || afterBody.length > 0) {
        parts.push(`<hr style="border:none;border-top:1px solid ${dividerCol};margin:7px 0;"/>`);
      }
      footerLines.forEach((rawLine) => {
        parts.push(renderKeyValOrLine(rawLine, true));
      });
    }

    tooltipEl.innerHTML = parts.join("");
    tooltipEl.style.visibility = "visible";
    tooltipEl.style.opacity = "1";

    // Compute viewport-safe position near hovered bar (never clips outside window or canvas)
    const canvasRect = chart.canvas.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    const caretViewportX = canvasRect.left + (tooltip.caretX ?? 0);
    const caretViewportY = canvasRect.top + (tooltip.caretY ?? 0);

    const margin = 12;
    let left = caretViewportX + 16;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = caretViewportX - tipRect.width - 16;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

    let top = caretViewportY - tipRect.height / 2;
    if (top + tipRect.height > window.innerHeight - margin) {
      top = window.innerHeight - tipRect.height - margin;
    }
    top = Math.max(margin, top);

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
  };
}
