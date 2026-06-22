import React, { useId } from "react";

interface PipeTProps {
  x: number;
  y: number;
  armLength: number;       // panjang lengan dari pusat ke ujung
  thickness?: number;      // tebal pipa (diameter luar)
  direction?: 'down' | 'up' | 'left' | 'right';
}

export function PipeT({
  x,
  y,
  armLength,
  thickness = 20,
  direction = 'down',
}: PipeTProps) {
  const uid = useId().replace(/:/g, "_");
  const halfThick = thickness / 2;

  // Flange tipis, kotak, masuk ke dalam
  const flangeWidth = thickness * 1.2;   // lebar flange (tegak lurus pipa)
  const flangeLength = thickness * 0.18; // panjang flange tipis
  const inset = flangeLength * 0.8;      // masuk ke dalam

  // Tentukan orientasi
  const isHorizontalMain = direction === 'down' || direction === 'up';

  let mainRect: { x: number; y: number; w: number; h: number };
  let branchRect: { x: number; y: number; w: number; h: number };
  let flange1: { x: number; y: number; w: number; h: number }; // ujung kiri/atas
  let flange2: { x: number; y: number; w: number; h: number }; // ujung kanan/bawah
  let flangeBranch: { x: number; y: number; w: number; h: number };

  if (isHorizontalMain) {
    // Batang utama horizontal
    const mainLeft = x - armLength;
    const mainRight = x + armLength;
    const mainY = y - halfThick;
    mainRect = { x: mainLeft, y: mainY, w: armLength * 2, h: thickness };

    // Cabang vertikal
    const isDown = direction === 'down';
    const branchX = x - halfThick;
    const branchY = isDown ? y : y - armLength;
    branchRect = { x: branchX, y: branchY, w: thickness, h: armLength };

    // Flange kiri
    flange1 = {
      x: mainLeft + inset,
      y: mainY + (thickness - flangeWidth) / 2,
      w: flangeLength,
      h: flangeWidth,
    };
    // Flange kanan
    flange2 = {
      x: mainRight - flangeLength - inset,
      y: mainY + (thickness - flangeWidth) / 2,
      w: flangeLength,
      h: flangeWidth,
    };
    // Flange cabang
    if (isDown) {
      flangeBranch = {
        x: branchX + (thickness - flangeWidth) / 2,
        y: branchY + armLength - flangeLength - inset,
        w: flangeWidth,
        h: flangeLength,
      };
    } else {
      flangeBranch = {
        x: branchX + (thickness - flangeWidth) / 2,
        y: branchY + inset,
        w: flangeWidth,
        h: flangeLength,
      };
    }
  } else {
    // Batang utama vertikal
    const mainTop = y - armLength;
    const mainBottom = y + armLength;
    const mainX = x - halfThick;
    mainRect = { x: mainX, y: mainTop, w: thickness, h: armLength * 2 };

    // Cabang horizontal
    const isLeft = direction === 'left';
    const branchY = y - halfThick;
    const branchX = isLeft ? x - armLength : x;
    branchRect = { x: branchX, y: branchY, w: armLength, h: thickness };

    // Flange atas
    flange1 = {
      x: mainX + (thickness - flangeWidth) / 2,
      y: mainTop + inset,
      w: flangeWidth,
      h: flangeLength,
    };
    // Flange bawah
    flange2 = {
      x: mainX + (thickness - flangeWidth) / 2,
      y: mainBottom - flangeLength - inset,
      w: flangeWidth,
      h: flangeLength,
    };
    // Flange cabang
    if (isLeft) {
      flangeBranch = {
        x: branchX + inset,
        y: branchY + (thickness - flangeWidth) / 2,
        w: flangeLength,
        h: flangeWidth,
      };
    } else {
      flangeBranch = {
        x: branchX + armLength - flangeLength - inset,
        y: branchY + (thickness - flangeWidth) / 2,
        w: flangeLength,
        h: flangeWidth,
      };
    }
  }

  // Gradien IDs
  const gBodyHoriz = `body_horiz_${uid}`;
  const gBodyVert = `body_vert_${uid}`;
  const gFlangeH = `flange_h_${uid}`;
  const gFlangeV = `flange_v_${uid}`;

  return (
    <g>
      <defs>
        <linearGradient id={gBodyHoriz} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#5a5b5c" />
          <stop offset="2%" stopColor="#5a5b5c" />
          <stop offset="15%" stopColor="#909090" />
          <stop offset="48%" stopColor="#e8e8e8" />
          <stop offset="82%" stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#6a6a6a" />
        </linearGradient>
        <linearGradient id={gBodyVert} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#5a5b5c" />
          <stop offset="2%" stopColor="#5a5b5c" />
          <stop offset="15%" stopColor="#909090" />
          <stop offset="48%" stopColor="#e8e8e8" />
          <stop offset="82%" stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#6a6a6a" />
        </linearGradient>
        <linearGradient id={gFlangeH} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#4a4b4c" />
          <stop offset="15%" stopColor="#787878" />
          <stop offset="50%" stopColor="#c8c8c8" />
          <stop offset="82%" stopColor="#909090" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>
        <linearGradient id={gFlangeV} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#4a4b4c" />
          <stop offset="15%" stopColor="#787878" />
          <stop offset="50%" stopColor="#c8c8c8" />
          <stop offset="82%" stopColor="#909090" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>
      </defs>

      {/* Layer belakang: cabang */}
      <rect
        x={branchRect.x}
        y={branchRect.y}
        width={branchRect.w}
        height={branchRect.h}
        fill={isHorizontalMain ? `url(#${gBodyVert})` : `url(#${gBodyHoriz})`}
        rx={0}
      />

      {/* Batang utama */}
      <rect
        x={mainRect.x}
        y={mainRect.y}
        width={mainRect.w}
        height={mainRect.h}
        fill={isHorizontalMain ? `url(#${gBodyHoriz})` : `url(#${gBodyVert})`}
        rx={thickness * 0.2}
      />

      {/* Flange ujung 1 (kiri/atas) */}
      <rect x={flange1.x} y={flange1.y} width={flange1.w} height={flange1.h} fill={`url(#${gFlangeH})`} rx={0} />
      <rect x={flange1.x} y={flange1.y} width={flange1.w} height={flange1.h * 0.25} fill="#FFFFFF" opacity="0.15" rx={0} />

      {/* Flange ujung 2 (kanan/bawah) */}
      <rect x={flange2.x} y={flange2.y} width={flange2.w} height={flange2.h} fill={`url(#${gFlangeH})`} rx={0} />
      <rect x={flange2.x} y={flange2.y} width={flange2.w} height={flange2.h * 0.25} fill="#FFFFFF" opacity="0.15" rx={0} />

      {/* Flange cabang */}
      <rect
        x={flangeBranch.x}
        y={flangeBranch.y}
        width={flangeBranch.w}
        height={flangeBranch.h}
        fill={isHorizontalMain ? `url(#${gFlangeV})` : `url(#${gFlangeH})`}
        rx={0}
      />
      <rect
        x={flangeBranch.x}
        y={flangeBranch.y}
        width={flangeBranch.w}
        height={flangeBranch.h * 0.25}
        fill="#FFFFFF"
        opacity="0.15"
        rx={0}
      />
    </g>
  );
}