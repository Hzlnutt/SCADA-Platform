import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl, deleteJson, getJson, patchJson, postJson, putJson } from "../../services/api.client";
import { getAccessToken } from "../../store/auth.store";
import type {
  CrosscheckAiConfigStatus,
  CrosscheckComparisonRow,
  CrosscheckDetailResponse,
  CrosscheckExtractedValue,
  CrosscheckImageItem,
  CrosscheckOverallStatus,
  CrosscheckPairSummary,
  CrosscheckParamKey,
  CrosscheckParamSpec,
  CrosscheckRowStatus,
  CrosscheckSource,
  CrosscheckSourceTag,
  CrosscheckToleranceMode,
  PmCatalogMeta,
  PmChecklistItem,
  PmChecklistPatch,
  PmCrosscheckRecord,
  PmCrosscheckReport,
  PmCrosscheckSummaryItem,
  PmHealthSummary
} from "./pmHealth.types";
import { fmtNumber, getLocalTodayIso } from "./pmHealth.utils";

interface PmCrosscheckPanelProps {
  pms: PmHealthSummary[];
  catalog: PmCatalogMeta[];
  selectedPmId: string;
  onSelectPmId: (pmId: string) => void;
  summaries: Record<string, PmCrosscheckSummaryItem>;
  onSummaryUpdated: (pmId: string, summary: PmCrosscheckSummaryItem | null) => void;
  checklistMap: Record<string, PmChecklistItem>;
  isChecklistUnlocked: boolean;
  checklistRemainingLabel: string | null;
  onRequestUnlock: () => void;
  onUpdateChecklist: (pmId: string, patch: PmChecklistPatch) => Promise<void>;
  onInspectPm: (pmId: string) => void;
}

const SOURCE_OPTIONS: Array<{
  value: CrosscheckSourceTag;
  label: string;
  short: string;
  hint: string;
  accentClass: string;
}> = [
  {
    value: "auto",
    label: "Auto Deteksi (AI)",
    short: "Auto",
    hint: "AI mengenali otomatis apakah foto LCD, eWON, atau Endpoint",
    accentClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
  },
  {
    value: "panel_lcd",
    label: "Panel LCD PM",
    short: "Panel LCD",
    hint: "Bisa unggah banyak foto halaman layar LCD (Tegangan, Arus, Daya, Energi, THD)",
    accentClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  },
  {
    value: "ewon",
    label: "eWON",
    short: "eWON",
    hint: "Screenshot tabel tag eWON / Modbus (1 foto bisa mencakup semua parameter)",
    accentClass: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
  },
  {
    value: "endpoint",
    label: "Endpoint (Opsional)",
    short: "Endpoint",
    hint: "Tidak wajib foto! Cukup klik 'Tarik Value Endpoint Saat Ini' — upload foto hanya jika ingin pembanding screenshot manual",
    accentClass: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
  }
];

const TOLERANCE_MODES: Array<{
  value: CrosscheckToleranceMode;
  label: string;
  sub: string;
  desc: string;
}> = [
  {
    value: "strict",
    label: "Ketat (0–5 dtk)",
    sub: "Jeda ≤5 dtk",
    desc: "Cocok saat foto LCD, eWON, dan tarik Endpoint hampir bersamaan (selisih beberapa detik)."
  },
  {
    value: "normal",
    label: "Normal (5–30 dtk)",
    sub: "Jeda 5–30 dtk",
    desc: "Melonggarkan fluktuasi beban dinamis (kW, Arus, THD), sementara Tegangan, Frekuensi, kWh & deteksi skala tetap ketat."
  },
  {
    value: "relaxed",
    label: "Longgar (1–5 mnt)",
    sub: "Jeda 1–5 mnt",
    desc: "Untuk foto lapangan yang berjeda beberapa menit — tetap ketat mendeteksi salah register & beda skala (×10/×100/×1000)."
  }
];

function effectiveImageSource(img: CrosscheckImageItem): CrosscheckSource | null {
  if (img.source !== "auto") return img.source;
  return img.detectedSource;
}

function sourceBadgeMeta(src: CrosscheckSource | null) {
  if (src === "ewon") {
    return {
      label: "eWON",
      cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35"
    };
  }
  if (src === "endpoint") {
    return {
      label: "Endpoint",
      cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/35"
    };
  }
  if (src === "panel_lcd") {
    return {
      label: "Panel LCD",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35"
    };
  }
  return {
    label: "Auto (Menunggu AI)",
    cls: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30"
  };
}

function overallStatusMeta(status: CrosscheckOverallStatus) {
  switch (status) {
    case "all_match":
      return {
        label: "Sesuai",
        dot: "bg-emerald-500",
        pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35",
        banner: "border-emerald-500/35 bg-emerald-500/[0.08]"
      };
    case "warning":
      return {
        label: "Selisih Ringan",
        dot: "bg-amber-500",
        pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35",
        banner: "border-amber-500/35 bg-amber-500/[0.08]"
      };
    case "mismatch":
      return {
        label: "Tidak Sesuai",
        dot: "bg-rose-500",
        pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35",
        banner: "border-rose-500/35 bg-rose-500/[0.08]"
      };
    default:
      return {
        label: "Belum Lengkap",
        dot: "bg-slate-400",
        pill: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-300/60 dark:border-slate-700",
        banner: "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40"
      };
  }
}

function rowStatusMeta(status: CrosscheckRowStatus, scaleFactor?: string | null) {
  switch (status) {
    case "match":
      return {
        label: "✓ Sesuai",
        cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35"
      };
    case "slight_diff":
      return {
        label: "⚠ Selisih Ringan",
        cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35"
      };
    case "scale_mismatch":
      return {
        label: `⚠ Beda Skala${scaleFactor ? ` (${scaleFactor})` : ""}`,
        cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40"
      };
    case "mismatch":
      return {
        label: "✕ Tidak Sesuai",
        cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40"
      };
    case "single_source":
      return {
        label: "• 1 Sumber",
        cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-300/60 dark:border-slate-700"
      };
    default:
      return {
        label: "— Kosong",
        cls: "bg-slate-500/5 text-slate-400 border-slate-200 dark:border-slate-800"
      };
  }
}

function parseApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || "Permintaan gagal.");
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // plain text
  }
  return raw;
}

/**
 * Resizes large camera images on canvas (max 1600px, JPEG 0.86) while keeping crisp digits
 * so unlimited photos upload quickly and analyze reliably.
 */
