/**
 * PipeDefs.tsx - ISA-101 High-Performance Monochromatic HMI Standard
 * Pola aliran pipa yang tenang dan bebas warna alarm (merah dicadangkan 100% untuk anomali)
 */
export function PipeDefs() {
  return (
    <defs>
      {/* ─── Gradien metalik — HORIZONTAL (top → bottom) ─────────────────── */}
      <linearGradient id="pipe-grad-h" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#334155" />
        <stop offset="15%"  stopColor="#64748b" />
        <stop offset="50%"  stopColor="#cbd5e1" />
        <stop offset="85%"  stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      {/* ─── Gradien metalik — VERTIKAL (left → right) ───────────────────── */}
      <linearGradient id="pipe-grad-v" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#334155" />
        <stop offset="15%"  stopColor="#64748b" />
        <stop offset="50%"  stopColor="#cbd5e1" />
        <stop offset="85%"  stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      {/* ─── Gradien untuk BEND ──────────────────────────────────────────── */}
      <linearGradient id="pipe-grad-bend" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#334155" />
        <stop offset="15%"  stopColor="#64748b" />
        <stop offset="50%"  stopColor="#cbd5e1" />
        <stop offset="85%"  stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      {/* ════════════════════════════════════════════════════════════════════
          FLOW PATTERNS — COLD WATER / SUPPLY (SUBDUED SLATE BLUE) #38bdf8 (0.28 opacity)
      ════════════════════════════════════════════════════════════════════ */}

      {/* → Horizontal KANAN (COLD) */}
      <pattern id="pipe-flow-h-r-cold" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#38bdf8" opacity="0.3" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ← Horizontal KIRI (COLD) */}
      <pattern id="pipe-flow-h-l-cold" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#38bdf8" opacity="0.3" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="-30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ↓ Vertikal BAWAH (COLD) */}
      <pattern id="pipe-flow-v-d-cold" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#38bdf8" opacity="0.3" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ↑ Vertikal ATAS (COLD) */}
      <pattern id="pipe-flow-v-u-cold" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#38bdf8" opacity="0.3" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,-30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Horizontal (COLD) */}
      <pattern id="pipe-flow-bend-h-cold" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#38bdf8" opacity="0.3" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Vertikal (COLD) */}
      <pattern id="pipe-flow-bend-v-cold" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#38bdf8" opacity="0.3" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ════════════════════════════════════════════════════════════════════
          FLOW PATTERNS — WARM WATER / CT INLET (MUTED SLATE-GRAY) #94a3b8 (0.35 opacity)
      ════════════════════════════════════════════════════════════════════ */}

      {/* → Horizontal KANAN (WARM) */}
      <pattern id="pipe-flow-h-r-warm" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#94a3b8" opacity="0.35" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ← Horizontal KIRI (WARM) */}
      <pattern id="pipe-flow-h-l-warm" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#94a3b8" opacity="0.35" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="-30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ↓ Vertikal BAWAH (WARM) */}
      <pattern id="pipe-flow-v-d-warm" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#94a3b8" opacity="0.35" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ↑ Vertikal ATAS (WARM) */}
      <pattern id="pipe-flow-v-u-warm" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#94a3b8" opacity="0.35" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,-30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Horizontal (WARM) */}
      <pattern id="pipe-flow-bend-h-warm" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#94a3b8" opacity="0.35" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Vertikal (WARM) */}
      <pattern id="pipe-flow-bend-v-warm" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#94a3b8" opacity="0.35" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ════════════════════════════════════════════════════════════════════
          FLOW PATTERNS — RETURN WATER (CHARCOAL SLATE) #64748b (0.28 opacity)
      ════════════════════════════════════════════════════════════════════ */}

      {/* → Horizontal KANAN (RETURN) */}
      <pattern id="pipe-flow-h-r-return" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#64748b" opacity="0.28" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ← Horizontal KIRI (RETURN) */}
      <pattern id="pipe-flow-h-l-return" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#64748b" opacity="0.28" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="-30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ↓ Vertikal BAWAH (RETURN) */}
      <pattern id="pipe-flow-v-d-return" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#64748b" opacity="0.28" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* ↑ Vertikal ATAS (RETURN) */}
      <pattern id="pipe-flow-v-u-return" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#64748b" opacity="0.28" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,-30" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Horizontal (RETURN) */}
      <pattern id="pipe-flow-bend-h-return" x="0" y="0" width="30" height="1" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#64748b" opacity="0.28" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="30,0" dur="0.8s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Vertikal (RETURN) */}
      <pattern id="pipe-flow-bend-v-return" x="0" y="0" width="1" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#64748b" opacity="0.28" />
        <animateTransform attributeName="patternTransform" type="translate" from="0,0" to="0,30" dur="0.8s" repeatCount="indefinite" />
      </pattern>
    </defs>
  );
}