/* ═══════════════════════════════════════════════════════════════════════════
   Y-STRAINER
   Compact Y-strainer dengan:
   - 1 body vertikal + flange atas & bawah
   - 1 cabang miring ke atas kanan (-45°) di tengah hub, posisi agak bawah
   - Hub penutup memanjang dari bawah flange atas hingga atas flange bawah
   - Tanpa end cap

   Props:
     x    — posisi X kiri atas bounding box
     y    — posisi Y kiri atas bounding box
     size — skala ukuran (default 200)
═══════════════════════════════════════════════════════════════════════════ */

interface YStrainerProps {
  x?: number;
  y?: number;
  size?: number;
}

export function YStrainer({ x = 0, y = 0, size = 200 }: YStrainerProps) {
  /* ── Desain asli dalam koordinat internal (origin 0,0) ───────────
     Total height internal: 222px  (282 - 60)
     Total width internal:  90px   (298..388 → dibuat 0..90 → flangeW=90)
     Kita normalkan origin ke 0,0:
       semua X geser -298, semua Y geser -60
  ─────────────────────────────────────────────────────────────────── */

  // Ukuran internal (sudah di-offset ke 0,0)
  const IW = 90;    // internal width  (flange width)
  const IH = 222;   // internal height (dari y=0 flange atas s/d y=222 bawah flange bawah)

  // Scale
  const sx = size / IW;
  const sy = (size * (IH / IW)) / IH;   // proporsional — tinggi ikut lebar

  const t  = (vx: number, vy: number): [number, number] => [x + vx * sx, y + vy * sy];
  const sw = (v: number) => v * sx;
  const sh = (v: number) => v * sy;

  /* ── Koordinat internal (origin 0,0) ─────────────────────────────
     Offset: X -= 298, Y -= 60
     flange: x=0..90  (w=90)
     pipe:   x=16..68 (w=52)
     hub:    x=6..78  (w=72)
  ─────────────────────────────────────────────────────────────────── */

  // Flange
  const fX = 0, fW = 90, fH = 26;

  // Pipe vertikal
  const pX = 16, pW = 52;

  // Hub
  const hX = 6, hW = 72;

  // Y positions (internal, Y -= 60)
  const flanTopY  = 0;     // flange atas
  const pipeTopY1 = 26;    // pipe atas mulai (bawah flange atas)
  const pipeTopY2 = 44;    // pipe atas selesai (h=18)
  const pipeBotY1 = 178;   // pipe bawah mulai
  const pipeBotY2 = 196;   // pipe bawah selesai (h=18)
  const flanBotY  = 196;   // flange bawah mulai
  const flanBotY2 = 222;   // flange bawah selesai

  // Hub
  const hubY1 = pipeTopY1; // 26
  const hubY2 = flanBotY;  // 196

  // Pivot cabang (cx internal, cy internal)
  const pivX = 42;   // center x internal
  const pivY = 150;  // diturunkan agar flange cabang tidak tabrakan flange atas

  // Cabang pipe: dari pivot ke atas 82px, flange di ujung
  const brPipeY1 = pivY - 82;  // 68
  const brPipeY2 = pivY;       // 150
  const brFlanY  = pivY - 108; // 42

  const uid = `ys-${x}-${y}-${size}`;

  // Helper: pivot dalam koordinat SVG absolut
  const [rpx, rpy] = t(pivX, pivY);

  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-bv`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#5a5b5c"/>
          <stop offset="2%"   stopColor="#5a5b5c"/>
          <stop offset="15%"  stopColor="#909090"/>
          <stop offset="48%"  stopColor="#e8e8e8"/>
          <stop offset="82%"  stopColor="#b0b0b0"/>
          <stop offset="100%" stopColor="#6a6a6a"/>
        </linearGradient>
        <linearGradient id={`${uid}-fl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4a4b4c"/>
          <stop offset="15%"  stopColor="#787878"/>
          <stop offset="50%"  stopColor="#c8c8c8"/>
          <stop offset="82%"  stopColor="#909090"/>
          <stop offset="100%" stopColor="#505050"/>
        </linearGradient>
        <linearGradient id={`${uid}-hub`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#4a4b4c"/>
          <stop offset="18%"  stopColor="#888888"/>
          <stop offset="50%"  stopColor="#dedede"/>
          <stop offset="82%"  stopColor="#a0a0a0"/>
          <stop offset="100%" stopColor="#505050"/>
        </linearGradient>
      </defs>

      {/* ── Pipe atas ─────────────────────────────────────────────── */}
      <rect x={t(pX,pipeTopY1)[0]} y={t(pX,pipeTopY1)[1]}
            width={sw(pW)} height={sh(pipeTopY2-pipeTopY1)}
            fill={`url(#${uid}-bv)`}/>
      <rect x={t(pX,pipeTopY1)[0]}       y={t(pX,pipeTopY1)[1]} width={sw(3.5)} height={sh(pipeTopY2-pipeTopY1)} fill="#3a3b3c"/>
      <rect x={t(pX+pW-3.5,pipeTopY1)[0]} y={t(pX,pipeTopY1)[1]} width={sw(3.5)} height={sh(pipeTopY2-pipeTopY1)} fill="#2a2b2c" opacity={0.5}/>
      <rect x={t(pX+8,pipeTopY1+4)[0]}    y={t(pX,pipeTopY1+4)[1]} width={sw(15)} height={sh(10)} fill="white" opacity={0.08}/>

      {/* ── Flange atas ───────────────────────────────────────────── */}
      <rect x={t(fX,flanTopY)[0]} y={t(fX,flanTopY)[1]}
            width={sw(fW)} height={sh(fH)} rx={sw(5)}
            fill={`url(#${uid}-fl)`}/>
      <rect x={t(fX,flanTopY)[0]}      y={t(fX,flanTopY)[1]}      width={sw(fW)} height={sh(3.5)} rx={sw(2)} fill="#3a3b3c"/>
      <rect x={t(fX,flanTopY+fH-3)[0]} y={t(fX,flanTopY+fH-3)[1]} width={sw(fW)} height={sh(3)}   rx={sw(2)} fill="#2a2b2c" opacity={0.6}/>
      <rect x={t(fX,flanTopY+4)[0]}    y={t(fX,flanTopY+4)[1]}    width={sw(fW)} height={sh(10)}             fill="white" opacity={0.09}/>

      {/* ── Pipe bawah ────────────────────────────────────────────── */}
      <rect x={t(pX,pipeBotY1)[0]} y={t(pX,pipeBotY1)[1]}
            width={sw(pW)} height={sh(pipeBotY2-pipeBotY1)}
            fill={`url(#${uid}-bv)`}/>
      <rect x={t(pX,pipeBotY1)[0]}        y={t(pX,pipeBotY1)[1]} width={sw(3.5)} height={sh(pipeBotY2-pipeBotY1)} fill="#3a3b3c"/>
      <rect x={t(pX+pW-3.5,pipeBotY1)[0]} y={t(pX,pipeBotY1)[1]} width={sw(3.5)} height={sh(pipeBotY2-pipeBotY1)} fill="#2a2b2c" opacity={0.5}/>
      <rect x={t(pX+8,pipeBotY1+4)[0]}    y={t(pX,pipeBotY1+4)[1]} width={sw(15)} height={sh(10)} fill="white" opacity={0.08}/>

      {/* ── Flange bawah ──────────────────────────────────────────── */}
      <rect x={t(fX,flanBotY)[0]} y={t(fX,flanBotY)[1]}
            width={sw(fW)} height={sh(fH)} rx={sw(5)}
            fill={`url(#${uid}-fl)`}/>
      <rect x={t(fX,flanBotY)[0]}      y={t(fX,flanBotY)[1]}      width={sw(fW)} height={sh(3.5)} rx={sw(2)} fill="#3a3b3c"/>
      <rect x={t(fX,flanBotY+fH-3)[0]} y={t(fX,flanBotY+fH-3)[1]} width={sw(fW)} height={sh(3)}   rx={sw(2)} fill="#2a2b2c" opacity={0.6}/>
      <rect x={t(fX,flanBotY+4)[0]}    y={t(fX,flanBotY+4)[1]}    width={sw(fW)} height={sh(10)}             fill="white" opacity={0.09}/>

      {/* ── Cabang miring -45° ────────────────────────────────────── */}
      <g transform={`rotate(-45, ${rpx}, ${rpy})`}>
        {/* pipe cabang (w=66 lebih tebal) */}
        <rect x={t(pX-7,brPipeY1)[0]} y={t(pX-7,brPipeY1)[1]}
              width={sw(66)} height={sh(brPipeY2-brPipeY1)}
              fill={`url(#${uid}-bv)`}/>
        <rect x={t(pX-7,brPipeY1)[0]}       y={t(pX-7,brPipeY1)[1]} width={sw(4)}  height={sh(brPipeY2-brPipeY1)} fill="#3a3b3c"/>
        <rect x={t(pX-7+62,brPipeY1)[0]}    y={t(pX-7,brPipeY1)[1]} width={sw(4)}  height={sh(brPipeY2-brPipeY1)} fill="#2a2b2c" opacity={0.5}/>
        <rect x={t(pX-7+9,brPipeY1+8)[0]}   y={t(pX-7,brPipeY1+8)[1]} width={sw(18)} height={sh(brPipeY2-brPipeY1-16)} fill="white" opacity={0.08}/>
        {/* flange cabang (w=90) */}
        <rect x={t(fX-3,brFlanY)[0]} y={t(fX-3,brFlanY)[1]}
              width={sw(90)} height={sh(fH)} rx={sw(5)}
              fill={`url(#${uid}-fl)`}/>
        <rect x={t(fX-3,brFlanY)[0]}      y={t(fX-3,brFlanY)[1]}      width={sw(90)} height={sh(3.5)} rx={sw(2)} fill="#3a3b3c"/>
        <rect x={t(fX-3,brFlanY+fH-3)[0]} y={t(fX-3,brFlanY+fH-3)[1]} width={sw(90)} height={sh(3)}   rx={sw(2)} fill="#2a2b2c" opacity={0.6}/>
        <rect x={t(fX-3,brFlanY+4)[0]}    y={t(fX-3,brFlanY+4)[1]}    width={sw(90)} height={sh(10)}             fill="white" opacity={0.09}/>
      </g>

      {/* ── Hub penutup ───────────────────────────────────────────── */}
      <rect x={t(hX,hubY1)[0]} y={t(hX,hubY1)[1]}
            width={sw(hW)} height={sh(hubY2-hubY1)}
            fill={`url(#${uid}-hub)`}/>
      <rect x={t(hX,hubY1)[0]}        y={t(hX,hubY1)[1]}        width={sw(4)}  height={sh(hubY2-hubY1)} fill="#3a3b3c"/>
      <rect x={t(hX+hW-4,hubY1)[0]}   y={t(hX,hubY1)[1]}        width={sw(4)}  height={sh(hubY2-hubY1)} fill="#2a2b2c" opacity={0.5}/>
      <rect x={t(hX+10,hubY1+8)[0]}   y={t(hX,hubY1+8)[1]}      width={sw(20)} height={sh(hubY2-hubY1-16)} fill="white" opacity={0.09}/>
      {/* rim atas & bawah hub */}
      <rect x={t(hX,hubY1)[0]}   y={t(hX,hubY1)[1]}   width={sw(hW)} height={sh(3)} fill="#3a3b3c"/>
      <rect x={t(hX,hubY2-3)[0]} y={t(hX,hubY2-3)[1]} width={sw(hW)} height={sh(3)} fill="#2a2b2c" opacity={0.7}/>
      {/* highlight atas hub */}
      <rect x={t(hX+10,hubY1+8)[0]} y={t(hX,hubY1+8)[1]} width={sw(22)} height={sh(26)} fill="white" opacity={0.10}/>
    </g>
  );
}