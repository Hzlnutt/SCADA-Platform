/**
 * PipeDefs.tsx
 * Taruh sebagai child PERTAMA di dalam <svg> canvas P&ID. Dipanggil sekali saja.
 *
 * Pattern yang tersedia:
 *   pipe-flow-h-r  → horizontal, ke KANAN  (→)
 *   pipe-flow-h-l  → horizontal, ke KIRI   (←)
 *   pipe-flow-v-d  → vertikal,   ke BAWAH  (↓)
 *   pipe-flow-v-u  → vertikal,   ke ATAS   (↑)
 */
export function PipeDefs() {
  return (
    <defs>

      {/* ─── Gradien metalik — HORIZONTAL (top → bottom) ─────────────────── */}
      <linearGradient id="pipe-grad-h" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#646566" />
        <stop offset="1%"   stopColor="#646566" />
        <stop offset="18%"  stopColor="#959595" />
        <stop offset="50%"  stopColor="#E0E0E0" />
        <stop offset="100%" stopColor="#666666" />
      </linearGradient>

      {/* ─── Gradien metalik — VERTIKAL (left → right) ───────────────────── */}
      <linearGradient id="pipe-grad-v" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#646566" />
        <stop offset="1%"   stopColor="#646566" />
        <stop offset="18%"  stopColor="#959595" />
        <stop offset="50%"  stopColor="#E0E0E0" />
        <stop offset="100%" stopColor="#666666" />
      </linearGradient>

      {/* ════════════════════════════════════════════════════════════════════
          FLOW PATTERNS — 4 arah
          Prinsip: ubah nilai "to" untuk membalik arah
            ke kanan  →  to="30,0"
            ke kiri   →  to="-30,0"
            ke bawah  →  to="0,30"
            ke atas   →  to="0,-30"
      ════════════════════════════════════════════════════════════════════ */}

      {/* → Horizontal KANAN */}
      <pattern id="pipe-flow-h-r" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ← Horizontal KIRI */}
      <pattern id="pipe-flow-h-l" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="-30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↓ Vertikal BAWAH */}
      <pattern id="pipe-flow-v-d" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↑ Vertikal ATAS */}
      <pattern id="pipe-flow-v-u" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,-30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

    </defs>
  );
}