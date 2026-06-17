import React from 'react';

interface PartitionProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  children?: React.ReactNode;
}

const Partition: React.FC<PartitionProps> = ({
  x = 0,
  y = 0,
  width = 200,
  height = 300,
  color = '#4A4D52',
  label,
  children,
}) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id="partitionGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color={color} />
          <stop offset="50%" stop-color={color} />
          <stop offset="100%" stop-color={color} />
        </linearGradient>
        <filter id="partitionShadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4" />
        </filter>
      </defs>

      {/* Badan sekat */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="url(#partitionGrad)"
        filter="url(#partitionShadow)"
        stroke="#2A2C30"
        strokeWidth="2"
        rx={2}
      />

      {/* Garis-garis detail sekat */}
      <line x1={5} y1={5} x2={width - 5} y2={5} stroke="#6A6F74" strokeWidth="1" />
      <line x1={5} y1={height - 5} x2={width - 5} y2={height - 5} stroke="#6A6F74" strokeWidth="1" />
      <line x1={5} y1={5} x2={5} y2={height - 5} stroke="#6A6F74" strokeWidth="1" />
      <line x1={width - 5} y1={5} x2={width - 5} y2={height - 5} stroke="#6A6F74" strokeWidth="1" />

      {/* Label sekat */}
      {label && (
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#D0D4D8"
            fontFamily="Arial, sans-serif"
            transform="rotate(-90)"
          >
            {label}
          </text>
        </g>
      )}

      {/* Komponen anak ditempatkan di dalam sekat */}
      {children}
    </g>
  );
};

export default Partition;