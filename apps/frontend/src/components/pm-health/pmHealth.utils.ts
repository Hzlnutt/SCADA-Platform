import type { AnomalyType, HealthStatus, PmChecklistItem, SourceTable } from "./pmHealth.types";

export function fmtNumber(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return val.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function fmtDelta(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${fmtNumber(val, 2)} kWh`;
}

export function getLocalTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDaysAgoIso(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function anomalyTypeMeta(type: AnomalyType): {
  label: string;
  shortLabel: string;
  badgeClass: string;
} {
  switch (type) {
    case "DROP_TO_ZERO":
      return {
        label: "Drop ke 0 (Reset / Glitch)",
        shortLabel: "Drop ke 0",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
      };
    case "ENERGY_DECREASE":
      return {
        label: "Turun / Mundur (Naik-Turun)",
        shortLabel: "Energi Turun",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
      };
    case "ROLLOVER_16BIT":
      return {
        label: "Rollover Register 16-bit (65.535 → 0)",
        shortLabel: "Rollover 65.535",
        badgeClass: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30"
      };
    case "REBOUND_AFTER_DROP":
      return {
        label: "Naik Kembali Setelah Drop",
        shortLabel: "Rebound Naik-Turun",
        badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30"
      };
    case "NEGATIVE_ENERGY":
      return {
        label: "Nilai Negatif",
        shortLabel: "Negatif",
        badgeClass: "bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30"
      };
    case "ENERGY_SPIKE":
      return {
        label: "Lonjakan Ekstrem",
        shortLabel: "Lonjakan",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      };
    case "ENERGY_STUCK":
      return {
        label: "Tertahan / Stuck Saat Berbeban",
        shortLabel: "Energi Stuck",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      };
  }
}

export function healthStatusMeta(status: HealthStatus): {
  label: string;
  dotClass: string;
  badgeClass: string;
} {
  switch (status) {
    case "healthy":
      return {
        label: "Sehat",
        dotClass: "bg-emerald-500",
        badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
      };
    case "critical":
      return {
        label: "Bermasalah",
        dotClass: "bg-rose-500",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
      };
    case "warning":
      return {
        label: "Peringatan",
        dotClass: "bg-amber-500",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      };
    case "offline":
      return {
        label: "Offline",
        dotClass: "bg-slate-400",
        badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
      };
  }
}

export function sourceTableShort(table: SourceTable | null): string {
  if (table === "electric_pm_telemetry_minute") return "Per Menit";
  if (table === "electric_pm_telemetry") return "Per Jam";
  return "—";
}

export function getEmptyChecklistItem(pmId: string): PmChecklistItem {
  return {
    pmId,
    ewonChecked: false,
    endpointChecked: false,
    panelLcdChecked: false,
    ewonCheckedAt: null,
    endpointCheckedAt: null,
    panelLcdCheckedAt: null,
    notes: "",
    updatedAt: null,
    updatedBy: null
  };
}

export function getChecklistProgress(item?: PmChecklistItem | null): {
  checkedCount: number;
  total: number;
  isComplete: boolean;
  isPartial: boolean;
  status: "complete" | "partial" | "unchecked";
} {
  const checkedCount =
    (item?.ewonChecked ? 1 : 0) +
    (item?.endpointChecked ? 1 : 0) +
    (item?.panelLcdChecked ? 1 : 0);
  const isComplete = checkedCount === 3;
  const isPartial = checkedCount > 0 && checkedCount < 3;
  return {
    checkedCount,
    total: 3,
    isComplete,
    isPartial,
    status: isComplete ? "complete" : isPartial ? "partial" : "unchecked"
  };
}

let sharedAudioCtx: AudioContext | null = null;

export function playPmAnomalyChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }

    const now = sharedAudioCtx.currentTime;
    const notes = [880, 1174.66];
    notes.forEach((freq, idx) => {
      if (!sharedAudioCtx) return;
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.28);

      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.3);
    });
  } catch {
    // Ignore autoplay restrictions before user gesture
  }
}
