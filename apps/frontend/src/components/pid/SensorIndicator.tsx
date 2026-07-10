import React from "react";

type StatusType = 'on' | 'off' | 'standby' | 'maintenance';

interface SensorIndicatorProps {
  x: number;
  y: number;
  value: boolean | StatusType | number | null | string;
  w?: number;
  h?: number;
  unit?: string;
  warningThreshold?: number; // Tidak ada nilai default
  alarmThreshold?: number;   // Tidak ada nilai default
  decimalPlaces?: number;
  padding?: number;
  thresholdDirection?: 'above' | 'below';
  mode?: 'numeric' | 'onoff';
}

export function SensorIndicator({
  x,
  y,
  value,
  w = 100,
  h = 60,
  unit = "",
  warningThreshold,
  alarmThreshold,
  decimalPlaces = 0,
  padding = 5,
  thresholdDirection = 'above',
  mode = 'numeric',
}: SensorIndicatorProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  const getColorAndText = (): { color: string; display: string } => {
    // ── Jika value null ────────────────────────────────────────────────
    if (value === null) {
      return { color: "#444444", display: "--" };
    }

    // ── Jika value adalah string info status (seperti "API TIDAK TERKIRIM") ──
    if (typeof value === 'string' && (value.includes("API") || value.includes("TIDAK"))) {
      return { color: "#ff2222", display: value };
    }


    // ── Mode ON/OFF dengan status khusus ──────────────────────────────
    if (mode === 'onoff') {
      if (typeof value === 'string') {
        switch (value) {
          case 'on':  return { color: "#00cc00", display: "ON" };
          case 'off': return { color: "#ff2222", display: "OFF" };
          case 'standby': return { color: "#ffaa00", display: "STANDBY" };
          case 'maintenance': return { color: "#888888", display: "MAINTENANCE" };
          default: return { color: "#444444", display: "??" };
        }
      }
      if (typeof value === 'boolean') {
        return value 
          ? { color: "#00cc00", display: "ON" }
          : { color: "#ff2222", display: "OFF" };
      }
      if (typeof value === 'number') {
        return value === 1
          ? { color: "#00cc00", display: "ON" }
          : { color: "#ff2222", display: "OFF" };
      }
    }

    // ── Mode NUMERIC ──────────────────────────────────────────────────
    const numValue = typeof value === 'number' ? value : 0;
    
    // Jika warningThreshold dan alarmThreshold TIDAK diberikan, warna tetap hijau
    if (warningThreshold === undefined || alarmThreshold === undefined) {
      const baseValue = numValue.toFixed(decimalPlaces);
      const display = unit ? `${baseValue}${unit}` : baseValue;
      return { color: "#00cc00", display };
    }

    // Jika threshold diberikan, jalankan logika
    let color = "#00cc00"; // default green
    if (thresholdDirection === 'above') {
      if (numValue >= alarmThreshold)   color = "#ff2222";
      else if (numValue >= warningThreshold) color = "#ffaa00";
    } else {
      if (numValue <= alarmThreshold)   color = "#ff2222";
      else if (numValue <= warningThreshold) color = "#ffaa00";
    }

    const baseValue = numValue.toFixed(decimalPlaces);
    const display = unit ? `${baseValue}${unit}` : baseValue;
    return { color, display };
  };

  const { color, display } = getColorAndText();

  const availableW = w - padding * 2;
  const availableH = h - padding * 2;
  const fontSize = Math.max(10, Math.min(
    availableH * 0.75,
    availableW / (display.length * 0.6)
  ));

  return (
    <g>
      <rect
        x={x} y={y}
        width={w} height={h}
        rx={3}
        fill="#111111"
        stroke={color}
        strokeWidth={2}
      />
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Arial Black', sans-serif"
        fontWeight="900"
        fontSize={fontSize}
        fill={color}
      >
        {display}
      </text>
    </g>
  );
}