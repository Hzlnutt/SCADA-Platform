/**
 * PipeDefs.tsx
 * Taruh sebagai child PERTAMA di dalam <svg> canvas P&ID. Dipanggil sekali saja.
 *
 * Pattern yang tersedia:
 *   COLD WATER (CYAN):
 *     pipe-flow-h-r-cold  → horizontal, ke KANAN (→)
 *     pipe-flow-h-l-cold  → horizontal, ke KIRI (←)
 *     pipe-flow-v-d-cold  → vertikal, ke BAWAH (↓)
 *     pipe-flow-v-u-cold  → vertikal, ke ATAS (↑)
 *     pipe-flow-bend-h-cold → bend horizontal
 *     pipe-flow-bend-v-cold → bend vertikal
 *
 *   WARM WATER (RED, full):
 *     pipe-flow-h-r-warm  → horizontal, ke KANAN (→)
 *     pipe-flow-h-l-warm  → horizontal, ke KIRI (←)
 *     pipe-flow-v-d-warm  → vertikal, ke BAWAH (↓)
 *     pipe-flow-v-u-warm  → vertikal, ke ATAS (↑)
 *     pipe-flow-bend-h-warm → bend horizontal
 *     pipe-flow-bend-v-warm → bend vertikal
 *
 *   RETURN WATER (RED, half opacity — area → tank):
 *     pipe-flow-h-r-return  → horizontal, ke KANAN (→)
 *     pipe-flow-h-l-return  → horizontal, ke KIRI (←)
 *     pipe-flow-v-d-return  → vertikal, ke BAWAH (↓)
 *     pipe-flow-v-u-return  → vertikal, ke ATAS (↑)
 *     pipe-flow-bend-h-return → bend horizontal
 *     pipe-flow-bend-v-return → bend vertikal
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

      {/* ─── Gradien untuk BEND ──────────────────────────────────────────── */}
      <linearGradient id="pipe-grad-bend" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#646566" />
        <stop offset="18%"  stopColor="#959595" />
        <stop offset="50%"  stopColor="#E0E0E0" />
        <stop offset="100%" stopColor="#666666" />
      </linearGradient>

      {/* ════════════════════════════════════════════════════════════════════
          FLOW PATTERNS — COLD WATER (CYAN/BLUE) #00CCFF
      ════════════════════════════════════════════════════════════════════ */}

      {/* → Horizontal KANAN (COLD) */}
      <pattern id="pipe-flow-h-r-cold" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ← Horizontal KIRI (COLD) */}
      <pattern id="pipe-flow-h-l-cold" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="-30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↓ Vertikal BAWAH (COLD) */}
      <pattern id="pipe-flow-v-d-cold" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↑ Vertikal ATAS (COLD) */}
      <pattern id="pipe-flow-v-u-cold" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,-30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Horizontal (COLD) */}
      <pattern id="pipe-flow-bend-h-cold" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Vertikal (COLD) */}
      <pattern id="pipe-flow-bend-v-cold" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#00CCFF" opacity="0.5" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ════════════════════════════════════════════════════════════════════
          FLOW PATTERNS — WARM WATER (RED, full) #E00000
          Digunakan untuk jalur supply: tank → CT
      ════════════════════════════════════════════════════════════════════ */}

      {/* → Horizontal KANAN (WARM) */}
      <pattern id="pipe-flow-h-r-warm" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#E00000" opacity="0.6" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ← Horizontal KIRI (WARM) */}
      <pattern id="pipe-flow-h-l-warm" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#E00000" opacity="0.6" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="-30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↓ Vertikal BAWAH (WARM) */}
      <pattern id="pipe-flow-v-d-warm" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#E00000" opacity="0.6" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↑ Vertikal ATAS (WARM) */}
      <pattern id="pipe-flow-v-u-warm" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#E00000" opacity="0.6" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,-30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Horizontal (WARM) */}
      <pattern id="pipe-flow-bend-h-warm" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#E00000" opacity="0.6" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Vertikal (WARM) */}
      <pattern id="pipe-flow-bend-v-warm" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#E00000" opacity="0.6" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ════════════════════════════════════════════════════════════════════
          FLOW PATTERNS — RETURN WATER (RED, half opacity) #E00000
          Digunakan untuk jalur return: area → tank
          Opacity pattern = 0.3 (setengah dari warm 0.6)
      ════════════════════════════════════════════════════════════════════ */}

      {/* → Horizontal KANAN (RETURN) */}
      <pattern id="pipe-flow-h-r-return" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#E00000" opacity="0.3" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ← Horizontal KIRI (RETURN) */}
      <pattern id="pipe-flow-h-l-return" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#E00000" opacity="0.3" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="-30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↓ Vertikal BAWAH (RETURN) */}
      <pattern id="pipe-flow-v-d-return" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#E00000" opacity="0.3" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* ↑ Vertikal ATAS (RETURN) */}
      <pattern id="pipe-flow-v-u-return" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#E00000" opacity="0.3" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,-30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Horizontal (RETURN) */}
      <pattern id="pipe-flow-bend-h-return" x="0" y="0" width="30" height="1"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="14" height="1" fill="#E00000" opacity="0.3" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="30,0"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

      {/* Bend Vertikal (RETURN) */}
      <pattern id="pipe-flow-bend-v-return" x="0" y="0" width="1" height="30"
               patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="14" fill="#E00000" opacity="0.3" />
        <animateTransform attributeName="patternTransform"
          type="translate" from="0,0" to="0,30"
          dur="0.55s" repeatCount="indefinite" />
      </pattern>

    </defs>
  );
}