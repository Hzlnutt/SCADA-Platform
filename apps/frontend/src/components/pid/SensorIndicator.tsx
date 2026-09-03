import React from "react";

type StatusType = 'on' | 'off' | 'standby' | 'maintenance';

interface SensorIndicatorProps {
  x: number;
  y: number;
  value: boolean | StatusType | number | null | string;
  w?: number;
  h?: number;
  unit?: string;
  warningThreshold?: number | null; // Tidak ada nilai default
  alarmThreshold?: number | null;   // Tidak ada nilai default
  decimalPlaces?: number;
  padding?: number;
  thresholdDirection?: 'above' | 'below';
  mode?: 'numeric' | 'onoff';
  color?: string;
  enableAlert?: boolean;
  suppressAlert?: boolean;
  isStopped?: boolean;
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
  color: customColor,
  enableAlert = true,
  suppressAlert = false,
  isStopped = false,
}: SensorIndicatorProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  const getColorAndText = (): { color: string; display: string } => {
    // ── Jika mesin mati / stopped secara eksplisit ────────────────────
    if (isStopped || value === "OFF" || value === "off") {
      return { color: "#ef4444", display: "OFF" };
    }

    // ── Jika value null atau undefined ────────────────────────────────
    if (value === null || value === undefined) {
      return { color: isStopped ? "#ef4444" : "#64748b", display: "--" };
    }

    // ── Jika customColor diberikan ────────────────────────────────────
    if (customColor) {
      const display = unit ? `${value}${unit}` : String(value);
      return { color: customColor, display };
    }

    // ── Jika value adalah string info status (seperti "Belum Ada API" atau "XX") ──
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper.includes("BELUM") || upper.includes("NO API") || upper === "XX" || upper.includes("TIDAK")) {
        return { color: "#ef4444", display: "xx" };
      }
    }

    // ── Mode ON/OFF dengan status khusus ──────────────────────────────
    if (mode === 'onoff') {
      if (typeof value === 'string') {
        switch (value.toLowerCase()) {
          case 'on':  return { color: "#10b981", display: "ON" };
          case 'off': return { color: "#ef4444", display: "OFF" };
          case 'standby': return { color: "#f59e0b", display: "STANDBY" };
          case 'maintenance': return { color: "#888888", display: "MAINTENANCE" };
          default: return { color: "#64748b", display: "??" };
        }
      }
      if (typeof value === 'boolean') {
        return value 
          ? { color: "#10b981", display: "ON" }
          : { color: "#ef4444", display: "OFF" };
      }
      if (typeof value === 'number') {
        return value === 1
          ? { color: "#10b981", display: "ON" }
          : { color: "#ef4444", display: "OFF" };
      }
    }

    // ── Mode NUMERIC ──────────────────────────────────────────────────
    let numValue: number | null = null;
    if (typeof value === 'number') {
      numValue = value;
    } else if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        numValue = parsed;
      }
    }

    if (numValue === null) {
      return { color: "#64748b", display: "--" };
    }
    
    const isAlertActive = enableAlert !== false && suppressAlert !== true;

    // Jika alert tidak diaktifkan, warna default emerald/green
    if (!isAlertActive) {
      const baseValue = numValue.toFixed(decimalPlaces);
      const display = unit ? `${baseValue}${unit}` : baseValue;
      return { color: "#10b981", display };
    }

    // Jika threshold diberikan, jalankan logika
    let color = "#10b981"; // default green
    if (thresholdDirection === 'above') {
      if (alarmThreshold !== null && alarmThreshold !== undefined && numValue >= alarmThreshold) color = "#ef4444";
      else if (warningThreshold !== null && warningThreshold !== undefined && numValue >= warningThreshold) color = "#f59e0b";
    } else {
      if (alarmThreshold !== null && alarmThreshold !== undefined && numValue <= alarmThreshold) color = "#ef4444";
      else if (warningThreshold !== null && warningThreshold !== undefined && numValue <= warningThreshold) color = "#f59e0b";
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
    availableW / (Math.max(1, display.length) * 0.6)
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