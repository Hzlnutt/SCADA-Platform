import React from "react";

type StatusType = "on" | "off" | "standby" | "maintenance";

interface SensorIndicatorProps {
  x: number;
  y: number;
  value: boolean | StatusType | number | null | string;
  w?: number;
  h?: number;
  unit?: string;
  warningThreshold?: number | null;
  alarmThreshold?: number | null;
  decimalPlaces?: number;
  padding?: number;
  thresholdDirection?: "above" | "below";
  mode?: "numeric" | "onoff";
  color?: string;
  enableAlert?: boolean;
  suppressAlert?: boolean;
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
  padding = 4,
  thresholdDirection = "above",
  mode = "numeric",
  color: customColor,
  enableAlert = true,
  suppressAlert = false,
}: SensorIndicatorProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  const getIsaState = (): {
    textColor: string;
    borderColor: string;
    bgColor: string;
    display: string;
    isAlarm: boolean;
    isWarning: boolean;
  } => {
    // ── 1. Value Null / Kosong ──────────────────────────────────────
    if (value === null || value === undefined) {
      return {
        textColor: "#64748b",
        borderColor: "#334155",
        bgColor: "#0f172a",
        display: "--",
        isAlarm: false,
        isWarning: false,
      };
    }

    // ── 2. Custom Color Override (jika diberikan secara eksplisit) ──
    if (customColor) {
      const display = unit ? `${value}${unit}` : String(value);
      return {
        textColor: customColor,
        borderColor: customColor === "#00cc00" ? "#334155" : customColor,
        bgColor: "#0f172a",
        display,
        isAlarm: false,
        isWarning: false,
      };
    }

    // ── 3. String status Offline / "XX" / Belum Ada API ─────────────
    if (typeof value === "string") {
      const upper = value.toUpperCase().trim();
      if (
        upper.includes("BELUM") ||
        upper.includes("NO API") ||
        upper === "XX" ||
        upper.includes("TIDAK")
      ) {
        return {
          textColor: "#64748b", // Dimmed neutral slate (tidak memicu alarm palsu)
          borderColor: "#334155",
          bgColor: "#0f172a",
          display: "xx",
          isAlarm: false,
          isWarning: false,
        };
      }
    }

    // ── 4. Mode ON/OFF (ISA-101 Monokromatik) ───────────────────────
    if (mode === "onoff") {
      let isOn = false;
      let isOff = false;
      let isStandby = false;
      let isMaint = false;

      if (typeof value === "string") {
        const valLower = value.toLowerCase().trim();
        isOn = valLower === "on" || valLower === "running" || valLower === "1" || valLower === "true";
        isOff = valLower === "off" || valLower === "stop" || valLower === "0" || valLower === "false";
        isStandby = valLower === "standby";
        isMaint = valLower === "maintenance";
      } else if (typeof value === "boolean") {
        isOn = value;
        isOff = !value;
      } else if (typeof value === "number") {
        isOn = value === 1;
        isOff = value === 0;
      }

      if (isOn) {
        return {
          textColor: "#f8fafc", // White neutral
          borderColor: "#475569", // Medium slate
          bgColor: "#1e293b", // Active slate container
          display: "ON",
          isAlarm: false,
          isWarning: false,
        };
      }
      if (isOff) {
        return {
          textColor: "#64748b", // Muted slate
          borderColor: "#1e293b",
          bgColor: "#090d16",
          display: "OFF",
          isAlarm: false,
          isWarning: false,
        };
      }
      if (isStandby) {
        return {
          textColor: "#94a3b8",
          borderColor: "#334155",
          bgColor: "#0f172a",
          display: "STBY",
          isAlarm: false,
          isWarning: false,
        };
      }
      if (isMaint) {
        return {
          textColor: "#cbd5e1",
          borderColor: "#475569",
          bgColor: "#1e293b",
          display: "MAINT",
          isAlarm: false,
          isWarning: false,
        };
      }

      return {
        textColor: "#64748b",
        borderColor: "#334155",
        bgColor: "#0f172a",
        display: String(value),
        isAlarm: false,
        isWarning: false,
      };
    }

    // ── 5. Mode NUMERIK (ISA-101 Anomaly Focus) ─────────────────────
    let numValue = 0;
    if (typeof value === "number") {
      numValue = value;
    } else if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        numValue = parsed;
      }
    }

    const isAlertActive = enableAlert !== false && suppressAlert !== true;
    let isAlarm = false;
    let isWarning = false;

    if (isAlertActive) {
      if (thresholdDirection === "above") {
        if (alarmThreshold !== null && alarmThreshold !== undefined && numValue >= alarmThreshold) {
          isAlarm = true;
        } else if (warningThreshold !== null && warningThreshold !== undefined && numValue >= warningThreshold) {
          isWarning = true;
        }
      } else {
        if (alarmThreshold !== null && alarmThreshold !== undefined && numValue <= alarmThreshold) {
          isAlarm = true;
        } else if (warningThreshold !== null && warningThreshold !== undefined && numValue <= warningThreshold) {
          isWarning = true;
        }
      }
    }

    const baseValue = numValue.toFixed(decimalPlaces);
    const display = unit ? `${baseValue}${unit}` : baseValue;

    if (isAlarm) {
      return {
        textColor: "#f87171", // Vibrant High-contrast Alarm Red
        borderColor: "#ef4444",
        bgColor: "#2d0a0a",
        display,
        isAlarm: true,
        isWarning: false,
      };
    }

    if (isWarning) {
      return {
        textColor: "#fbbf24", // Vibrant High-contrast Warning Amber
        borderColor: "#f59e0b",
        bgColor: "#261a05",
        display,
        isAlarm: false,
        isWarning: true,
      };
    }

    // Kondisi Normal: Monokromatik slate/putih bersih (Bukan hijau neon)
    return {
      textColor: "#f8fafc",
      borderColor: "#334155",
      bgColor: "#0f172a",
      display,
      isAlarm: false,
      isWarning: false,
    };
  };

  const { textColor, borderColor, bgColor, display, isAlarm, isWarning } = getIsaState();

  const availableW = w - padding * 2;
  const availableH = h - padding * 2;
  const fontSize = Math.max(
    10,
    Math.min(availableH * 0.72, availableW / (Math.max(display.length, 1) * 0.62))
  );

  return (
    <g>
      {/* Box Container Monokromatik / Anomaly */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={isAlarm ? 2 : isWarning ? 1.5 : 1}
      >
        {isAlarm && (
          <animate
            attributeName="stroke-opacity"
            values="1;0.4;1"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </rect>

      {/* Nilai Sensor / Status */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Plus Jakarta Sans', 'IBM Plex Mono', 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        fill={textColor}
        letterSpacing="0.02em"
      >
        {display}
      </text>

      {/* Anomaly Indicator Badge (Level 1 Alarm / Level 2 Warning) */}
      {isAlarm && (
        <circle cx={x + w - 4} cy={y + 4} r={2.5} fill="#ef4444" />
      )}
      {isWarning && (
        <polygon
          points={`${x + w - 7},${y + 7} ${x + w - 2},${y + 7} ${x + w - 4.5},${y + 2}`}
          fill="#f59e0b"
        />
      )}
    </g>
  );
}