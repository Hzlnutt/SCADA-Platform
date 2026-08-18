/* ═══════════════════════════════════════════════════════════════════════════
   PIPE HORIZONTAL & VERTIKAL
   Support: cold water (cyan), warm water (RED #E00000), return water (RED half opacity)
═══════════════════════════════════════════════════════════════════════════ */

interface PipeHProps {
  x: number;
  y: number;
  w: number;
  h: number;
  on?: boolean;
  dir?: "right" | "left";
  type?: "cold" | "warm" | "return";
}

interface PipeVProps {
  x: number;
  y: number;
  w: number;
  h: number;
  on?: boolean;
  dir?: "down" | "up";
  type?: "cold" | "warm" | "return";
}

/* ═══════════════════════════════════════════════════════════════════════════
   PIPE HORIZONTAL
   dir="right" → air mengalir ke kanan  →
   dir="left"  → air mengalir ke kiri   ←
   type="cold"   → air dingin (cyan)
   type="warm"   → air panas supply (merah penuh)   — tank → CT
   type="return" → air panas return (merah ½ opacity) — area → tank
═══════════════════════════════════════════════════════════════════════════ */
export function PipeH({ x, y, w, h, on = false, dir = "right", type = "cold" }: PipeHProps) {
  const edgeH   = Math.max(1.5, h * 0.09);
  const shadowH = Math.max(2,   h * 0.14);
  const specY   = y + h * 0.33;
  const specH   = h * 0.26;
  const flowPad = Math.max(1,   h * 0.10);
  const flowH   = h - flowPad * 2;

  const isRed       = type === "warm" || type === "return";
  const flowColor   = isRed ? "#E00000" : "#0077AA";
  const baseOpacity = type === "return" ? 0.09 : 0.18;

  const flowPattern =
    type === "cold"
      ? (dir === "left" ? "url(#pipe-flow-h-l-cold)"   : "url(#pipe-flow-h-r-cold)")
      : type === "warm"
      ? (dir === "left" ? "url(#pipe-flow-h-l-warm)"   : "url(#pipe-flow-h-r-warm)")
      :  (dir === "left" ? "url(#pipe-flow-h-l-return)" : "url(#pipe-flow-h-r-return)");

  return (
    <g>
      {/* Shadow bawah */}
      <rect x={x} y={y + h} width={w} height={shadowH} fill="#0a0a0a" opacity={0.45} />

      {/* Body metalik */}
      <rect x={x} y={y} width={w} height={h} fill="url(#pipe-grad-h)" />

      {/* Edge atas */}
      <rect x={x} y={y} width={w} height={edgeH} fill="#3a3b3c" />

      {/* Spekuler */}
      <rect x={x} y={specY} width={w} height={specH} fill="white" opacity={0.07} />

      {/* Flow layer */}
      <g opacity={on ? 1 : 0} style={{ transition: "opacity 0.45s ease" }}>
        <rect x={x} y={y}            width={w} height={h}      fill={flowColor} opacity={baseOpacity} />
        <rect x={x} y={y + flowPad}  width={w} height={flowH}  fill={flowPattern} />
        <rect x={x} y={y + h * 0.20} width={w} height={h * 0.32} fill="white"   opacity={0.09} />
        <rect x={x} y={y + h * 0.75} width={w} height={h * 0.28} fill="#001a2e" opacity={0.28} />
      </g>
    </g>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   PIPE VERTIKAL
   dir="down" → air mengalir ke bawah  ↓
   dir="up"   → air mengalir ke atas   ↑
   type="cold"   → air dingin (cyan)
   type="warm"   → air panas supply (merah penuh)   — tank → CT
   type="return" → air panas return (merah ½ opacity) — area → tank
═══════════════════════════════════════════════════════════════════════════ */
export function PipeV({ x, y, w, h, on = false, dir = "down", type = "cold" }: PipeVProps) {
  const edgeW   = Math.max(1.5, w * 0.09);
  const shadowW = Math.max(2,   w * 0.14);
  const specX   = x + w * 0.33;
  const specW   = w * 0.26;
  const flowPad = Math.max(1,   w * 0.10);
  const flowW   = w - flowPad * 2;

  const isRed       = type === "warm" || type === "return";
  const flowColor   = isRed ? "#E00000" : "#0077AA";
  const baseOpacity = type === "return" ? 0.09 : 0.18;

  const flowPattern =
    type === "cold"
      ? (dir === "up" ? "url(#pipe-flow-v-u-cold)"   : "url(#pipe-flow-v-d-cold)")
      : type === "warm"
      ? (dir === "up" ? "url(#pipe-flow-v-u-warm)"   : "url(#pipe-flow-v-d-warm)")
      :  (dir === "up" ? "url(#pipe-flow-v-u-return)" : "url(#pipe-flow-v-d-return)");

  return (
    <g>
      {/* Shadow kanan */}
      <rect x={x + w} y={y} width={shadowW} height={h} fill="#0a0a0a" opacity={0.45} />

      {/* Body metalik */}
      <rect x={x} y={y} width={w} height={h} fill="url(#pipe-grad-v)" />

      {/* Edge kiri */}
      <rect x={x} y={y} width={edgeW} height={h} fill="#3a3b3c" />

      {/* Spekuler */}
      <rect x={specX} y={y} width={specW} height={h} fill="white" opacity={0.07} />

      {/* Flow layer */}
      <g opacity={on ? 1 : 0} style={{ transition: "opacity 0.45s ease" }}>
        <rect x={x}            y={y} width={w}      height={h} fill={flowColor} opacity={baseOpacity} />
        <rect x={x + flowPad}  y={y} width={flowW}  height={h} fill={flowPattern} />
        <rect x={x + w * 0.20} y={y} width={w * 0.32} height={h} fill="white"   opacity={0.09} />
        <rect x={x + w * 0.75} y={y} width={w * 0.28} height={h} fill="#001a2e" opacity={0.28} />
      </g>
    </g>
  );
}