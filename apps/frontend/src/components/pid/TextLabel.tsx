import React from 'react';

type Props = {
  text: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  hasBorder?: boolean;
  fontSize?: number; // <-- Tambahan baru
};

const LabelComponent: React.FC<Props> = ({ 
  text, 
  x = 0, 
  y = 0, 
  w = 200, 
  h = 60, 
  hasBorder = false,
  fontSize: customFontSize, // <-- Bisa diatur dari luar
}) => {
  const padding = 8; 

  if (w < 20 || h < 20 || !text) return null;

  const availableWidth = w - (padding * 2);
  const availableHeight = h - (padding * 2);

  // Hitung ukuran font otomatis jika customFontSize tidak diberikan
  const fontSizeByWidth = (availableWidth / text.length) * 1.2;
  const fontSizeByHeight = availableHeight * 0.9;
  let autoFontSize = Math.min(fontSizeByWidth, fontSizeByHeight);
  autoFontSize = Math.min(autoFontSize, 80);
  autoFontSize = Math.max(autoFontSize, 8);

  // Gunakan customFontSize jika ada, fallback ke autoFontSize
  const fontSize = customFontSize ?? autoFontSize;

  return (
    <g>
      {/* Background putih hanya jika ada border */}
      {hasBorder && (
        <rect x={x} y={y} width={w} height={h} fill="white" rx={2} />
      )}

      {/* Border Biru */}
      {hasBorder && (
        <rect 
          x={x} 
          y={y} 
          width={w} 
          height={h} 
          fill="none" 
          stroke="#0B3B60" 
          strokeWidth="3" 
          rx={2}
        />
      )}

      {/* Teks Label */}
      <text 
        x={x + w / 2} 
        y={y + h / 2} 
        dominantBaseline="middle" 
        textAnchor="middle" 
        fontSize={fontSize} 
        fontFamily="Arial Black, sans-serif" 
        fontWeight="900" 
        fill="#000000"
      >
        {text}
      </text>
    </g>
  );
};

export default LabelComponent;