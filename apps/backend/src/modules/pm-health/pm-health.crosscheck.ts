import crypto from "crypto";
import fs from "fs";
import path from "path";
import { env } from "../../config/env.config";
import { logger } from "../../config/logger.config";
import { resolvePmMeta } from "./pm-health.catalog";
import type {
  CrosscheckComparisonRow,
  CrosscheckConfidence,
  CrosscheckExtractedValue,
  CrosscheckImageItem,
  CrosscheckLiveEndpointOrigin,
  CrosscheckOverallStatus,
  CrosscheckPairSummary,
  CrosscheckParamKey,
  CrosscheckRowStatus,
  CrosscheckSource,
  CrosscheckSourceTag,
  CrosscheckToleranceMode,
  PmCrosscheckRecord,
  PmCrosscheckReport,
  PmCrosscheckSummaryItem
} from "./pm-health.types";

const DATA_DIR = path.resolve(__dirname, "..", "..", "..", "data", "pm-health");
const CROSSCHECK_FILE = path.join(DATA_DIR, "pm-crosscheck.json");
const IMAGES_ROOT_DIR = path.join(DATA_DIR, "crosscheck-images");
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BATCH_SIZE = 5;

export interface CrosscheckParamSpec {
  key: CrosscheckParamKey;
  label: string;
  group: string;
  unit: string;
  /** Tight match tolerance in percentage */
  tightPct: number;
  /** Tight match absolute floor tolerance */
  tightAbs: number;
  /** Slight drift (warning) percentage tolerance */
  driftPct: number;
  /** Slight drift absolute floor tolerance */
  driftAbs: number;
}

export const CROSSCHECK_PARAM_SPECS: CrosscheckParamSpec[] = [
  // Energi
  { key: "active_energy", label: "Active Energy", group: "Energi", unit: "kWh", tightPct: 0.5, tightAbs: 5, driftPct: 2.0, driftAbs: 25 },
  // Daya
  { key: "active_power_total", label: "Active Power Total", group: "Daya", unit: "kW", tightPct: 3.5, tightAbs: 0.6, driftPct: 10.0, driftAbs: 2.0 },
  { key: "reactive_power_total", label: "Reactive Power Total", group: "Daya", unit: "kVAR", tightPct: 5.0, tightAbs: 0.8, driftPct: 12.0, driftAbs: 2.5 },
  { key: "apparent_power_total", label: "Apparent Power Total", group: "Daya", unit: "kVA", tightPct: 3.5, tightAbs: 0.6, driftPct: 10.0, driftAbs: 2.0 },
  { key: "power_factor", label: "Power Factor (PF)", group: "Daya", unit: "", tightPct: 3.5, tightAbs: 0.03, driftPct: 8.0, driftAbs: 0.07 },
  // Tegangan L-L
  { key: "volt_ab", label: "Tegangan L1-L2 (Vab)", group: "Tegangan L-L", unit: "V", tightPct: 1.5, tightAbs: 5, driftPct: 3.5, driftAbs: 12 },
  { key: "volt_bc", label: "Tegangan L2-L3 (Vbc)", group: "Tegangan L-L", unit: "V", tightPct: 1.5, tightAbs: 5, driftPct: 3.5, driftAbs: 12 },
  { key: "volt_ca", label: "Tegangan L3-L1 (Vca)", group: "Tegangan L-L", unit: "V", tightPct: 1.5, tightAbs: 5, driftPct: 3.5, driftAbs: 12 },
  { key: "volt_ll", label: "Tegangan L-L Avg", group: "Tegangan L-L", unit: "V", tightPct: 1.5, tightAbs: 5, driftPct: 3.5, driftAbs: 12 },
  // Tegangan L-N
  { key: "volt_an", label: "Tegangan L1-N (Van)", group: "Tegangan L-N", unit: "V", tightPct: 1.5, tightAbs: 3.5, driftPct: 3.5, driftAbs: 8 },
  { key: "volt_bn", label: "Tegangan L2-N (Vbn)", group: "Tegangan L-N", unit: "V", tightPct: 1.5, tightAbs: 3.5, driftPct: 3.5, driftAbs: 8 },
  { key: "volt_cn", label: "Tegangan L3-N (Vcn)", group: "Tegangan L-N", unit: "V", tightPct: 1.5, tightAbs: 3.5, driftPct: 3.5, driftAbs: 8 },
  { key: "volt_ln", label: "Tegangan L-N Avg", group: "Tegangan L-N", unit: "V", tightPct: 1.5, tightAbs: 3.5, driftPct: 3.5, driftAbs: 8 },
  // Arus & Frekuensi
  { key: "current_a", label: "Arus Fasa A / L1 (Ia)", group: "Arus & Frekuensi", unit: "A", tightPct: 5.0, tightAbs: 1.5, driftPct: 12.0, driftAbs: 4.0 },
  { key: "current_b", label: "Arus Fasa B / L2 (Ib)", group: "Arus & Frekuensi", unit: "A", tightPct: 5.0, tightAbs: 1.5, driftPct: 12.0, driftAbs: 4.0 },
  { key: "current_c", label: "Arus Fasa C / L3 (Ic)", group: "Arus & Frekuensi", unit: "A", tightPct: 5.0, tightAbs: 1.5, driftPct: 12.0, driftAbs: 4.0 },
  { key: "frequency", label: "Frekuensi", group: "Arus & Frekuensi", unit: "Hz", tightPct: 0.6, tightAbs: 0.3, driftPct: 1.5, driftAbs: 0.7 },
  // Power Quality
  { key: "voltage_unbalance", label: "Voltage Unbalance", group: "Power Quality", unit: "%", tightPct: 15.0, tightAbs: 0.4, driftPct: 35.0, driftAbs: 1.0 },
  { key: "current_unbalance", label: "Current Unbalance", group: "Power Quality", unit: "%", tightPct: 15.0, tightAbs: 1.5, driftPct: 35.0, driftAbs: 4.0 },
  { key: "thd_volt_a", label: "THDv Fasa A", group: "Power Quality", unit: "%", tightPct: 12.0, tightAbs: 0.4, driftPct: 25.0, driftAbs: 1.0 },
  { key: "thd_volt_b", label: "THDv Fasa B", group: "Power Quality", unit: "%", tightPct: 12.0, tightAbs: 0.4, driftPct: 25.0, driftAbs: 1.0 },
  { key: "thd_volt_c", label: "THDv Fasa C", group: "Power Quality", unit: "%", tightPct: 12.0, tightAbs: 0.4, driftPct: 25.0, driftAbs: 1.0 },
  { key: "thd_current_a", label: "THDi Fasa A", group: "Power Quality", unit: "%", tightPct: 12.0, tightAbs: 1.2, driftPct: 25.0, driftAbs: 3.0 },
  { key: "thd_current_b", label: "THDi Fasa B", group: "Power Quality", unit: "%", tightPct: 12.0, tightAbs: 1.2, driftPct: 25.0, driftAbs: 3.0 },
  { key: "thd_current_c", label: "THDi Fasa C", group: "Power Quality", unit: "%", tightPct: 12.0, tightAbs: 1.2, driftPct: 25.0, driftAbs: 3.0 }
];

