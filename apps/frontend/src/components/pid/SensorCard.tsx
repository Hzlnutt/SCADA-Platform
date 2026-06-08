import React from "react";

interface SensorCardProps {
  x?: number;
  y?: number;
  width?: number;
  title: string;
  // Mode lama (1 nilai)
  value?: string | number;
  unit?: string;
  // Mode baru (banyak nilai)
  values?: { value: string | number; unit?: string }[];
  colorType?: "blue" | "green";
}

const SensorCard: React.FC<SensorCardProps> = ({
  x = 0,
  y = 0,
  width = 200, // Sedikit dilebarkan untuk 2 nilai
  title,
  value,
  unit,
  values,
  colorType = "blue",
}) => {
  // ─── Warna berdasarkan tipe ──────────────────────────────────────────────
  const colors = {
    blue: {
      pill: "#0B3B60",
      border: "#CCCCCC",
    },
    green: {
      pill: "#0b5228",
      border: "#CCCCCC",
    },
  };

  const activeColor = colors[colorType];

  // ─── Layout ──────────────────────────────────────────────────────────────
  const padding = 10;
  const pillHeight = 34;
  const pillY = padding;
  const valueY = pillY + pillHeight + 32;
  const cardHeight = valueY + 24;

  // ─── Konten Nilai ────────────────────────────────────────────────────────
  let displayContent: React.ReactNode;

  if (values && values.length > 0) {
    // Jika menggunakan mode values (array)
    const parts = values.map((item) => 
      `${item.value}${item.unit ? ' ' + item.unit : ''}`
    );
    displayContent = <tspan>{parts.join(' / ')}</tspan>;
  } else {
    // Fallback ke mode lama (value + unit)
    displayContent = <tspan>{value}{unit ? ' ' + unit : ''}</tspan>;
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* ── Border Card ──────────────────────────────────────────────────── */}
      <rect
        x={0}
        y={0}
        width={width}
        height={cardHeight}
        fill="white"
        stroke={activeColor.border}
        strokeWidth={1.5}
        rx={2}
      />

      {/* ── Pill / Rounded Top ──────────────────────────────────────────── */}
      <rect
        x={padding}
        y={pillY}
        width={width - padding * 2}
        height={pillHeight}
        fill={activeColor.pill}
        rx={pillHeight / 2}
      />

      {/* ── Teks Judul ────────────────────────────────────────────────────── */}
      <text
        x={width / 2}
        y={pillY + pillHeight / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
        fill="white"
        fontFamily="sans-serif"
      >
        {title}
      </text>

      {/* ── Nilai (Tunggal atau Ganda) ───────────────────────────────────── */}
      <text
        x={width / 2}
        y={valueY}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="28"
        fontWeight="bold"
        fill="#000000"
        fontFamily="sans-serif"
      >
        {displayContent}
      </text>
    </g>
  );
};

export default SensorCard;