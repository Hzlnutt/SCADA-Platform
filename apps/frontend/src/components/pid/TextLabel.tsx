// LabelComponent.tsx
import React from 'react';

type Props = {
  text: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  hasBorder?: boolean;
};

const LabelComponent: React.FC<Props> = ({ 
  text, 
  x = 0, 
  y = 0, 
  w = 200, 
  h = 60, 
  hasBorder = false 
}) => {
  // PADDING LEBIH KECIL (6px) agar teks lebih mengisi kotak
  const padding = 6; 

  if (w < 20 || h < 20 || !text) return null;

  // Lebar dan tinggi yang tersedia untuk teks setelah dikurangi padding
  const availableWidth = w - (padding * 2);
  const availableHeight = h - (padding * 2);

  // Hitung ukuran font agar pas di availableWidth
  // Faktor 1.2 lebih besar dari sebelumnya karena padding kecil
  const fontSizeByWidth = (availableWidth / text.length) * 1.2;
  
  // Hitung ukuran font agar pas di availableHeight
  const fontSizeByHeight = availableHeight * 0.9;

  // Pilih ukuran terkecil agar muat di kedua sumbu
  let fontSize = Math.min(fontSizeByWidth, fontSizeByHeight);

  // Batasi ukuran agar tidak terlalu besar atau terlalu kecil
  fontSize = Math.min(fontSize, 80); // Batas maksimal font
  fontSize = Math.max(fontSize, 8);  // Batas minimal font

  return (
    <g>
      {/* Background putih */}
      <rect x={x} y={y} width={w} height={h} fill="white" rx={2} />

      {/* Border Biru */}
      {hasBorder && (
        <rect 
          x={x} 
          y={y} 
          width={w} 
          height={h} 
          fill="none" 
          stroke="#0000FF" 
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