const SPEC_BY_KEY = new Map<CrosscheckParamKey, CrosscheckParamSpec>(
  CROSSCHECK_PARAM_SPECS.map((s) => [s.key, s])
);
const VALID_PARAM_KEYS = new Set<string>(CROSSCHECK_PARAM_SPECS.map((s) => s.key));

function sanitizePmId(pmId: string): string {
  return String(pmId || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

function createEmptyRecord(pmId: string): PmCrosscheckRecord {
  return {
    pmId,
    toleranceMode: "strict",
    images: [],
    liveEndpointSnapshot: null,
    manualOverrides: {},
    lastAnalyzedAt: null,
    lastAnalyzedBy: null,
    aiModel: null,
    aiSummary: null,
    updatedAt: null
  };
}

/**
 * Dynamic electrical parameters naturally fluctuate second-by-second on motors/chillers/compressors
 * when photos are taken several seconds apart, whereas voltages, frequency, and cumulative kWh stay stable.
 */
const DYNAMIC_LOAD_PARAMS = new Set<CrosscheckParamKey>([
  "active_power_total",
  "reactive_power_total",
  "apparent_power_total",
  "power_factor",
  "current_a",
  "current_b",
  "current_c",
  "voltage_unbalance",
  "current_unbalance",
  "thd_volt_a",
  "thd_volt_b",
  "thd_volt_c",
  "thd_current_a",
  "thd_current_b",
  "thd_current_c"
]);

function effectiveTolerances(
  spec: CrosscheckParamSpec,
  mode: CrosscheckToleranceMode
): { tightPct: number; tightAbs: number; driftPct: number; driftAbs: number } {
  if (mode === "strict") {
    return {
      tightPct: spec.tightPct,
      tightAbs: spec.tightAbs,
      driftPct: spec.driftPct,
      driftAbs: spec.driftAbs
    };
  }
  const isDynamic = DYNAMIC_LOAD_PARAMS.has(spec.key);
  if (mode === "normal") {
    // Handles ~5-30s field gap: relaxes fluctuating load params, keeps voltage/freq/energy strict
    const tm = isDynamic ? 1.55 : spec.key === "active_energy" ? 1.2 : 1.1;
    const dm = isDynamic ? 1.7 : spec.key === "active_energy" ? 1.3 : 1.15;
    return {
      tightPct: spec.tightPct * tm,
      tightAbs: spec.tightAbs * tm,
      driftPct: spec.driftPct * dm,
      driftAbs: spec.driftAbs * dm
    };
  }
  // "relaxed": Handles ~1-5 minute field walk gap while still catching register/scale errors
  const tm = isDynamic ? 2.2 : spec.key === "active_energy" ? 1.8 : 1.25;
  const dm = isDynamic ? 2.5 : spec.key === "active_energy" ? 2.2 : 1.4;
  return {
    tightPct: spec.tightPct * tm,
    tightAbs: spec.tightAbs * tm,
    driftPct: spec.driftPct * dm,
    driftAbs: spec.driftAbs * dm
  };
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer; ext: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  let mimeType = "image/jpeg";
  let base64 = dataUrl;
  if (match && match.length === 3) {
    mimeType = match[1].toLowerCase();
    base64 = match[2];
  }
  const ext =
    mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
      ? "webp"
      : mimeType.includes("gif")
      ? "gif"
      : "jpg";
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error("Data gambar kosong atau tidak valid.");
  }
  if (buffer.length > 15 * 1024 * 1024) {
    throw new Error("Ukuran gambar melebihi batas maksimum 15 MB.");
  }
  return { mimeType, buffer, ext };
}

function normalizeParamValue(key: CrosscheckParamKey, rawVal: number, rawUnit?: string): number {
  let val = Number(rawVal);
  if (!Number.isFinite(val)) return rawVal;
  const u = (rawUnit || "").trim().toLowerCase();

  // Power factor 4-quadrant Schneider normalization (e.g., 1.05 -> 0.95, -0.95 -> 0.95)
  if (key === "power_factor") {
    if (val > 1.0 && val <= 2.0) val = 2.0 - val;
    else if (val < -1.0 && val >= -2.0) val = -2.0 - val;
    val = Math.min(1.0, Math.abs(val));
    return Number(val.toFixed(3));
  }

  // Energy unit conversions -> kWh
  if (key === "active_energy") {
    if (u === "mwh") val = val * 1000;
    else if (u === "gwh") val = val * 1_000_000;
    else if (u === "wh") val = val / 1000;
    return Number(val.toFixed(2));
  }

  // Power unit conversions -> kW / kVAR / kVA
  if (key === "active_power_total") {
    if (u === "w" || u === "watt") val = val / 1000;
    else if (u === "mw") val = val * 1000;
    return Number(val.toFixed(2));
  }
  if (key === "reactive_power_total") {
    if (u === "var") val = val / 1000;
    else if (u === "mvar") val = val * 1000;
    return Number(val.toFixed(2));
  }
  if (key === "apparent_power_total") {
    if (u === "va") val = val / 1000;
    else if (u === "mva") val = val * 1000;
    return Number(val.toFixed(2));
  }

  // Voltage unit conversion -> V
  if (
    key === "volt_ab" ||
    key === "volt_bc" ||
    key === "volt_ca" ||
    key === "volt_ll" ||
    key === "volt_an" ||
    key === "volt_bn" ||
    key === "volt_cn" ||
    key === "volt_ln"
  ) {
    if (u === "kv") val = val * 1000;
    return Number(val.toFixed(2));
  }

  // Current unit conversion -> A
  if (key === "current_a" || key === "current_b" || key === "current_c") {
    if (u === "ka") val = val * 1000;
    else if (u === "ma") val = val / 1000;
    return Number(val.toFixed(2));
  }

  // Unbalance decimal ratio -> percentage when clearly fractional (e.g., 0.0054 -> 0.54%)
  if (key === "voltage_unbalance" || key === "current_unbalance") {
    if (val > 0 && val < 0.05 && !u.includes("%")) {
      val = val * 100;
    }
    return Number(val.toFixed(2));
  }

  return Number(val.toFixed(2));
}

function confidenceRank(c: CrosscheckConfidence): number {
  if (c === "high") return 3;
  if (c === "medium") return 2;
  return 1;
}

function detectScaleMismatch(a: number, b: number): string | null {
  if (Math.abs(a) < 1e-6 || Math.abs(b) < 1e-6) return null;
  const ratio = Math.max(Math.abs(a), Math.abs(b)) / Math.min(Math.abs(a), Math.abs(b));
  const candidates: { factor: number; label: string }[] = [
    { factor: 10, label: "×10 / ÷10" },
    { factor: 100, label: "×100 / ÷100" },
    { factor: 1000, label: "×1000 / ÷1000 (kWh vs MWh / W vs kW)" },
    { factor: 10000, label: "×10.000" }
  ];
  for (const c of candidates) {
    if (Math.abs(ratio - c.factor) / c.factor <= 0.04) {
      return c.label;
    }
  }
  return null;
}

function comparePairValues(
  spec: CrosscheckParamSpec,
  a: number,
  b: number,
  mode: CrosscheckToleranceMode
): { status: "match" | "slight_diff" | "scale_mismatch" | "mismatch"; absDiff: number; pctDiff: number; scaleLabel: string | null } {
  const absDiff = Math.abs(a - b);
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  const pctDiff = (absDiff / denom) * 100;
  const tol = effectiveTolerances(spec, mode);

  // Exact or within tight tolerance
  if (absDiff <= tol.tightAbs || pctDiff <= tol.tightPct) {
    return { status: "match", absDiff, pctDiff, scaleLabel: null };
  }

  // Slight drift (normal live load fluctuation between taking LCD photo & eWON/Endpoint capture)
  if (absDiff <= tol.driftAbs || pctDiff <= tol.driftPct) {
    return { status: "slight_diff", absDiff, pctDiff, scaleLabel: null };
  }

  // Check classic Modbus / SCADA scaling mismatch (×10, ×100, ×1000)
  const scaleLabel = detectScaleMismatch(a, b);
  if (scaleLabel) {
    return { status: "scale_mismatch", absDiff, pctDiff, scaleLabel };
  }

  return { status: "mismatch", absDiff, pctDiff, scaleLabel: null };
}

function resolveEffectiveSource(img: CrosscheckImageItem): CrosscheckSource | null {
  if (img.source !== "auto") return img.source;
  return img.detectedSource;
}

/**
 * Merges extracted values from arbitrarily many images per source bucket
 * (e.g. 1 eWON screenshot + 1 Endpoint screenshot/live snapshot + 5 Panel LCD photos)
 * and performs deterministic 3-way engineering comparison.
 */
export function computeCrosscheckReport(record: PmCrosscheckRecord): PmCrosscheckReport {
  const toleranceMode: CrosscheckToleranceMode =
    record.toleranceMode === "normal" || record.toleranceMode === "relaxed" ? record.toleranceMode : "strict";
  const merged: Record<CrosscheckSource, Record<string, CrosscheckExtractedValue>> = {
    ewon: {},
    endpoint: {},
    panel_lcd: {}
  };

  let ewonImages = 0;
  let endpointImages = 0;
  let panelLcdImages = 0;
  let autoImages = 0;

  // 1. Seed Endpoint from Live Snapshot first (images & manual overrides take higher precedence if present)
  if (record.liveEndpointSnapshot?.values) {
    for (const [k, v] of Object.entries(record.liveEndpointSnapshot.values)) {
      if (!VALID_PARAM_KEYS.has(k)) continue;
      merged.endpoint[k] = { ...v, isLiveEndpoint: true };
    }
  }

  // 2. Merge all images belonging to each source bucket (unlimited photos per source!)
  for (const img of record.images) {
    const effSource = resolveEffectiveSource(img);
    if (effSource === "ewon") ewonImages++;
    else if (effSource === "endpoint") endpointImages++;
    else if (effSource === "panel_lcd") panelLcdImages++;
    else autoImages++;

    if (!effSource) continue;
    const bucket = merged[effSource];

    for (const [k, rawItem] of Object.entries(img.extractedParams || {})) {
      if (!VALID_PARAM_KEYS.has(k)) continue;
      const existing = bucket[k];
      // Prefer image-extracted over live snapshot for endpoint if uploaded; among multiple photos of same source,
      // prefer higher confidence, or newer photo if equal confidence.
      if (
        !existing ||
        existing.isLiveEndpoint ||
        confidenceRank(rawItem.confidence) >= confidenceRank(existing.confidence)
      ) {
        bucket[k] = {
          ...rawItem,
          imageId: img.id,
          imageName: img.caption ? `${img.caption} (${img.fileName})` : img.fileName
        };
      }
    }
  }

  // 3. Apply any user manual overrides on top
  const sources: CrosscheckSource[] = ["ewon", "endpoint", "panel_lcd"];
  for (const src of sources) {
    const overrides = record.manualOverrides?.[src];
    if (!overrides) continue;
    for (const [k, item] of Object.entries(overrides)) {
      if (!VALID_PARAM_KEYS.has(k) || !item) continue;
      merged[src][k] = { ...item, manualOverride: true };
    }
  }

  // 4. Compare parameter-by-parameter across all 3 sources
  const rows: CrosscheckComparisonRow[] = [];
  const initPair = (): CrosscheckPairSummary => ({
    comparedCount: 0,
    matchCount: 0,
    slightDiffCount: 0,
    mismatchCount: 0,
    status: "insufficient"
  });
  const pairEwonEndpoint = initPair();
  const pairEwonLcd = initPair();
  const pairEndpointLcd = initPair();

  let matchCount = 0;
  let slightDiffCount = 0;
  let scaleMismatchCount = 0;
  let mismatchCount = 0;
  let singleSourceCount = 0;

  for (const spec of CROSSCHECK_PARAM_SPECS) {
    const ev = merged.ewon[spec.key] ?? null;
    const ep = merged.endpoint[spec.key] ?? null;
    const lcd = merged.panel_lcd[spec.key] ?? null;

    const present: { src: CrosscheckSource; label: string; item: CrosscheckExtractedValue }[] = [];
    if (ev) present.push({ src: "ewon", label: "eWON", item: ev });
    if (ep) present.push({ src: "endpoint", label: "Endpoint", item: ep });
    if (lcd) present.push({ src: "panel_lcd", label: "Panel LCD", item: lcd });

    if (present.length === 0) continue;

    if (present.length === 1) {
      singleSourceCount++;
      rows.push({
        key: spec.key,
        label: spec.label,
        group: spec.group,
        unit: spec.unit,
        ewon: ev,
        endpoint: ep,
        panel_lcd: lcd,
        status: "single_source",
        maxAbsDiff: null,
        maxPctDiff: null,
        note: `Baru terbaca di ${present[0].label}. Tambahkan gambar sumber lain untuk crosscheck.`
      });
      continue;
    }

    // Compare every available pair
    let worstStatus: CrosscheckRowStatus = "match";
    let maxAbsDiff = 0;
    let maxPctDiff = 0;
    let scaleDetected: string | null = null;
    const pairNotes: string[] = [];

    const checkPair = (
      p1: { label: string; item: CrosscheckExtractedValue },
      p2: { label: string; item: CrosscheckExtractedValue },
      summaryBucket: CrosscheckPairSummary
    ) => {
      const cmp = comparePairValues(spec, p1.item.value, p2.item.value, toleranceMode);
      summaryBucket.comparedCount++;
      if (cmp.absDiff > maxAbsDiff) maxAbsDiff = cmp.absDiff;
      if (cmp.pctDiff > maxPctDiff) maxPctDiff = cmp.pctDiff;

      if (cmp.status === "match") {
        summaryBucket.matchCount++;
      } else if (cmp.status === "slight_diff") {
        summaryBucket.slightDiffCount++;
        if (worstStatus === "match") worstStatus = "slight_diff";
        pairNotes.push(`${p1.label} vs ${p2.label}: selisih ${cmp.pctDiff.toFixed(1)}%`);
      } else if (cmp.status === "scale_mismatch") {
        summaryBucket.mismatchCount++;
        worstStatus = "scale_mismatch";
        scaleDetected = cmp.scaleLabel;
        pairNotes.push(`${p1.label} vs ${p2.label}: beda skala ${cmp.scaleLabel}`);
      } else {
        summaryBucket.mismatchCount++;
        if (worstStatus !== "scale_mismatch") worstStatus = "mismatch";
        pairNotes.push(`${p1.label} vs ${p2.label}: selisih ${cmp.pctDiff.toFixed(1)}%`);
      }
    };

    if (ev && ep) checkPair({ label: "eWON", item: ev }, { label: "Endpoint", item: ep }, pairEwonEndpoint);
    if (ev && lcd) checkPair({ label: "eWON", item: ev }, { label: "Panel LCD", item: lcd }, pairEwonLcd);
    if (ep && lcd) checkPair({ label: "Endpoint", item: ep }, { label: "Panel LCD", item: lcd }, pairEndpointLcd);

    if (worstStatus === "match") matchCount++;
    else if (worstStatus === "slight_diff") slightDiffCount++;
    else if (worstStatus === "scale_mismatch") scaleMismatchCount++;
    else if (worstStatus === "mismatch") mismatchCount++;

    const note =
      worstStatus === "match"
        ? `Sesuai antar ${present.map((p) => p.label).join(" & ")} (selisih ${maxPctDiff.toFixed(2)}%)`
        : worstStatus === "scale_mismatch"
        ? `Terdeteksi perbedaan faktor skala (${scaleDetected}) — ${pairNotes.join("; ")}`
        : pairNotes.join("; ");

    rows.push({
      key: spec.key,
      label: spec.label,
      group: spec.group,
      unit: spec.unit,
      ewon: ev,
      endpoint: ep,
      panel_lcd: lcd,
      status: worstStatus,
      maxAbsDiff: Number(maxAbsDiff.toFixed(3)),
      maxPctDiff: Number(maxPctDiff.toFixed(2)),
      note,
      scaleFactorDetected: scaleDetected
    });
  }

  const finalizePair = (p: CrosscheckPairSummary) => {
    if (p.comparedCount === 0) p.status = "insufficient";
    else if (p.mismatchCount > 0) p.status = "mismatch";
    else if (p.slightDiffCount > 0) p.status = "warning";
    else p.status = "match";
  };
  finalizePair(pairEwonEndpoint);
  finalizePair(pairEwonLcd);
  finalizePair(pairEndpointLcd);

  const comparedParams = matchCount + slightDiffCount + scaleMismatchCount + mismatchCount;
  const totalBad = mismatchCount + scaleMismatchCount;

  let overallStatus: CrosscheckOverallStatus = "incomplete";
  let verdictTitle = "Belum Cukup Data Pembanding";
  let verdictDetail =
    "Unggah gambar minimal dari 2 sumber berbeda (mis. Panel LCD + eWON atau Endpoint) lalu klik Analisis & Crosscheck Otomatis.";

  if (comparedParams > 0) {
    if (totalBad > 0) {
      overallStatus = "mismatch";
      verdictTitle = `Ditemukan ${totalBad} Parameter Tidak Sesuai`;
      verdictDetail =
        scaleMismatchCount > 0
          ? `${scaleMismatchCount} parameter terindikasi beda faktor skala (×10/×100/×1000) dan ${mismatchCount} parameter berbeda signifikan. Periksa register Modbus / scaling eWON & Endpoint.`
          : `${totalBad} dari ${comparedParams} parameter yang dibandingkan memiliki selisih melebihi toleransi. Periksa mapping register atau foto sumber terkait.`;
    } else if (slightDiffCount > 0) {
      overallStatus = "warning";
      verdictTitle = `Sesuai dengan ${slightDiffCount} Selisih Ringan`;
      verdictDetail = `${matchCount} parameter cocok ketat dan ${slightDiffCount} parameter memiliki selisih ringan (umum terjadi akibat jeda waktu pengambilan foto LCD vs screenshot eWON/Endpoint).`;
    } else {
      overallStatus = "all_match";
      verdictTitle = `Semua ${matchCount} Parameter Sesuai`;
      verdictDetail =
        "Seluruh parameter yang dibandingkan antar sumber berada dalam batas toleransi normal. Data Power Meter terverifikasi sinkron.";
    }
  }

  return {
    pmId: record.pmId,
    toleranceMode,
    overallStatus,
    verdictTitle,
    verdictDetail,
    sourceCoverage: {
      ewonParams: Object.keys(merged.ewon).length,
      endpointParams: Object.keys(merged.endpoint).length,
      panelLcdParams: Object.keys(merged.panel_lcd).length,
      ewonImages,
      endpointImages,
      panelLcdImages,
      autoImages,
      hasLiveEndpoint: Boolean(record.liveEndpointSnapshot && Object.keys(record.liveEndpointSnapshot.values).length > 0)
    },
    stats: {
      totalDetectedParams: rows.length,
      comparedParams,
      matchCount,
      slightDiffCount,
      scaleMismatchCount,
      mismatchCount,
      singleSourceCount
    },
    pairs: {
      ewonVsEndpoint: pairEwonEndpoint,
      ewonVsLcd: pairEwonLcd,
      endpointVsLcd: pairEndpointLcd
    },
    rows
  };
}

interface GeminiBatchExtractResult {
  images: Array<{
    imageId: string;
    detectedSource: CrosscheckSource;
    aiNotes?: string;
    parameters: Array<{
      key: string;
      value: number;
      unit?: string;
      rawText?: string;
      confidence?: CrosscheckConfidence;
    }>;
  }>;
  summary?: string;
}

/**
 * Calls Gemini 2.5 Flash Vision API on a batch of images (up to GEMINI_BATCH_SIZE per call)
 * to extract every visible electrical parameter for the target Power Meter.
 */
async function callGeminiVisionBatch(
  pmId: string,
  pmName: string,
  batch: Array<{ img: CrosscheckImageItem; base64: string }>
): Promise<GeminiBatchExtractResult> {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di server backend (.env).");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const paramKeysDoc = CROSSCHECK_PARAM_SPECS.map((s) => `- "${s.key}" (${s.label}, satuan target: ${s.unit || "tanpa satuan"})`).join("\n");

  const promptText = `
Anda adalah sistem verifikasi & OCR teknis presisi tinggi untuk Power Meter listrik industri (Schneider PM5100, PM5350, PM5500, PM5560, PM8000, eWON Flexy Tag Table, dan JSON/API Endpoint SCADA).
Target Power Meter yang sedang di-crosscheck: ${pmId} (${pmName}).

Tugas Anda untuk SETIAP gambar yang diberikan:
1. Tentukan sumber gambar ("detectedSource"):
   - "panel_lcd": foto layar LCD fisik Power Meter di panel listrik (tampilan 7-segment / dot matrix Schneider / meter digital).
   - "ewon": screenshot tabel Tag Values / eWON Flexy / Modbus gateway / Ignition Tag Browser.
   - "endpoint": screenshot API JSON, Postman, browser endpoint WebDev, atau tampilan tabel/card web SCADA.
   Jika pengguna sudah menetapkan hint sumber (bukan "auto"), utamakan hint tersebut kecuali jelas keliru.
2. Baca SEMUA parameter listrik yang terlihat jelas pada gambar tersebut untuk ${pmId} (jika gambar tabel berisi banyak PM, fokus HANYA pada baris/kolom milik ${pmId}).
3. Petakan setiap parameter ke key kanonik berikut (JANGAN mengarang angka; jika tidak terlihat atau buram total, jangan dimasukkan):
${paramKeysDoc}

Aturan PENTING parsing angka & satuan:
- Kembalikan "value" sebagai angka JSON murni (titik sebagai pemisah desimal, TANPA pemisah ribuan).
- Hati-hati format angka Indonesia/Eropa vs Inggris! Contoh: "1.207.775,45 kWh" => value: 1207775.45, unit: "kWh". "1,207,775.45 kWh" => value: 1207775.45, unit: "kWh".
- Perhatikan satuan pada LCD! Contoh: jika LCD menampilkan "1207.8 MWh", set value: 1207.8 dan unit: "MWh" (atau langsung konversi ke kWh dengan menyertakan unit yang sesuai di "unit" dan teks asli di "rawText").
- Pada layar LCD Schneider, label bisa berupa:
  * Vab / V12 / L1-L2 / U12 -> "volt_ab"
  * Vbc / V23 / L2-L3 / U23 -> "volt_bc"
  * Vca / V31 / L3-L1 / U31 -> "volt_ca"
  * Vll / V L-L Avg -> "volt_ll"
  * Van / V1N / L1-N -> "volt_an"
  * Vbn / V2N / L2-N -> "volt_bn"
  * Vcn / V3N / L3-N -> "volt_cn"
  * Vln / V L-N Avg -> "volt_ln"
  * Ia / I1 / I L1 / R -> "current_a"; Ib / I2 / S -> "current_b"; Ic / I3 / T -> "current_c"
  * P / kW / Active Power Total / Ptot -> "active_power_total"
  * Q / kVAR / Reactive Power Total / Qtot -> "reactive_power_total"
  * S / kVA / Apparent Power Total / Stot -> "apparent_power_total"
  * PF / Power Factor Total -> "power_factor"
  * F / Freq / Hz -> "frequency"
  * E / Ep / Active Energy / kWh / MWh / Wh Del / Total Active Energy -> "active_energy"
  * THD V1/Va/Vab -> "thd_volt_a", THD V2/Vb/Vbc -> "thd_volt_b", THD V3/Vc/Vca -> "thd_volt_c"
  * THD I1/Ia -> "thd_current_a", THD I2/Ib -> "thd_current_b", THD I3/Ic -> "thd_current_c"
  * V Unbal -> "voltage_unbalance", I Unbal -> "current_unbalance"
- Sertakan "rawText" (teks persis seperti terlihat di gambar, mis. "Vab = 403.5 V") dan "confidence" ("high" | "medium" | "low").
- Berikan "aiNotes" singkat dalam Bahasa Indonesia per gambar (mis. "Terbaca tegangan 3 fasa & frekuensi dari layar LCD").

Kembalikan HANYA objek JSON valid dengan skema berikut:
{
  "images": [
    {
      "imageId": "id gambar persis sesuai label",
      "detectedSource": "ewon" | "endpoint" | "panel_lcd",
      "aiNotes": "catatan singkat hasil pembacaan gambar ini",
      "parameters": [
        {
          "key": "volt_ab",
          "value": 403.5,
          "unit": "V",
          "rawText": "Vab 403.5 V",
          "confidence": "high"
        }
      ]
    }
  ],
  "summary": "ringkasan 1-2 kalimat dalam Bahasa Indonesia mengenai kualitas pembacaan gambar"
}
`;

  const parts: any[] = [{ text: promptText }];
  for (const item of batch) {
    parts.push({
      text: `Image ID: "${item.img.id}" | Nama File: "${item.img.fileName}" | Hint Sumber User: "${item.img.source}" | Catatan User: "${item.img.caption || "-"}"`
    });
    parts.push({
      inlineData: {
        mimeType: item.img.mimeType,
        data: item.base64
      }
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error({ status: response.status, errText: errText.slice(0, 400) }, "[PM-Crosscheck] Gemini API failed");
    throw new Error(`Gemini Vision API error (${response.status}): ${response.statusText}`);
  }

  const result = (await response.json()) as any;
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Respons Gemini Vision API kosong atau tidak valid.");
  }

  let parsed: GeminiBatchExtractResult;
  try {
    parsed = JSON.parse(String(rawText).trim());
  } catch {
    // Strip markdown code fences if model wrapped JSON
    const cleaned = String(rawText)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  }

  return parsed;
}

class PmCrosscheckLocalStore {
  private records: Map<string, PmCrosscheckRecord> = new Map();
  private loaded = false;

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(IMAGES_ROOT_DIR)) fs.mkdirSync(IMAGES_ROOT_DIR, { recursive: true });
      if (fs.existsSync(CROSSCHECK_FILE)) {
        const raw = fs.readFileSync(CROSSCHECK_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [key, val] of Object.entries(parsed as Record<string, any>)) {
            if (!val || typeof val !== "object") continue;
            const normId = sanitizePmId(val.pmId || key);
            if (!normId) continue;
            this.records.set(normId, {
              pmId: normId,
              toleranceMode:
                val.toleranceMode === "normal" || val.toleranceMode === "relaxed" ? val.toleranceMode : "strict",
              images: Array.isArray(val.images) ? val.images : [],
              liveEndpointSnapshot: val.liveEndpointSnapshot || null,
              manualOverrides: val.manualOverrides && typeof val.manualOverrides === "object" ? val.manualOverrides : {},
              lastAnalyzedAt: typeof val.lastAnalyzedAt === "string" ? val.lastAnalyzedAt : null,
              lastAnalyzedBy: typeof val.lastAnalyzedBy === "string" ? val.lastAnalyzedBy : null,
              aiModel: typeof val.aiModel === "string" ? val.aiModel : null,
              aiSummary: typeof val.aiSummary === "string" ? val.aiSummary : null,
              updatedAt: typeof val.updatedAt === "string" ? val.updatedAt : null
            });
          }
        }
      }
    } catch {
      // Ignore corrupt local JSON
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const obj: Record<string, PmCrosscheckRecord> = {};
      for (const [k, v] of this.records.entries()) {
        obj[k] = v;
      }
      const tmpPath = `${CROSSCHECK_FILE}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), "utf-8");
      fs.renameSync(tmpPath, CROSSCHECK_FILE);
    } catch (err: any) {
      logger.warn(`[PM-Crosscheck] Persist failed: ${err?.message || err}`);
    }
  }

  public getRecord(pmId: string): PmCrosscheckRecord {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const existing = this.records.get(key);
    return existing ? JSON.parse(JSON.stringify(existing)) : createEmptyRecord(key);
  }

  public listSummaries(): Record<string, PmCrosscheckSummaryItem> {
    this.ensureLoaded();
    const out: Record<string, PmCrosscheckSummaryItem> = {};
    for (const [key, rec] of this.records.entries()) {
      const report = computeCrosscheckReport(rec);
      out[key] = {
        pmId: key,
        imageCount: rec.images.length,
        ewonImages: report.sourceCoverage.ewonImages,
        endpointImages: report.sourceCoverage.endpointImages,
        panelLcdImages: report.sourceCoverage.panelLcdImages,
        hasLiveEndpoint: report.sourceCoverage.hasLiveEndpoint,
        comparedParams: report.stats.comparedParams,
        matchCount: report.stats.matchCount,
        slightDiffCount: report.stats.slightDiffCount,
        mismatchCount: report.stats.mismatchCount + report.stats.scaleMismatchCount,
        overallStatus: report.overallStatus,
        lastAnalyzedAt: rec.lastAnalyzedAt
      };
    }
    return out;
  }

  public addImage(
    pmId: string,
    input: {
      dataUrl: string;
      fileName: string;
      source: CrosscheckSourceTag;
      caption?: string;
    },
    actor: string,
    nowWib: string
  ): { record: PmCrosscheckRecord; added: CrosscheckImageItem } {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    if (!key) throw new Error("pmId tidak valid.");

    const { mimeType, buffer, ext } = parseDataUrl(input.dataUrl);
    const imageId = `img_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const storedFileName = `${imageId}.${ext}`;
    const pmDir = path.join(IMAGES_ROOT_DIR, key);
    if (!fs.existsSync(pmDir)) fs.mkdirSync(pmDir, { recursive: true });
    fs.writeFileSync(path.join(pmDir, storedFileName), buffer);

    const rec = this.records.get(key) ?? createEmptyRecord(key);
    const validSource: CrosscheckSourceTag =
      input.source === "ewon" || input.source === "endpoint" || input.source === "panel_lcd" || input.source === "auto"
        ? input.source
        : "auto";

    const item: CrosscheckImageItem = {
      id: imageId,
      pmId: key,
      source: validSource,
      detectedSource: validSource === "auto" ? null : validSource,
      fileName: String(input.fileName || `image.${ext}`).slice(0, 140),
      storedFileName,
      mimeType,
      sizeBytes: buffer.length,
      caption: String(input.caption || "").trim().slice(0, 180),
      uploadedAt: nowWib,
      uploadedBy: actor || "Admin",
      extractedCount: 0,
      extractedParams: {},
      aiNotes: null,
      analyzedAt: null
    };

    rec.images.push(item);
    rec.updatedAt = nowWib;
    this.records.set(key, rec);
    this.persist();

    return { record: JSON.parse(JSON.stringify(rec)), added: item };
  }

  public updateImageMeta(
    pmId: string,
    imageId: string,
    patch: { source?: CrosscheckSourceTag; caption?: string },
    nowWib: string
  ): PmCrosscheckRecord | null {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key);
    if (!rec) return null;
    const img = rec.images.find((i) => i.id === imageId);
    if (!img) return null;

    if (
      patch.source === "ewon" ||
      patch.source === "endpoint" ||
      patch.source === "panel_lcd" ||
      patch.source === "auto"
    ) {
      img.source = patch.source;
      if (patch.source !== "auto") {
        img.detectedSource = patch.source;
      }
    }
    if (typeof patch.caption === "string") {
      img.caption = patch.caption.trim().slice(0, 180);
    }
    rec.updatedAt = nowWib;
    this.persist();
    return JSON.parse(JSON.stringify(rec));
  }

  public deleteImage(pmId: string, imageId: string, nowWib: string): PmCrosscheckRecord | null {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key);
    if (!rec) return null;
    const idx = rec.images.findIndex((i) => i.id === imageId);
    if (idx < 0) return null;

    const [removed] = rec.images.splice(idx, 1);
    const filePath = path.join(IMAGES_ROOT_DIR, key, removed.storedFileName);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore disk cleanup warning
    }

    rec.updatedAt = nowWib;
    this.persist();
    return JSON.parse(JSON.stringify(rec));
  }

  public getImageFile(pmId: string, imageId: string): { filePath: string; mimeType: string } | null {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key);
    if (!rec) return null;
    const img = rec.images.find((i) => i.id === imageId);
    if (!img) return null;
    const filePath = path.join(IMAGES_ROOT_DIR, key, path.basename(img.storedFileName));
    if (!fs.existsSync(filePath)) return null;
    return { filePath, mimeType: img.mimeType };
  }

  public setLiveEndpointSnapshot(
    pmId: string,
    tStamp: string | null,
    rawValues: Record<string, number>,
    nowWib: string,
    meta?: {
      sourceOrigin?: CrosscheckLiveEndpointOrigin;
      sourceLabel?: string;
    }
  ): PmCrosscheckRecord {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key) ?? createEmptyRecord(key);
    const label = meta?.sourceLabel || "Endpoint Live";

    const mapped: Record<string, CrosscheckExtractedValue> = {};
    for (const [k, rawNum] of Object.entries(rawValues)) {
      if (!VALID_PARAM_KEYS.has(k)) continue;
      const spec = SPEC_BY_KEY.get(k as CrosscheckParamKey)!;
      const normalized = normalizeParamValue(spec.key, rawNum, spec.unit);
      mapped[spec.key] = {
        key: spec.key,
        value: normalized,
        unit: spec.unit,
        rawText: `${rawNum}${spec.unit ? ` ${spec.unit}` : ""}`,
        confidence: "high",
        imageId: "__live_endpoint__",
        imageName: `${label} (${tStamp || nowWib})`,
        isLiveEndpoint: true
      };
    }

    rec.liveEndpointSnapshot = {
      capturedAt: nowWib,
      tStamp,
      sourceOrigin: meta?.sourceOrigin,
      sourceLabel: label,
      values: mapped
    };
    rec.updatedAt = nowWib;
    this.records.set(key, rec);
    this.persist();
    return JSON.parse(JSON.stringify(rec));
  }

  public setToleranceMode(
    pmId: string,
    mode: CrosscheckToleranceMode,
    nowWib: string
  ): PmCrosscheckRecord {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key) ?? createEmptyRecord(key);
    rec.toleranceMode = mode === "normal" || mode === "relaxed" ? mode : "strict";
    rec.updatedAt = nowWib;
    this.records.set(key, rec);
    this.persist();
    return JSON.parse(JSON.stringify(rec));
  }

  public clearLiveEndpointSnapshot(pmId: string, nowWib: string): PmCrosscheckRecord {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key) ?? createEmptyRecord(key);
    rec.liveEndpointSnapshot = null;
    rec.updatedAt = nowWib;
    this.records.set(key, rec);
    this.persist();
    return JSON.parse(JSON.stringify(rec));
  }

  public setManualOverride(
    pmId: string,
    source: CrosscheckSource,
    paramKey: CrosscheckParamKey,
    value: number | null,
    nowWib: string
  ): PmCrosscheckRecord {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    if (!VALID_PARAM_KEYS.has(paramKey)) {
      throw new Error(`Parameter tidak dikenal: ${paramKey}`);
    }
    const spec = SPEC_BY_KEY.get(paramKey)!;
    const rec = this.records.get(key) ?? createEmptyRecord(key);
    if (!rec.manualOverrides) rec.manualOverrides = {};
    if (!rec.manualOverrides[source]) rec.manualOverrides[source] = {};

    if (value === null || !Number.isFinite(value)) {
      delete rec.manualOverrides[source]![paramKey];
    } else {
      const normalized = normalizeParamValue(paramKey, value, spec.unit);
      rec.manualOverrides[source]![paramKey] = {
        key: paramKey,
        value: normalized,
        unit: spec.unit,
        rawText: `${normalized}${spec.unit ? ` ${spec.unit}` : ""} (Edit Manual)`,
        confidence: "high",
        imageId: "__manual__",
        imageName: "Input / Koreksi Manual",
        manualOverride: true
      };
    }

    rec.updatedAt = nowWib;
    this.records.set(key, rec);
    this.persist();
    return JSON.parse(JSON.stringify(rec));
  }

  public clearPm(pmId: string): void {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key);
    if (rec) {
      const pmDir = path.join(IMAGES_ROOT_DIR, key);
      try {
        if (fs.existsSync(pmDir)) {
          fs.rmSync(pmDir, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
      this.records.delete(key);
      this.persist();
    }
  }

  /**
   * Analyzes all uploaded images (or only newly unanalyzed images unless forceReanalyze=true)
   * using Gemini 2.5 Flash Vision in chunks of GEMINI_BATCH_SIZE, merges multi-image results,
   * and returns the updated record + full 3-way comparison report.
   */
  public async analyzePmImages(
    pmId: string,
    options: { forceReanalyze?: boolean; actor: string; nowWib: string }
  ): Promise<{ record: PmCrosscheckRecord; report: PmCrosscheckReport; analyzedImageCount: number }> {
    this.ensureLoaded();
    const key = sanitizePmId(pmId);
    const rec = this.records.get(key) ?? createEmptyRecord(key);

    const targets = options.forceReanalyze
      ? rec.images
      : rec.images.filter((img) => !img.analyzedAt);

    if (targets.length === 0) {
      const report = computeCrosscheckReport(rec);
      return { record: JSON.parse(JSON.stringify(rec)), report, analyzedImageCount: 0 };
    }

    const meta = resolvePmMeta(key);
    const prepared: Array<{ img: CrosscheckImageItem; base64: string }> = [];
    for (const img of targets) {
      const filePath = path.join(IMAGES_ROOT_DIR, key, path.basename(img.storedFileName));
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      prepared.push({ img, base64: buf.toString("base64") });
    }

    const summaries: string[] = [];
    for (let i = 0; i < prepared.length; i += GEMINI_BATCH_SIZE) {
      const chunk = prepared.slice(i, i + GEMINI_BATCH_SIZE);
      const batchRes = await callGeminiVisionBatch(key, meta.name, chunk);
      if (batchRes.summary) summaries.push(batchRes.summary);

      const byImgId = new Map((batchRes.images || []).map((x) => [x.imageId, x]));
      for (const { img } of chunk) {
        const resItem = byImgId.get(img.id);
        const extracted: Record<string, CrosscheckExtractedValue> = {};

        if (resItem) {
          if (img.source === "auto") {
            const det = resItem.detectedSource;
            if (det === "ewon" || det === "endpoint" || det === "panel_lcd") {
              img.detectedSource = det;
            }
          } else {
            img.detectedSource = img.source;
          }
          img.aiNotes = typeof resItem.aiNotes === "string" ? resItem.aiNotes.slice(0, 300) : null;

          for (const p of resItem.parameters || []) {
            if (!p || !VALID_PARAM_KEYS.has(p.key)) continue;
            const num = Number(p.value);
            if (!Number.isFinite(num)) continue;
            const spec = SPEC_BY_KEY.get(p.key as CrosscheckParamKey)!;
            const normalized = normalizeParamValue(spec.key, num, p.unit);
            const conf: CrosscheckConfidence =
              p.confidence === "high" || p.confidence === "medium" || p.confidence === "low"
                ? p.confidence
                : "medium";
            extracted[spec.key] = {
              key: spec.key,
              value: normalized,
              unit: spec.unit,
              rawText: String(p.rawText || `${num}${p.unit ? ` ${p.unit}` : ""}`).slice(0, 120),
              confidence: conf,
              imageId: img.id,
              imageName: img.caption ? `${img.caption} (${img.fileName})` : img.fileName
            };
          }
        }

        img.extractedParams = extracted;
        img.extractedCount = Object.keys(extracted).length;
        img.analyzedAt = options.nowWib;
      }
    }

    rec.lastAnalyzedAt = options.nowWib;
    rec.lastAnalyzedBy = options.actor || "Admin";
    rec.aiModel = GEMINI_MODEL;
    if (summaries.length > 0) {
      rec.aiSummary = summaries.join(" ");
    }
    rec.updatedAt = options.nowWib;
    this.records.set(key, rec);
    this.persist();

    const report = computeCrosscheckReport(rec);
    return {
      record: JSON.parse(JSON.stringify(rec)),
      report,
      analyzedImageCount: prepared.length
    };
  }
}

export const pmCrosscheckStore = new PmCrosscheckLocalStore();
