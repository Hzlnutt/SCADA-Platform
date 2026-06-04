/* ═══════════════════════════════════════════════════════════════════════════
   HEADER PIPE
   Pipa horizontal statis dengan dua flange tipis di ujung kiri dan kanan,
   masing-masing dilengkapi end cap (setengah ellipse) di ujung luar.
   Tidak ada shadow, tidak ada animasi.

   Props:
     x  — posisi X kiri atas (dari ujung cap kiri)
     y  — posisi Y kiri atas
     w  — lebar total (ujung cap kiri → ujung cap kanan)
     h  — tinggi total (= tinggi flange)
═══════════════════════════════════════════════════════════════════════════ */

interface HeaderPipeProps {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function HeaderPipe({ x, y, w, h }: HeaderPipeProps) {
  /* ── Proporsi ─────────────────────────────────────────────────────── */
  const flangeW   = Math.round(h * 0.18);   // lebar flange tipis
  const flangeH   = h;
  const capRx     = Math.round(h * 0.13);   // radius horizontal cap (tipis)
  const capRy     = h / 2;                  // radius vertikal cap = setengah tinggi

  const bodyInset = h * 0.06;
  const bodyY     = y + bodyInset;
  const bodyH     = h - bodyInset * 2;
  const bodyX     = x + flangeW;
  const bodyW     = w - flangeW * 2;

  const edgeT     = Math.max(2, h * 0.04);
  const edgeB     = Math.max(2, h * 0.04);
  const specH     = bodyH * 0.26;
  const specY     = bodyY + bodyH * 0.16;
  const rx        = Math.max(3, h * 0.05);

  const flangeXL  = x;
  const flangeXR  = x + w - flangeW;
  const capEndR   = flangeXR + flangeW;
  const capTop    = y;
  const capBot    = y + h;

  /* spekuler cap: lebih kecil, posisi atas */
  const sCapRx    = Math.round(capRx * 0.5);
  const sCapRy    = Math.round(capRy * 0.49);
  const sCapTop   = y + h * 0.12;

  const uid       = `hp-${x}-${y}`;
  const idBody    = `${uid}-b`;
  const idFlan    = `${uid}-f`;
  const idCapL    = `${uid}-cl`;
  const idCapR    = `${uid}-cr`;

  return (
    <g>
      <defs>
        {/* Gradien metalik body */}
        <linearGradient id={idBody} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#5a5b5c" />
          <stop offset="2%"   stopColor="#5a5b5c" />
          <stop offset="15%"  stopColor="#909090" />
          <stop offset="48%"  stopColor="#e8e8e8" />
          <stop offset="82%"  stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#6a6a6a" />
        </linearGradient>

        {/* Gradien metalik flange */}
        <linearGradient id={idFlan} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4a4b4c" />
          <stop offset="3%"   stopColor="#4a4b4c" />
          <stop offset="18%"  stopColor="#787878" />
          <stop offset="50%"  stopColor="#c8c8c8" />
          <stop offset="82%"  stopColor="#909090" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>

        {/* Gradien cap kiri: terang di dalam, gelap di ujung */}
        <linearGradient id={idCapL} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%"   stopColor="#888888" />
          <stop offset="40%"  stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#4a4a4a" />
        </linearGradient>

        {/* Gradien cap kanan */}
        <linearGradient id={idCapR} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#888888" />
          <stop offset="40%"  stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#4a4a4a" />
        </linearGradient>
      </defs>

      {/* ─── Body tengah ──────────────────────────────────────────────── */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} fill={`url(#${idBody})`} />
      <rect x={bodyX} y={bodyY}                  width={bodyW} height={edgeT} fill="#3a3b3c" />
      <rect x={bodyX} y={bodyY + bodyH - edgeB}  width={bodyW} height={edgeB} fill="#2a2b2c" />
      <rect x={bodyX} y={specY} width={bodyW} height={specH} fill="white" opacity={0.10} />

      {/* ─── Flange KIRI ──────────────────────────────────────────────── */}
      <rect x={flangeXL} y={y} width={flangeW} height={flangeH} rx={rx} fill={`url(#${idFlan})`} />
      <rect x={flangeXL} y={y}                     width={flangeW} height={edgeT} rx={rx} fill="#3a3b3c" />
      <rect x={flangeXL} y={y + flangeH - edgeB}   width={flangeW} height={edgeB} rx={rx} fill="#2a2b2c" />
      <rect x={flangeXL} y={y + flangeH * 0.16}    width={flangeW} height={flangeH * 0.26} fill="white" opacity={0.09} />
      <rect x={flangeXL + flangeW - 2} y={y}       width={2} height={flangeH} fill="#2a2b2c" opacity={0.50} />

      {/* End cap KIRI — ellipse arc ke luar, tanpa stroke */}
      <path
        d={`M ${flangeXL} ${capTop} A ${capRx} ${capRy} 0 0 0 ${flangeXL} ${capBot}`}
        fill={`url(#${idCapL})`}
        stroke="none"
      />
      {/* Spekuler cap kiri */}
      <path
        d={`M ${flangeXL} ${sCapTop} A ${sCapRx} ${sCapRy} 0 0 0 ${flangeXL} ${sCapTop + sCapRy * 2 * 0.6}`}
        fill="white"
        opacity={0.13}
        stroke="none"
      />

      {/* ─── Flange KANAN ─────────────────────────────────────────────── */}
      <rect x={flangeXR} y={y} width={flangeW} height={flangeH} rx={rx} fill={`url(#${idFlan})`} />
      <rect x={flangeXR} y={y}                     width={flangeW} height={edgeT} rx={rx} fill="#3a3b3c" />
      <rect x={flangeXR} y={y + flangeH - edgeB}   width={flangeW} height={edgeB} rx={rx} fill="#2a2b2c" />
      <rect x={flangeXR} y={y + flangeH * 0.16}    width={flangeW} height={flangeH * 0.26} fill="white" opacity={0.09} />
      <rect x={flangeXR} y={y}                     width={2} height={flangeH} fill="#2a2b2c" opacity={0.50} />

      {/* End cap KANAN — ellipse arc ke luar, tanpa stroke */}
      <path
        d={`M ${capEndR} ${capTop} A ${capRx} ${capRy} 0 0 1 ${capEndR} ${capBot}`}
        fill={`url(#${idCapR})`}
        stroke="none"
      />
      {/* Spekuler cap kanan */}
      <path
        d={`M ${capEndR} ${sCapTop} A ${sCapRx} ${sCapRy} 0 0 1 ${capEndR} ${sCapTop + sCapRy * 2 * 0.6}`}
        fill="white"
        opacity={0.13}
        stroke="none"
      />
    </g>
  );
}