async function compressImageToDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Gagal membaca file ${file.name}`));
    reader.readAsDataURL(file);
  });

  // Keep small PNG/WebP screenshots crisp without recompression
  if (file.size <= 750 * 1024 && (file.type === "image/png" || file.type === "image/webp" || file.type === "image/jpeg")) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.86);
        resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

function buildSummaryFromRecordReport(
  record: PmCrosscheckRecord,
  report: PmCrosscheckReport
): PmCrosscheckSummaryItem {
  return {
    pmId: record.pmId,
    imageCount: record.images.length,
    ewonImages: report.sourceCoverage.ewonImages,
    endpointImages: report.sourceCoverage.endpointImages,
    panelLcdImages: report.sourceCoverage.panelLcdImages,
    hasLiveEndpoint: report.sourceCoverage.hasLiveEndpoint,
    comparedParams: report.stats.comparedParams,
    matchCount: report.stats.matchCount,
    slightDiffCount: report.stats.slightDiffCount,
    mismatchCount: report.stats.mismatchCount + report.stats.scaleMismatchCount,
    overallStatus: report.overallStatus,
    lastAnalyzedAt: record.lastAnalyzedAt
  };
}

function formatParamValue(val: number, key: CrosscheckParamKey): string {
  if (key === "power_factor") return fmtNumber(val, 3);
  if (key === "frequency") return fmtNumber(val, 2);
  if (key === "active_energy") {
    return Math.abs(val) >= 1000 ? fmtNumber(val, 2) : fmtNumber(val, 2);
  }
  return fmtNumber(val, 2);
}

function WaveDotsInline() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1" aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "140ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "280ms" }} />
    </span>
  );
}

function PairSummaryCard({
  title,
  subtitle,
  pair
}: {
  title: string;
  subtitle: string;
  pair: CrosscheckPairSummary;
}) {
  const statusStyles =
    pair.status === "match"
      ? {
          border: "border-emerald-500/35 bg-emerald-500/[0.06]",
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35",
          text: "Sesuai"
        }
      : pair.status === "warning"
      ? {
          border: "border-amber-500/35 bg-amber-500/[0.06]",
          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35",
          text: "Selisih Ringan"
        }
      : pair.status === "mismatch"
      ? {
          border: "border-rose-500/35 bg-rose-500/[0.06]",
          badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35",
          text: "Tidak Sesuai"
        }
      : {
          border: "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40",
          badge: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-300/60 dark:border-slate-700",
          text: "Belum Dibandingkan"
        };

  return (
    <div className={`rounded-xl border p-3.5 ${statusStyles.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-extrabold text-slate-900 dark:text-white">{title}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap ${statusStyles.badge}`}>
          {statusStyles.text}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="font-bold text-slate-700 dark:text-slate-200">
          {pair.comparedCount} param
        </span>
        {pair.comparedCount > 0 && (
          <>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              ✓ {pair.matchCount}
            </span>
            {pair.slightDiffCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                ⚠ {pair.slightDiffCount}
              </span>
            )}
            {pair.mismatchCount > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-bold">
                ✕ {pair.mismatchCount}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EditableParamCell({
  paramKey,
  unit,
  item,
  saving,
  onSave
}: {
  paramKey: CrosscheckParamKey;
  unit: string;
  item: CrosscheckExtractedValue | null;
  saving: boolean;
  onSave: (val: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(item ? String(item.value) : "");
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    const trimmed = draft.trim().replace(",", ".");
    if (!trimmed) {
      if (item?.manualOverride) {
        await onSave(null);
      }
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    if (item && !item.manualOverride && Math.abs(parsed - item.value) < 1e-9) return;
    await onSave(parsed);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          autoFocus
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => void commit()}
          placeholder="Angka..."
          className="w-24 px-2 py-1 rounded-lg border border-sky-500 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        {item?.manualOverride && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setEditing(false);
              void onSave(null);
            }}
            title="Hapus koreksi manual (kembali ke hasil AI)"
            className="px-1.5 py-1 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold cursor-pointer"
          >
            ↺
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-1.5 min-w-[125px]">
      {item ? (
        <div className="min-w-0">
          <div className="flex items-center gap-1 font-mono text-xs font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
            <span>{formatParamValue(item.value, paramKey)}</span>
            {unit && <span className="text-[10px] font-semibold text-slate-400">{unit}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
            {item.manualOverride ? (
              <span className="px-1 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 font-bold">
                Manual
              </span>
            ) : item.isLiveEndpoint ? (
              <span className="px-1 py-0.2 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 font-bold">
                Live DB
              </span>
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.confidence === "high"
                    ? "bg-emerald-500"
                    : item.confidence === "medium"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                title={`Keyakinan OCR: ${item.confidence} | Teks asli: ${item.rawText}`}
              />
            )}
            <span className="truncate max-w-[115px]" title={`${item.imageName} — ${item.rawText}`}>
              {item.imageName}
            </span>
          </div>
        </div>
      ) : (
        <span className="text-slate-300 dark:text-slate-700 font-mono text-xs">—</span>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={startEdit}
        title={item ? "Koreksi angka manual" : "Input angka manual"}
        className="opacity-40 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition cursor-pointer shrink-0"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      </button>
    </div>
  );
}

export function PmCrosscheckPanel({
  pms,
  catalog,
  selectedPmId,
  onSelectPmId,
  summaries,
  onSummaryUpdated,
  checklistMap,
  isChecklistUnlocked,
  checklistRemainingLabel,
  onRequestUnlock,
  onUpdateChecklist,
  onInspectPm
}: PmCrosscheckPanelProps) {
  // Sidebar filter state
  const [pmSearch, setPmSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [sidebarFilter, setSidebarFilter] = useState<"all" | "has_images" | "match" | "mismatch">("all");

  // Active PM crosscheck detail state
  const [detailLoading, setDetailLoading] = useState(false);
  const [record, setRecord] = useState<PmCrosscheckRecord | null>(null);
  const [report, setReport] = useState<PmCrosscheckReport | null>(null);
  const [paramSpecs, setParamSpecs] = useState<CrosscheckParamSpec[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Upload & AI action states
  const [uploadSource, setUploadSource] = useState<CrosscheckSourceTag>("auto");
  const [uploadCaption, setUploadCaption] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [capturingLive, setCapturingLive] = useState(false);
  const [showHistoricalPicker, setShowHistoricalPicker] = useState(false);
  const [historicalTimeInput, setHistoricalTimeInput] = useState(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${getLocalTodayIso()}T${hh}:${mm}`;
  });
  const [savingTolerance, setSavingTolerance] = useState(false);
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [applyingChecklist, setApplyingChecklist] = useState(false);

  // Runtime Gemini API Key configuration state (no SSH / restart needed on production server)
  const [aiConfig, setAiConfig] = useState<CrosscheckAiConfigStatus | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [showApiKeyPlain, setShowApiKeyPlain] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Table filter & lightbox states
  const [rowFilter, setRowFilter] = useState<"all" | "issues" | "match" | "single">("all");
  const [showAll25Params, setShowAll25Params] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<CrosscheckImageItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickBucketInputRef = useRef<HTMLInputElement | null>(null);
  const quickBucketSourceRef = useRef<CrosscheckSourceTag>("auto");

  // Build unified PM list from catalog + live overview
  const pmList = useMemo(() => {
    const map = new Map<string, PmCatalogMeta>();
    for (const c of catalog) {
      const id = c.pmId.toUpperCase();
      map.set(id, { ...c, pmId: id });
    }
    for (const pm of pms) {
      const id = pm.pmId.toUpperCase();
      if (!map.has(id)) {
        map.set(id, {
          pmId: id,
          name: pm.pmName,
          factory: pm.factory,
          groupId: pm.groupId,
          area: pm.area
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.pmId.localeCompare(b.pmId));
  }, [catalog, pms]);

  // Ensure selectedPmId defaults to first PM when list loads
  const activePmId = useMemo(() => {
    const norm = selectedPmId ? selectedPmId.trim().toUpperCase() : "";
    if (norm) return norm;
    return pmList[0]?.pmId || "PM132";
  }, [selectedPmId, pmList]);

  const activePmMeta = useMemo(() => {
    return (
      pmList.find((p) => p.pmId === activePmId) || {
        pmId: activePmId,
        name: activePmId,
        factory: "Factory",
        groupId: "",
        area: ""
      }
    );
  }, [pmList, activePmId]);

  const filteredSidebarPms = useMemo(() => {
    const tokens = pmSearch
      .trim()
      .toLowerCase()
      .replace(/[-_/]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    return pmList.filter((pm) => {
      if (factoryFilter !== "all" && pm.factory !== factoryFilter) return false;
      const sum = summaries[pm.pmId];
      if (sidebarFilter === "has_images" && (!sum || (sum.imageCount === 0 && !sum.hasLiveEndpoint))) return false;
      if (sidebarFilter === "match" && sum?.overallStatus !== "all_match" && sum?.overallStatus !== "warning") return false;
      if (sidebarFilter === "mismatch" && sum?.overallStatus !== "mismatch") return false;

      if (tokens.length > 0) {
        const hay = `${pm.pmId} ${pm.pmId.replace("PM", "PM ")} ${pm.name} ${pm.factory} ${pm.area}`.toLowerCase();
        const clean = hay.replace(/[-_/]+/g, " ");
        if (!tokens.every((t) => hay.includes(t) || clean.includes(t))) return false;
      }
      return true;
    });
  }, [pmList, pmSearch, factoryFilter, sidebarFilter, summaries]);

  const fetchPmCrosscheck = useCallback(
    async (pmId: string, silent = false) => {
      if (!pmId) return;
      if (!silent) {
        setDetailLoading(true);
        setError(null);
      }
      try {
        const json = await getJson<CrosscheckDetailResponse>(`/pm-health/crosscheck/${encodeURIComponent(pmId)}`);
        setRecord(json.record);
        setReport(json.report);
        if (Array.isArray(json.paramSpecs) && json.paramSpecs.length > 0) {
          setParamSpecs(json.paramSpecs);
        }
        if (json.aiConfig) {
          setAiConfig(json.aiConfig);
        }
        onSummaryUpdated(pmId, buildSummaryFromRecordReport(json.record, json.report));
      } catch (err) {
        if (!silent) setError(parseApiError(err));
      } finally {
        if (!silent) setDetailLoading(false);
      }
    },
    [onSummaryUpdated]
  );

  useEffect(() => {
    setNotice(null);
    setLightboxImage(null);
    void fetchPmCrosscheck(activePmId, false);
  }, [activePmId, fetchPmCrosscheck]);

  const handleUploadFiles = useCallback(
    async (fileList: FileList | File[], targetSource: CrosscheckSourceTag) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) {
        setError("Hanya file gambar (JPG, PNG, WebP) yang didukung.");
        return;
      }
      setError(null);
      setNotice(null);
      try {
        let latestRec: PmCrosscheckRecord | null = null;
        let latestRep: PmCrosscheckReport | null = null;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadingProgress(`Mengompresi & mengunggah gambar ${i + 1} / ${files.length}...`);
          const dataUrl = await compressImageToDataUrl(file);
          const json = await postJson<{
            ok: boolean;
            record: PmCrosscheckRecord;
            report: PmCrosscheckReport;
          }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/images`, {
            dataUrl,
            fileName: file.name || `photo_${Date.now()}.jpg`,
            source: targetSource,
            caption: uploadCaption.trim()
          });
          latestRec = json.record;
          latestRep = json.report;
        }

        if (latestRec && latestRep) {
          setRecord(latestRec);
          setReport(latestRep);
          onSummaryUpdated(activePmId, buildSummaryFromRecordReport(latestRec, latestRep));
        }
        setUploadCaption("");
        setNotice(
          `${files.length} gambar berhasil diunggah untuk ${activePmId}. Klik "Analisis & Crosscheck Otomatis" untuk membaca semua parameter.`
        );
      } catch (err) {
        setError(parseApiError(err));
      } finally {
        setUploadingProgress(null);
      }
    },
    [activePmId, uploadCaption, onSummaryUpdated]
  );

  // Support Ctrl+V pasting screenshots directly into the active PM crosscheck panel!
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        // Still allow paste if clipboard contains image files (not plain text)
        const hasImage = Array.from(e.clipboardData?.items || []).some((it) => it.type.startsWith("image/"));
        if (!hasImage) return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = blob.type.includes("png") ? "png" : "jpg";
            pastedFiles.push(
              new File([blob], `clipboard_${uploadSource}_${Date.now()}.${ext}`, { type: blob.type })
            );
          }
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        void handleUploadFiles(pastedFiles, uploadSource);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleUploadFiles, uploadSource]);

  const handleAnalyze = async (forceReanalyze = false) => {
    if (!record || record.images.length === 0) {
      setError("Unggah minimal 1 gambar terlebih dahulu sebelum menjalankan analisis otomatis.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setNotice(null);
    try {
      const json = await postJson<{
        ok: boolean;
        analyzedImageCount: number;
        record: PmCrosscheckRecord;
        report: PmCrosscheckReport;
      }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/analyze`, {
        forceReanalyze
      });
      setRecord(json.record);
      setReport(json.report);
      onSummaryUpdated(activePmId, buildSummaryFromRecordReport(json.record, json.report));
      setNotice(
        json.analyzedImageCount > 0
          ? `Selesai! ${json.analyzedImageCount} gambar berhasil dibaca AI & digabungkan ke tabel crosscheck ${activePmId}.`
          : `Semua gambar sudah teranalisis sebelumnya. Gunakan "Analisis Ulang Semua" jika ingin membaca ulang.`
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCaptureLiveEndpoint = async (targetTimestamp?: string) => {
    setCapturingLive(true);
    setError(null);
    setNotice(null);
    try {
      const json = await postJson<{
        ok: boolean;
        capturedCount: number;
        tStamp: string | null;
        sourceOrigin?: string;
        sourceLabel?: string;
        record: PmCrosscheckRecord;
        report: PmCrosscheckReport;
      }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/live-endpoint`, {
        ...(targetTimestamp ? { targetTimestamp } : {})
      });
      setRecord(json.record);
      setReport(json.report);
      onSummaryUpdated(activePmId, buildSummaryFromRecordReport(json.record, json.report));
      setShowHistoricalPicker(false);
      setNotice(
        `Berhasil menarik ${json.capturedCount} parameter dari ${json.sourceLabel || "Endpoint Live"} (${
          json.tStamp || "detik ini"
        } WIB) untuk ${activePmId}. Tanpa perlu foto Endpoint!`
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setCapturingLive(false);
    }
  };

  const handleChangeToleranceMode = async (mode: CrosscheckToleranceMode) => {
    setSavingTolerance(true);
    setError(null);
    try {
      const json = await patchJson<{
        ok: boolean;
        record: PmCrosscheckRecord;
        report: PmCrosscheckReport;
      }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/settings`, {
        toleranceMode: mode
      });
      setRecord(json.record);
      setReport(json.report);
      onSummaryUpdated(activePmId, buildSummaryFromRecordReport(json.record, json.report));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSavingTolerance(false);
    }
  };

  const handleSaveAiApiKey = async (rawKey: string | null) => {
    setSavingApiKey(true);
    setApiKeyError(null);
    try {
      const json = await putJson<{ ok: boolean } & CrosscheckAiConfigStatus>("/pm-health/crosscheck/ai-config", {
        geminiApiKey: rawKey
      });
      setAiConfig({
        configured: json.configured,
        source: json.source,
        maskedKey: json.maskedKey,
        model: json.model,
        updatedAt: json.updatedAt,
        updatedBy: json.updatedBy
      });
      setApiKeyDraft("");
      setAiModalOpen(false);
      setError(null);
      setNotice(
        json.configured
          ? `Gemini API Key berhasil disimpan & langsung aktif (${json.maskedKey}). Sekarang Anda bisa klik "Analisis & Crosscheck"!`
          : "API Key kustom telah dihapus (kembali ke .env server)."
      );
    } catch (err) {
      setApiKeyError(parseApiError(err));
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleClearLiveEndpoint = async () => {
    setError(null);
    try {
      const json = await deleteJson<{
        ok: boolean;
        record: PmCrosscheckRecord;
        report: PmCrosscheckReport;
      }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/live-endpoint`);
      setRecord(json.record);
      setReport(json.report);
      onSummaryUpdated(activePmId, buildSummaryFromRecordReport(json.record, json.report));
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const handleChangeImageSource = async (imageId: string, nextSource: CrosscheckSourceTag) => {
    setError(null);
    try {
      const json = await patchJson<{
        ok: boolean;
        record: PmCrosscheckRecord;
        report: PmCrosscheckReport;
      }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/images/${encodeURIComponent(imageId)}`, {
        source: nextSource
      });
      setRecord(json.record);
      setReport(json.report);
      onSummaryUpdated(activePmId, buildSummaryFromRecordReport(json.record, json.report));
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    setError(null);
    try {
      const json = await deleteJson<{
        ok: boolean;
        record: PmCrosscheckRecord;
        report: PmCrosscheckReport;
      }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/images/${encodeURIComponent(imageId)}`);
      setRecord(json.record);
      setReport(json.report);
      if (lightboxImage?.id === imageId) setLightboxImage(null);
      onSummaryUpdated(activePmId, buildSummaryFromRecordReport(json.record, json.report));
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const handleManualOverride = async (
    source: CrosscheckSource,
    paramKey: CrosscheckParamKey,
    value: number | null
  ) => {
    const cellKey = `${source}:${paramKey}`;
    setSavingCellKey(cellKey);
    setError(null);
    try {
      const json = await patchJson<{
        ok: boolean;
        record: PmCrosscheckRecord;
        report: PmCrosscheckReport;
      }>(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}/override`, {
        source,
        key: paramKey,
        value
      });
      setRecord(json.record);
      setReport(json.report);
      onSummaryUpdated(activePmId, buildSummaryFromRecordReport(json.record, json.report));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSavingCellKey(null);
    }
  };

  const handleClearPmCrosscheck = async () => {
    const ok = window.confirm(
      `Hapus seluruh foto, snapshot Endpoint, dan hasil crosscheck untuk ${activePmId} (${activePmMeta.name})?`
    );
    if (!ok) return;
    setError(null);
    try {
      await deleteJson(`/pm-health/crosscheck/${encodeURIComponent(activePmId)}`);
      onSummaryUpdated(activePmId, null);
      await fetchPmCrosscheck(activePmId, false);
      setNotice(`Data crosscheck untuk ${activePmId} telah dibersihkan.`);
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const handleApplyToChecklist = async () => {
    if (!report) return;
    if (!isChecklistUnlocked) {
      onRequestUnlock();
      return;
    }

    const totalBad = report.stats.mismatchCount + report.stats.scaleMismatchCount;
    if (totalBad > 0) {
      const proceed = window.confirm(
        `Perhatian: masih ada ${totalBad} parameter TIDAK SESUAI pada ${activePmId}.\n\nTetap simpan ringkasan catatan hasil crosscheck ini ke Checklist Verifikasi PM (tanpa menandai sumber yang belum sesuai)?`
      );
      if (!proceed) return;
    }

    setApplyingChecklist(true);
    setError(null);
    try {
      const patch: PmChecklistPatch = {};
      if (totalBad === 0 && report.stats.comparedParams > 0) {
        if (report.sourceCoverage.ewonParams > 0) patch.ewonChecked = true;
        if (report.sourceCoverage.endpointParams > 0) patch.endpointChecked = true;
        if (report.sourceCoverage.panelLcdParams > 0) patch.panelLcdChecked = true;
      }

      const summaryNote =
        totalBad === 0
          ? `Crosscheck AI OK (${report.stats.matchCount}/${report.stats.comparedParams} sesuai${
              report.stats.slightDiffCount > 0 ? `, ${report.stats.slightDiffCount} selisih ringan` : ""
            })`
          : `Crosscheck AI: ${totalBad} param tidak sesuai dari ${report.stats.comparedParams} dibandingkan`;

      patch.notes = summaryNote;
      await onUpdateChecklist(activePmId, patch);
      setNotice(`Hasil crosscheck ${activePmId} berhasil diterapkan ke Checklist Verifikasi PM.`);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setApplyingChecklist(false);
    }
  };

  const handleExportCrosscheckCsv = () => {
    if (!report) return;
    const headers = [
      "PM ID",
      "Nama Peralatan",
      "Grup",
      "Parameter",
      "Satuan",
      "Nilai eWON",
      "Sumber eWON",
      "Nilai Endpoint",
      "Sumber Endpoint",
      "Nilai Panel LCD",
      "Sumber Panel LCD",
      "Selisih Maks",
      "Selisih (%)",
      "Status",
      "Keterangan"
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rowsCsv = report.rows.map((r) => [
      activePmId,
      activePmMeta.name,
      r.group,
      r.label,
      r.unit,
      r.ewon?.value ?? "",
      r.ewon?.imageName ?? "",
      r.endpoint?.value ?? "",
      r.endpoint?.imageName ?? "",
      r.panel_lcd?.value ?? "",
      r.panel_lcd?.imageName ?? "",
      r.maxAbsDiff ?? "",
      r.maxPctDiff ?? "",
      rowStatusMeta(r.status, r.scaleFactorDetected).label,
      r.note
    ]);
    const csv = [headers, ...rowsCsv].map((line) => line.map(esc).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pm-crosscheck_${activePmId}_${getLocalTodayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build comparison table rows (either detected rows only, or all 25 params for manual entry)
  const displayedRows: CrosscheckComparisonRow[] = useMemo(() => {
    const baseRows = report?.rows || [];
    const byKey = new Map(baseRows.map((r) => [r.key, r]));

    let fullList: CrosscheckComparisonRow[];
    if (showAll25Params && paramSpecs.length > 0) {
      fullList = paramSpecs.map(
        (spec) =>
          byKey.get(spec.key) || {
            key: spec.key,
            label: spec.label,
            group: spec.group,
            unit: spec.unit,
            ewon: null,
            endpoint: null,
            panel_lcd: null,
            status: "missing" as CrosscheckRowStatus,
            maxAbsDiff: null,
            maxPctDiff: null,
            note: "Belum terbaca — klik ikon pensil untuk input manual",
            scaleFactorDetected: null
          }
      );
    } else {
      fullList = baseRows;
    }

    return fullList.filter((r) => {
      if (rowFilter === "issues") {
        return r.status === "mismatch" || r.status === "scale_mismatch" || r.status === "slight_diff";
      }
      if (rowFilter === "match") return r.status === "match";
      if (rowFilter === "single") return r.status === "single_source";
      return true;
    });
  }, [report, paramSpecs, showAll25Params, rowFilter]);

  const unanalyzedCount = useMemo(() => {
    return (record?.images || []).filter((img) => !img.analyzedAt).length;
  }, [record]);

  const groupedImages = useMemo(() => {
    const imgs = record?.images || [];
    return {
      panel_lcd: imgs.filter((i) => effectiveImageSource(i) === "panel_lcd"),
      ewon: imgs.filter((i) => effectiveImageSource(i) === "ewon"),
      endpoint: imgs.filter((i) => effectiveImageSource(i) === "endpoint"),
      unassigned: imgs.filter((i) => effectiveImageSource(i) === null)
    };
  }, [record]);

  const authToken = getAccessToken() || "";
  const imageUrl = (pmId: string, imgId: string) =>
    `${buildApiUrl(`/pm-health/crosscheck/${encodeURIComponent(pmId)}/images/${encodeURIComponent(imgId)}`)}?token=${encodeURIComponent(authToken)}`;

  const totalWithCrosscheck = useMemo(() => {
    return Object.values(summaries).filter((s) => s.imageCount > 0 || s.hasLiveEndpoint).length;
  }, [summaries]);

  const activeChecklist = checklistMap[activePmId];
  const oMeta = overallStatusMeta(report?.overallStatus || "incomplete");

  return (
    <section className="space-y-4">
      {/* Top Info & Mobile PM Switcher */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>Crosscheck Multi-Gambar Power Meter (AI Vision)</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold">
                eWON ↔ Endpoint ↔ Panel LCD
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Cukup klik <strong>⚡ Tarik Value Endpoint Saat Ini</strong> (tanpa perlu foto Endpoint!) lalu unggah foto{" "}
              <strong>eWON</strong> &amp; <strong>Panel LCD</strong> sebanyak yang dibutuhkan. AI otomatis menggabungkan
              multi-halaman foto LCD dan mentoleransi jeda waktu pengambilan foto.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span
              title="Foto, tarikan Endpoint, dan hasil analisis AI disimpan permanen di server (disk + MongoDB) sehingga aman walau browser ditutup atau dibuka kembali nanti."
              className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
            >
              💾 Tersimpan Permanen
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono">
              {totalWithCrosscheck} / {pmList.length} PM memiliki data
            </span>
            <button
              type="button"
              onClick={() => {
                setApiKeyError(null);
                setAiModalOpen(true);
              }}
              title={
                aiConfig?.configured
                  ? `Gemini AI aktif (${aiConfig.maskedKey} via ${aiConfig.source === "ui_saved" ? "Pengaturan UI" : ".env Server"}) — klik untuk mengganti`
                  : "Gemini API Key belum diatur di server — klik untuk memasukkan API Key langsung dari sini"
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
                aiConfig?.configured
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                  : "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25"
              }`}
            >
              <span>{aiConfig?.configured ? "✓ Gemini AI Aktif" : "⚠ Atur API Key AI"}</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet PM Picker (< xl) */}
        <div className="xl:hidden flex flex-wrap items-center gap-2 pt-1">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Pilih Power Meter:</label>
          <select
            value={activePmId}
            onChange={(e) => onSelectPmId(e.target.value)}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100"
          >
            {pmList.map((pm) => {
              const s = summaries[pm.pmId];
              const tag = s && s.imageCount > 0 ? ` [📷 ${s.imageCount} • ${overallStatusMeta(s.overallStatus).label}]` : "";
              return (
                <option key={pm.pmId} value={pm.pmId}>
                  {pm.pmId} — {pm.name} ({pm.factory}){tag}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Main Responsive Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 items-start">
        {/* LEFT SIDEBAR (Desktop xl+): 59 PM Navigator */}
        <aside className="hidden xl:flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden max-h-[calc(100vh-190px)] sticky top-4">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="relative">
              <svg
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={pmSearch}
                onChange={(e) => setPmSearch(e.target.value)}
                placeholder="Cari PM132, MDP, Chiller..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={factoryFilter}
                onChange={(e) => setFactoryFilter(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">Semua Factory</option>
                <option value="Factory 1">Factory 1</option>
                <option value="Factory 2">Factory 2</option>
                <option value="Incoming PLN">Incoming PLN</option>
              </select>

              <select
                value={sidebarFilter}
                onChange={(e) => setSidebarFilter(e.target.value as any)}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">Semua PM ({pmList.length})</option>
                <option value="has_images">Ada Data ({totalWithCrosscheck})</option>
                <option value="match">Sesuai</option>
                <option value="mismatch">Tidak Sesuai</option>
              </select>
            </div>
          </div>

          <div className="overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800/70">
            {filteredSidebarPms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Tidak ada PM yang cocok.</div>
            ) : (
              filteredSidebarPms.map((pm) => {
                const isSelected = pm.pmId === activePmId;
                const s = summaries[pm.pmId];
                const hasData = Boolean(s && (s.imageCount > 0 || s.hasLiveEndpoint));
                const sMeta = s ? overallStatusMeta(s.overallStatus) : null;

                return (
                  <button
                    key={pm.pmId}
                    type="button"
                    onClick={() => onSelectPmId(pm.pmId)}
                    className={`w-full text-left px-3 py-2.5 transition cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/12 border-l-4 border-l-sky-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                        {pm.pmId}
                      </span>
                      <div className="flex items-center gap-1">
                        {hasData && s && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            📷 {s.imageCount}
                            {s.hasLiveEndpoint ? "+DB" : ""}
                          </span>
                        )}
                        {hasData && sMeta && (
                          <span
                            className={`w-2 h-2 rounded-full ${sMeta.dot}`}
                            title={sMeta.label}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {pm.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                      {pm.factory} • {pm.area}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT MAIN WORKSPACE */}
        <div className="space-y-4 min-w-0">
          {/* Active PM Header & Primary Controls */}
          <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm space-y-4 ${oMeta.banner}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-mono text-xs font-extrabold">
                    {activePmId}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {activePmMeta.name}
                  </h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold ${oMeta.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${oMeta.dot}`} />
                    {report?.verdictTitle || oMeta.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {activePmMeta.factory} • {activePmMeta.area}
                  {record?.lastAnalyzedAt && (
                    <span className="ml-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      • Analisis terakhir: {record.lastAnalyzedAt} WIB ({record.lastAnalyzedBy || "Admin"})
                    </span>
                  )}
                </p>
                {report && (
                  <p className="mt-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {report.verdictDetail}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAnalyze(false)}
                  disabled={analyzing || detailLoading || !record || record.images.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white text-xs font-extrabold shadow-sm shadow-indigo-500/25 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {analyzing ? (
                    <span className="inline-flex items-center">
                      Menganalisis AI
                      <WaveDotsInline />
                    </span>
                  ) : unanalyzedCount > 0 ? (
                    <span>Analisis &amp; Crosscheck ({unanalyzedCount} baru)</span>
                  ) : (
                    <span>Analisis &amp; Crosscheck Otomatis</span>
                  )}
                </button>

                {record && record.images.length > 0 && unanalyzedCount === 0 && (
                  <button
                    type="button"
                    onClick={() => void handleAnalyze(true)}
                    disabled={analyzing || detailLoading}
                    title="Baca ulang seluruh gambar PM ini dengan Gemini Vision"
                    className="px-3 py-2 rounded-xl border border-indigo-500/35 bg-white/80 dark:bg-slate-900/80 hover:border-indigo-500 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition cursor-pointer disabled:opacity-45"
                  >
                    ↺ Analisis Ulang Semua
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handleCaptureLiveEndpoint()}
                  disabled={capturingLive || detailLoading}
                  title="Tarik nilai real-time detik ini langsung dari Endpoint HTTP (electric_ew21/ew22/ew23) tanpa perlu foto Endpoint"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-45 text-white text-xs font-extrabold shadow-sm shadow-violet-500/25 transition cursor-pointer"
                >
                  <span>⚡ {capturingLive ? "Menarik Endpoint..." : "Tarik Value Endpoint Saat Ini"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistoricalPicker((prev) => !prev)}
                  disabled={capturingLive || detailLoading}
                  title="Jika foto LCD/eWON diambil beberapa menit lalu, tarik value Endpoint sesuai jam foto tersebut"
                  className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    showHistoricalPicker
                      ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-300"
                      : "border-violet-500/35 bg-white/80 dark:bg-slate-900/80 hover:border-violet-500 text-violet-700 dark:text-violet-300"
                  }`}
                >
                  🕒 Jam Foto
                </button>

                {report && report.stats.comparedParams > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleApplyToChecklist()}
                    disabled={applyingChecklist}
                    title={
                      isChecklistUnlocked
                        ? `Terapkan hasil crosscheck ke Checklist Verifikasi PM (Sesi edit: ${checklistRemainingLabel || "terbuka"})`
                        : "Checklist terkunci — klik untuk membuka kunci dengan password akun"
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-extrabold transition cursor-pointer"
                  >
                    <span>{!isChecklistUnlocked ? "🔒 " : "✓ "}Terapkan ke Checklist</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onInspectPm(activePmId)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-sky-400 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Grafik PM
                </button>
              </div>
            </div>

            {/* Optional Historical Endpoint Timestamp Picker (when photos were taken minutes earlier) */}
            {showHistoricalPicker && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.07] p-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-[11px] text-violet-900 dark:text-violet-200 font-semibold">
                  Foto LCD/eWON diambil sebelumnya? Pilih jam pengambilan foto (WIB) untuk menarik value Endpoint terdekat (±15 menit):
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={historicalTimeInput}
                    onChange={(e) => setHistoricalTimeInput(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-violet-400/50 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={capturingLive || !historicalTimeInput}
                    onClick={() => {
                      const formatted = historicalTimeInput.replace("T", " ");
                      void handleCaptureLiveEndpoint(formatted);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer transition"
                  >
                    Tarik Endpoint Jam Ini
                  </button>
                </div>
              </div>
            )}

            {/* Source Coverage Strip */}
            {report && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold">
                  eWON: {report.sourceCoverage.ewonImages} foto • {report.sourceCoverage.ewonParams} param
                </span>
                <span className="px-2.5 py-1 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold">
                  Endpoint: {report.sourceCoverage.endpointImages > 0 ? `${report.sourceCoverage.endpointImages} foto` : ""}
                  {report.sourceCoverage.endpointImages > 0 && report.sourceCoverage.hasLiveEndpoint ? " + " : ""}
                  {report.sourceCoverage.hasLiveEndpoint
                    ? record?.liveEndpointSnapshot?.sourceOrigin === "live_endpoint_http"
                      ? "⚡ Live Detik Ini"
                      : record?.liveEndpointSnapshot?.sourceOrigin === "live_endpoint_cache"
                      ? "⚡ Live Cache"
                      : record?.liveEndpointSnapshot?.sourceOrigin === "db_minute_at_time"
                      ? "🕒 Historis Jam Foto"
                      : "DB Menit"
                    : report.sourceCoverage.endpointImages === 0
                    ? "Belum ditarik"
                    : ""}{" "}
                  • {report.sourceCoverage.endpointParams} param
                </span>
                <span className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">
                  Panel LCD: {report.sourceCoverage.panelLcdImages} foto • {report.sourceCoverage.panelLcdParams} param
                </span>
                {record?.liveEndpointSnapshot && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-violet-500/30 bg-white/80 dark:bg-slate-900/80 text-violet-700 dark:text-violet-300 font-mono text-[10px] font-bold">
                    {record.liveEndpointSnapshot.sourceLabel || "Endpoint Live"} •{" "}
                    {record.liveEndpointSnapshot.tStamp || record.liveEndpointSnapshot.capturedAt}
                    <button
                      type="button"
                      onClick={() => void handleClearLiveEndpoint()}
                      title="Hapus tarikan Endpoint Live"
                      className="text-rose-500 hover:text-rose-600 font-extrabold cursor-pointer ml-0.5"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {activeChecklist && (
                  <span className="ml-auto text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Status Checklist: eWON {activeChecklist.ewonChecked ? "✓" : "○"} • EP {activeChecklist.endpointChecked ? "✓" : "○"} • LCD {activeChecklist.panelLcdChecked ? "✓" : "○"}
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300 flex flex-wrap items-center justify-between gap-2">
              <span>{error}</span>
              <div className="flex items-center gap-2">
                {error.toUpperCase().includes("GEMINI_API_KEY") && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKeyError(null);
                      setAiModalOpen(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold cursor-pointer transition"
                  >
                    ⚙ Atur API Key AI Sekarang
                  </button>
                )}
                <button type="button" onClick={() => setError(null)} className="underline text-[11px] font-bold cursor-pointer">
                  Tutup
                </button>
              </div>
            </div>
          )}

          {notice && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-2">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="underline text-[11px] font-bold cursor-pointer">
                Tutup
              </button>
            </div>
          )}

          {/* 1. MULTI-IMAGE UPLOAD ZONE */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  1. Unggah Gambar Sumber ({record?.images.length ?? 0} Gambar Tersimpan — Tanpa Batas)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilih sumber atau biarkan <strong>Auto Deteksi</strong>. Bisa pilih banyak file sekaligus, drag &amp; drop, atau tempel screenshot langsung dengan <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">Ctrl+V</kbd>.
                </p>
              </div>
              {record && (record.images.length > 0 || record.liveEndpointSnapshot) && (
                <button
                  type="button"
                  onClick={() => void handleClearPmCrosscheck()}
                  className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold cursor-pointer transition"
                >
                  Hapus Semua Data {activePmId}
                </button>
              )}
            </div>

            {/* Source Tag Pills + Optional Caption */}
            <div className="flex flex-wrap items-center gap-2">
              {SOURCE_OPTIONS.map((opt) => {
                const active = uploadSource === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUploadSource(opt.value)}
                    title={opt.hint}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                      active
                        ? `${opt.accentClass} ring-2 ring-offset-1 ring-sky-500/20 dark:ring-offset-slate-900`
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300 hover:border-sky-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}

              <input
                type="text"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Label foto opsional (mis. LCD Tegangan, LCD kWh)..."
                maxLength={120}
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) {
                  void handleUploadFiles(e.dataTransfer.files, uploadSource);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
                isDragging
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-slate-300 dark:border-slate-700 hover:border-sky-400 bg-slate-50/70 dark:bg-slate-950/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    void handleUploadFiles(e.target.files, uploadSource);
                    e.target.value = "";
                  }
                }}
              />
              <input
                ref={quickBucketInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    void handleUploadFiles(e.target.files, quickBucketSourceRef.current);
                    e.target.value = "";
                  }
                }}
              />

              {uploadingProgress ? (
                <div className="py-2 text-xs font-extrabold text-sky-600 dark:text-sky-400 inline-flex items-center">
                  <span>{uploadingProgress}</span>
                  <WaveDotsInline />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                    Klik untuk pilih banyak gambar, seret ke sini, atau tekan <span className="font-mono text-sky-600 dark:text-sky-400">Ctrl+V</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Target sumber saat ini:{" "}
                    <strong>{SOURCE_OPTIONS.find((o) => o.value === uploadSource)?.label}</strong> —{" "}
                    {SOURCE_OPTIONS.find((o) => o.value === uploadSource)?.hint}
                  </div>
                </div>
              )}
            </div>

            {/* Uploaded Images Grouped by Source */}
            {detailLoading ? (
              <div className="py-6 text-center text-xs font-semibold text-slate-400">
                Memuat gambar crosscheck {activePmId}...
              </div>
            ) : record && record.images.length > 0 ? (
              <div className="space-y-4 pt-1">
                {(
                  [
                    { key: "panel_lcd", title: "Panel LCD PM (Gabungan Multi-Halaman)", items: groupedImages.panel_lcd, src: "panel_lcd" as CrosscheckSourceTag, badge: "amber" },
                    { key: "ewon", title: "eWON", items: groupedImages.ewon, src: "ewon" as CrosscheckSourceTag, badge: "sky" },
                    { key: "endpoint", title: "Endpoint", items: groupedImages.endpoint, src: "endpoint" as CrosscheckSourceTag, badge: "violet" },
                    { key: "unassigned", title: "Auto Deteksi (Belum Dianalisis AI)", items: groupedImages.unassigned, src: "auto" as CrosscheckSourceTag, badge: "slate" }
                  ] as const
                )
                  .filter((grp) => grp.items.length > 0 || grp.key !== "unassigned")
                  .map((grp) => (
                    <div
                      key={grp.key}
                      className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-3 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                            {grp.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                            {grp.items.length} foto
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {grp.key === "endpoint" && (
                            <button
                              type="button"
                              disabled={capturingLive}
                              onClick={() => void handleCaptureLiveEndpoint()}
                              className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-45 text-white text-[11px] font-extrabold cursor-pointer transition"
                            >
                              ⚡ {capturingLive ? "Menarik..." : "Tarik Live Saat Ini"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              quickBucketSourceRef.current = grp.src;
                              quickBucketInputRef.current?.click();
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-sky-400 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer transition"
                          >
                            + Tambah Foto {grp.key === "unassigned" ? "" : grp.title.split(" ")[0]}
                          </button>
                        </div>
                      </div>

                      {grp.items.length === 0 ? (
                        <div className="text-[11px] text-slate-400 py-1">
                          {grp.key === "endpoint" ? (
                            record.liveEndpointSnapshot ? (
                              <span className="text-violet-600 dark:text-violet-400 font-semibold">
                                ✓ Sudah terisi otomatis dari{" "}
                                <strong>{record.liveEndpointSnapshot.sourceLabel || "Endpoint Live"}</strong> (
                                {Object.keys(record.liveEndpointSnapshot.values).length} parameter pada{" "}
                                {record.liveEndpointSnapshot.tStamp || record.liveEndpointSnapshot.capturedAt} WIB) — tidak
                                perlu foto Endpoint.
                              </span>
                            ) : (
                              <span>
                                Tidak perlu foto Endpoint — cukup klik <strong>⚡ Tarik Live Saat Ini</strong> di atas
                                (atau unggah foto opsional).
                              </span>
                            )
                          ) : (
                            <span>Belum ada gambar untuk sumber ini.</span>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {grp.items.map((img) => {
                            const eff = effectiveImageSource(img);
                            const bMeta = sourceBadgeMeta(eff);
                            return (
                              <div
                                key={img.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs flex flex-col"
                              >
                                <div className="relative h-36 bg-slate-900/90 overflow-hidden group">
                                  <img
                                    src={imageUrl(activePmId, img.id)}
                                    alt={img.caption || img.fileName}
                                    loading="lazy"
                                    onClick={() => setLightboxImage(img)}
                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition cursor-zoom-in"
                                  />
                                  <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                                    <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-extrabold backdrop-blur-sm bg-white/85 dark:bg-slate-900/85 ${bMeta.cls}`}>
                                      {bMeta.label}
                                    </span>
                                    {img.analyzedAt ? (
                                      <span
                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold backdrop-blur-sm ${
                                          img.extractedCount > 0
                                            ? "bg-emerald-600/90 text-white"
                                            : "bg-amber-600/90 text-white"
                                        }`}
                                      >
                                        {img.extractedCount} param
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded-md bg-slate-800/85 text-slate-200 text-[10px] font-bold">
                                        Belum AI
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteImage(img.id)}
                                    title="Hapus gambar ini"
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/75 hover:bg-rose-600 text-white transition cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                                  <div>
                                    <div
                                      className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate"
                                      title={img.caption ? `${img.caption} (${img.fileName})` : img.fileName}
                                    >
                                      {img.caption || img.fileName}
                                    </div>
                                    {img.aiNotes && (
                                      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                        {img.aiNotes}
                                      </p>
                                    )}
                                  </div>

                                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                                    <select
                                      value={img.source}
                                      onChange={(e) =>
                                        void handleChangeImageSource(img.id, e.target.value as CrosscheckSourceTag)
                                      }
                                      className="px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                      title="Ubah kategori sumber gambar ini"
                                    >
                                      <option value="auto">Auto{img.detectedSource ? ` (${sourceBadgeMeta(img.detectedSource).label})` : ""}</option>
                                      <option value="panel_lcd">Panel LCD</option>
                                      <option value="ewon">eWON</option>
                                      <option value="endpoint">Endpoint</option>
                                    </select>

                                    <button
                                      type="button"
                                      onClick={() => setLightboxImage(img)}
                                      className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                                    >
                                      Lihat &amp; Detail
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada gambar untuk <strong>{activePmId}</strong>. Unggah foto Panel LCD (bisa banyak halaman), screenshot eWON, dan/atau Endpoint (atau klik <strong>Ambil Live Endpoint DB</strong>).
              </div>
            )}
          </div>

          {/* 2. PAIRWISE 3-WAY SUMMARY CARDS */}
          {report && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PairSummaryCard
                title="eWON ↔ Endpoint"
                subtitle="Validasi jalur gateway ke backend"
                pair={report.pairs.ewonVsEndpoint}
              />
              <PairSummaryCard
                title="eWON ↔ Panel LCD"
                subtitle="Validasi pembacaan Modbus vs fisik"
                pair={report.pairs.ewonVsLcd}
              />
              <PairSummaryCard
                title="Endpoint ↔ Panel LCD"
                subtitle="Validasi data akhir SCADA vs fisik"
                pair={report.pairs.endpointVsLcd}
              />
            </div>
          )}

          {/* 3. PARAMETER-BY-PARAMETER 3-WAY COMPARISON TABLE */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  2. Tabel Hasil Crosscheck Parameter — {activePmId}
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Semua foto pada sumber yang sama otomatis digabungkan per parameter. Klik ikon pensil (✎) pada sel manapun untuk koreksi/input angka manual.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  {(
                    [
                      { id: "all", label: `Semua (${report?.rows.length ?? 0})` },
                      {
                        id: "issues",
                        label: `Selisih/Beda (${
                          (report?.stats.mismatchCount ?? 0) +
                          (report?.stats.scaleMismatchCount ?? 0) +
                          (report?.stats.slightDiffCount ?? 0)
                        })`
                      },
                      { id: "match", label: `Sesuai (${report?.stats.matchCount ?? 0})` },
                      { id: "single", label: `1 Sumber (${report?.stats.singleSourceCount ?? 0})` }
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRowFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        rowFilter === f.id
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAll25Params}
                    onChange={(e) => setShowAll25Params(e.target.checked)}
                    className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                  />
                  <span>Tampilkan semua 25 param</span>
                </label>

                <button
                  type="button"
                  onClick={handleExportCrosscheckCsv}
                  disabled={!report || report.rows.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer transition"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Timing-Gap Tolerance Profile Selector */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                  Mode Jeda Waktu Foto:
                </span>
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 p-0.5">
                  {TOLERANCE_MODES.map((tm) => {
                    const active = (report?.toleranceMode || record?.toleranceMode || "strict") === tm.value;
                    return (
                      <button
                        key={tm.value}
                        type="button"
                        disabled={savingTolerance}
                        onClick={() => void handleChangeToleranceMode(tm.value)}
                        title={tm.desc}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
                          active
                            ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {tm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {
                  TOLERANCE_MODES.find(
                    (m) => m.value === (report?.toleranceMode || record?.toleranceMode || "strict")
                  )?.desc
                }
              </span>
            </div>

            {record?.aiSummary && (
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-indigo-500/[0.06] text-xs text-indigo-800 dark:text-indigo-200 flex flex-wrap items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 font-mono text-[10px] font-extrabold">
                  AI ({record.aiModel || "gemini-2.5-flash"})
                </span>
                <span className="font-medium">{record.aiSummary}</span>
              </div>
            )}

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[920px] text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Parameter &amp; Grup</th>
                    <th className="px-3 py-3 text-sky-600 dark:text-sky-400">eWON</th>
                    <th className="px-3 py-3 text-violet-600 dark:text-violet-400">Endpoint</th>
                    <th className="px-3 py-3 text-amber-600 dark:text-amber-400">Panel LCD</th>
                    <th className="px-3 py-3 text-right">Selisih Maks</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody translate="no" className="notranslate divide-y divide-slate-100 dark:divide-slate-800/80">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-400 font-semibold">
                        {report && report.rows.length > 0
                          ? "Tidak ada parameter yang cocok dengan filter status saat ini."
                          : "Belum ada parameter terbaca. Unggah gambar lalu klik Analisis & Crosscheck Otomatis, atau centang 'Tampilkan semua 25 param' untuk input manual."}
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row) => {
                      const stMeta = rowStatusMeta(row.status, row.scaleFactorDetected);
                      const rowBg =
                        row.status === "mismatch" || row.status === "scale_mismatch"
                          ? "bg-rose-500/[0.05] hover:bg-rose-500/[0.09]"
                          : row.status === "slight_diff"
                          ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40";

                      return (
                        <tr key={row.key} className={`transition ${rowBg}`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-bold text-slate-800 dark:text-slate-100">{row.label}</div>
                            <div className="text-[10px] text-slate-400">
                              {row.group} • <span className="font-mono">{row.key}</span>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <EditableParamCell
                              paramKey={row.key}
                              unit={row.unit}
                              item={row.ewon}
                              saving={savingCellKey === `ewon:${row.key}`}
                              onSave={(val) => handleManualOverride("ewon", row.key, val)}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <EditableParamCell
                              paramKey={row.key}
                              unit={row.unit}
                              item={row.endpoint}
                              saving={savingCellKey === `endpoint:${row.key}`}
                              onSave={(val) => handleManualOverride("endpoint", row.key, val)}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <EditableParamCell
                              paramKey={row.key}
                              unit={row.unit}
                              item={row.panel_lcd}
                              saving={savingCellKey === `panel_lcd:${row.key}`}
                              onSave={(val) => handleManualOverride("panel_lcd", row.key, val)}
                            />
                          </td>

                          <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
                            {row.maxAbsDiff !== null ? (
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-100">
                                  Δ {fmtNumber(row.maxAbsDiff, row.key === "power_factor" ? 3 : 2)}
                                  {row.unit ? ` ${row.unit}` : ""}
                                </div>
                                {row.maxPctDiff !== null && (
                                  <div className="text-[10px] text-slate-400">
                                    {fmtNumber(row.maxPctDiff, 2)}%
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${stMeta.cls}`}>
                              {stMeta.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-[260px]">
                            {row.note}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* IMAGE LIGHTBOX & EXTRACTED PARAMS MODAL */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${sourceBadgeMeta(effectiveImageSource(lightboxImage)).cls}`}>
                    {sourceBadgeMeta(effectiveImageSource(lightboxImage)).label}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {lightboxImage.caption || lightboxImage.fileName}
                  </h4>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {activePmId} • Diunggah {lightboxImage.uploadedAt} WIB oleh {lightboxImage.uploadedBy} •{" "}
                  {(lightboxImage.sizeBytes / 1024).toFixed(0)} KB
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                aria-label="Tutup preview gambar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center min-h-[260px]">
                <img
                  src={imageUrl(activePmId, lightboxImage.id)}
                  alt={lightboxImage.caption || lightboxImage.fileName}
                  className="max-h-[65vh] w-auto object-contain"
                />
              </div>

              <div className="space-y-3">
                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  Parameter Terbaca dari Foto Ini ({lightboxImage.extractedCount})
                </div>
                {lightboxImage.aiNotes && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    {lightboxImage.aiNotes}
                  </p>
                )}

                {Object.keys(lightboxImage.extractedParams || {}).length === 0 ? (
                  <div className="text-xs text-slate-400 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    {lightboxImage.analyzedAt
                      ? "Tidak ada parameter listrik yang terbaca jelas dari foto ini."
                      : "Gambar belum dianalisis. Klik Analisis & Crosscheck Otomatis."}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {Object.values(lightboxImage.extractedParams).map((p) => (
                      <div key={p.key} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-100 font-mono text-[11px]">
                            {p.key}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate" title={p.rawText}>
                            OCR: {p.rawText}
                          </div>
                        </div>
                        <div className="text-right font-mono font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatParamValue(p.value, p.key)} {p.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GEMINI AI API KEY SETTINGS MODAL */}
      {aiModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setAiModalOpen(false)}
        >
          <div
            className="relative w-[480px] max-w-full max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Pengaturan Gemini API Key (AI Vision)
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Diperlukan agar AI dapat membaca angka parameter otomatis dari foto Panel LCD &amp; screenshot eWON.
                  Tersimpan aman di server (langsung aktif tanpa restart).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                aria-label="Tutup modal pengaturan AI"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Status Saat Ini:</span>
                {aiConfig?.configured ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                    ✓ Aktif ({aiConfig.source === "ui_saved" ? "Tersimpan dari UI" : ".env Server"})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold">
                    Belum Dikonfigurasi
                  </span>
                )}
              </div>
              {aiConfig?.configured && (
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="text-slate-500">Key Terpasang:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{aiConfig.maskedKey}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-slate-500">Model Vision:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{aiConfig?.model || "gemini-2.5-flash"}</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!apiKeyDraft.trim()) {
                  setApiKeyError("Masukkan Gemini API Key terlebih dahulu.");
                  return;
                }
                void handleSaveAiApiKey(apiKeyDraft.trim());
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Gemini API Key (dari Google AI Studio)
                </label>
                <div className="relative">
                  <input
                    type={showApiKeyPlain ? "text" : "password"}
                    value={apiKeyDraft}
                    onChange={(e) => {
                      setApiKeyDraft(e.target.value);
                      setApiKeyError(null);
                    }}
                    placeholder="AIzaSy..."
                    autoComplete="off"
                    className="w-full pr-16 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyPlain((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showApiKeyPlain ? "Sembunyi" : "Lihat"}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Key disimpan di MongoDB &amp; disk lokal server — tidak pernah diekspos kembali ke browser.
                </p>
              </div>

              {apiKeyError && (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {apiKeyError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {aiConfig?.source === "ui_saved" ? (
                  <button
                    type="button"
                    disabled={savingApiKey}
                    onClick={() => void handleSaveAiApiKey(null)}
                    className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Hapus Key Kustom
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAiModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingApiKey || !apiKeyDraft.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white text-xs font-extrabold shadow-sm cursor-pointer transition"
                  >
                    {savingApiKey ? "Menyimpan..." : "Simpan & Aktifkan"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
