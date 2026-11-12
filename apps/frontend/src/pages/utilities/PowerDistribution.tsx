import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { usePageActive } from "../../hooks/usePageActive";
import { PageHeader } from "../../components/ui/PageHeader";
import { Line, Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { useSystemStore } from "../../store/system.store";
import { getJson, postJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useAuthStore } from "../../store/auth.store";
import { canAccessConfigAndAudit } from "../../utils/roles";
import { EwPowerMetersGrid } from "../../components/electricity/EwPowerMetersGrid";
import type { ElectricPmItem } from "../../components/electricity/PmDetailModal";
import { getPmSortIndex } from "../../data/pmMapping";
import { useTranslation } from "../../i18n/useTranslation";

/* ═══════════ DETAILED COVERED DIRECTORY ═══════════ */
const COVERED_EQUIPMENT: Record<string, { group?: string; breaker: string; load: string; label: string }[]> = {
  "mdp-1.1": [
    { group: "Group 1 (MCCB 320A)", breaker: "125A", load: "Sparepart Room & Office Prod", label: "Sparepart & Office" },
    { group: "Group 1 (MCCB 320A)", breaker: "160A", load: "Warehouse-3", label: "Warehouse-3" },
    { group: "Group 1 (MCCB 320A)", breaker: "40A", load: "Penerangan Steril-1", label: "Penerangan Steril-1" },
    { group: "Group 1 (MCCB 320A)", breaker: "50A", load: "Penerangan Security", label: "Penerangan Security" },
    { group: "Group 1 (MCCB 320A)", breaker: "32A", load: "Penerangan WT", label: "Penerangan WT" },
    { group: "Group 1 (MCCB 320A)", breaker: "160A", load: "Penerangan Utility", label: "Penerangan Utility" },
    { group: "Group 2 (MCCB 400A)", breaker: "100A", load: "HVAC IP Unit-2", label: "HVAC IP Unit-2" },
    { group: "Group 2 (MCCB 400A)", breaker: "225A", load: "Cooling-1", label: "Cooling-1" },
    { group: "Group 2 (MCCB 400A)", breaker: "40A", load: "Steril-1 Penerangan", label: "Steril-1 Penerangan" },
    { group: "Group 2 (MCCB 400A)", breaker: "45A", load: "Boiler-1", label: "Boiler-1" },
    { group: "Group 2 (MCCB 400A)", breaker: "225A", load: "Compressor Unit-1 (Mitsui)", label: "Compressor Unit-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "160A", load: "Workshop", label: "Workshop" },
    { group: "Group 3 (MCCB 250A)", breaker: "60A", load: "IP-1", label: "IP-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "40A", load: "Warehouse-2", label: "Warehouse-2" },
    { group: "Group 3 (MCCB 250A)", breaker: "45A", load: "Crusher", label: "Crusher" },
    { group: "Group 3 (MCCB 250A)", breaker: "40A", load: "Preparation-1", label: "Preparation-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "63A", load: "WT-1", label: "WT-1" },
    { group: "Group 3 (MCCB 250A)", breaker: "80A", load: "Steril-2 Mesin", label: "Steril-2 Mesin" },
    { group: "Group 4 (MCCB 800A)", breaker: "250A", load: "Chiller Daikin-Timur", label: "Chiller Daikin-Timur" },
    { group: "Group 4 (MCCB 800A)", breaker: "250A", load: "Deep Well", label: "Deep Well" },
    { group: "Group 4 (MCCB 800A)", breaker: "250A", load: "Compressor Unit-3", label: "Compressor Unit-3" }
  ],
  "mdp-1.2": [
    { breaker: "250A", load: "Chiller Daikin", label: "Chiller Daikin" },
    { breaker: "160A", load: "HVAC Warehouse-3", label: "HVAC Warehouse-3" },
    { breaker: "63A", load: "DU & WT", label: "DU & WT" },
    { breaker: "100A", load: "Mini Lab & R.Server MIS", label: "Mini Lab & Server" },
    { breaker: "200A", load: "Chiller Unit-1", label: "Chiller Unit-1" },
    { breaker: "250A", load: "BP Unit-1", label: "BP Unit-1" },
    { breaker: "250A", load: "HVAC Unit-1", label: "HVAC Unit-1" }
  ],
  "mdp-2": [
    { breaker: "400A", load: "Chiller Trane", label: "Chiller Trane" },
    { breaker: "20A", load: "Material Storage Unit-2", label: "Material Storage" },
    { breaker: "75A", load: "Corridor & R. SPV Unit-2", label: "Corridor & SPV Room" },
    { breaker: "100A", load: "P. Penerangan Depan Laundry", label: "Penerangan Laundry" },
    { breaker: "50A", load: "P. Preparation Unit-2", label: "P. Preparation Unit-2" },
    { breaker: "100A", load: "P. WT Unit-2", label: "P. WT Unit-2" },
    { breaker: "75A", load: "P. IP Unit-2", label: "P. IP Unit-2" },
    { breaker: "100A", load: "Spare Feeder", label: "Spare" },
    { breaker: "50A", load: "P. Warehouse-1", label: "P. Warehouse-1" },
    { breaker: "500A", load: "P. Cooling Unit-2", label: "P. Cooling Unit-2" },
    { breaker: "300A", load: "P. HVAC Mezanine Unit-2", label: "P. HVAC Mezanine" },
    { breaker: "600A", load: "P. Chiller HVAC Unit-2", label: "P. Chiller HVAC" },
    { breaker: "600A", load: "P. Capacitor Bank", label: "Capacitor Bank" },
    { breaker: "75A", load: "Steril Unit-2", label: "Steril Unit-2" },
    { breaker: "40A", load: "Corridor Unit-2", label: "Corridor Unit-2" },
    { breaker: "20A", load: "Penerangan Warehouse-2", label: "Penerangan WH-2" },
    { breaker: "50A", load: "Charger Battery Genset Fact-1", label: "Charger Battery Genset" },
    { breaker: "50A", load: "P. Warehouse-4", label: "P. Warehouse-4" },
    { breaker: "400A", load: "BP-3 & BP-4", label: "BP-3 & BP-4" },
    { breaker: "225A", load: "Compressor Unit-2", label: "Compressor Unit-2" },
    { breaker: "630A", load: "Cooling Unit-3", label: "Cooling Unit-3" }
  ],
  "mdp-3": [
    { breaker: "400A", load: "Office & Lab QC", label: "Office & Lab QC" },
    { breaker: "80A", load: "P. Preparation Unit-3", label: "P. Preparation Unit-3" },
    { breaker: "100A", load: "P. WT Unit-3", label: "P. WT Unit-3" },
    { breaker: "50A", load: "P. IP Unit-3", label: "P. IP Unit-3" },
    { breaker: "125A", load: "P. Steril Unit-3", label: "P. Steril Unit-3" },
    { breaker: "200A", load: "P. Boiler & Compressor", label: "P. Boiler & Compressor" },
    { breaker: "630A", load: "P. HVAC Unit-3", label: "P. HVAC Unit-3" },
    { breaker: "250A", load: "P. BP-5", label: "P. BP-5" },
    { breaker: "250A", load: "P. BP-6", label: "P. BP-6" },
    { breaker: "80A", load: "P. Boiler", label: "P. Boiler" },
    { breaker: "40A", load: "Material Warehouse-2", label: "Material Warehouse-2" },
    { breaker: "40A", load: "Penerangan IP-3", label: "Penerangan IP-3" }
  ],
  "putr-1": [
    { breaker: "400A", load: "MCC Water Treatment", label: "MCC Water Treatment" },
    { breaker: "250A", load: "Panel Preparation", label: "Panel Preparation" },
    { breaker: "300A", load: "Panel Produk Palletizing", label: "Panel Produk Palletizing" },
    { breaker: "160A", load: "Panel Weighing", label: "Panel Weighing" },
    { breaker: "100A", load: "Panel Laundry", label: "Panel Laundry" },
    { breaker: "200A", load: "Panel Mesin", label: "Panel Mesin" },
    { breaker: "250A", load: "Panel Bottle", label: "Panel Bottle" }
  ],
  "putr-2": [
    { breaker: "600A", load: "Panel Chiller / Panel Chiller ELV +6.60", label: "Panel Chiller" },
    { breaker: "160A", load: "Panel Lighting Area 1", label: "Panel Lighting Area 1" },
    { breaker: "160A", load: "Panel Lighting Area 2", label: "Panel Lighting Area 2" },
    { breaker: "400A", load: "Area Utility Feeder", label: "Area Utility" },
    { breaker: "250A", load: "Panel Main Critical", label: "Panel Main Critical" }
  ],
  "putr-new": [
    { breaker: "200A", load: "AC WHO & New Crusher", label: "AC WHO & New Crusher" },
    { breaker: "100A", load: "Spare 1", label: "Spare 1" },
    { breaker: "100A", load: "Spare 2", label: "Spare 2" },
    { breaker: "100A", load: "Spare 3", label: "Spare 3" },
    { breaker: "100A", load: "Spare 4", label: "Spare 4" }
  ]
};

/* ═══════════ TYPES & STRUCTS ═══════════ */
type TransformerData = {
  id: string;
  name: string;
  factory: 1 | 2;
  capacityKva: number;
  activePowerKw: number | null;
  reactivePowerKvar: number | null;
  apparentPowerKva: number | null;
  powerFactor: number | null;
  frequencyHz: number | null;
  tempCc: number | null;
  voltageInKv: number | null;
  voltageOutL2L: number | null;
  voltageOutL2N: number | null;
  voltAb?: number | null;
  voltBc?: number | null;
  voltCa?: number | null;
  currentR: number | null;
  currentS: number | null;
  currentT: number | null;
  thdVoltage: number | null;
  thdCurrent: number | null;
  thdVoltA?: number | null;
  thdVoltB?: number | null;
  thdVoltC?: number | null;
  thdCurrentA?: number | null;
  thdCurrentB?: number | null;
  thdCurrentC?: number | null;
  voltageUnbalance?: number | null;
  currentUnbalance?: number | null;
  kwh: number | null;
  status: "online" | "warning" | "offline";
  vectorGroup?: string;
  impedance?: number;
  year?: string;
  manufacturer?: string;
};

const TRAFO_PM_MAP: Record<string, { pmId: string; group: string; name: string; factory: 1 | 2; capacityKva: number }> = {
  "mdp-1.1": { pmId: "PM139", group: "ew21", name: "MDP-1.1", factory: 1, capacityKva: 630 },
  "mdp-1.2": { pmId: "PM136", group: "ew21", name: "MDP-1.2", factory: 1, capacityKva: 630 },
  "mdp-2":   { pmId: "PM135", group: "ew21", name: "MDP-2",   factory: 1, capacityKva: 1000 },
  "mdp-3":   { pmId: "PM133", group: "ew21", name: "MDP-3",   factory: 1, capacityKva: 1000 },
  "putr-1":  { pmId: "PM201", group: "ew22", name: "PUTR-1",  factory: 2, capacityKva: 2000 },
  "putr-2":  { pmId: "PM202", group: "ew22", name: "PUTR-2",  factory: 2, capacityKva: 2000 },
  "putr-new":{ pmId: "PM327", group: "ew23", name: "PUTR-New", factory: 2, capacityKva: 1600 },
};

const NO_REALTIME_API = "API Realtime Belum Tersedia";

const decodePf = (val: number | null | undefined): number | null => {
  if (val === null || val === undefined || isNaN(Number(val))) return null;
  let pf = Number(val);
  if (Math.abs(pf) > 2.0) return null;
  if (pf > 1.0 && pf <= 2.0) pf = 2.0 - pf;
  else if (pf < -1.0 && pf >= -2.0) pf = -2.0 - pf;
  pf = Math.abs(pf);
  if (pf > 1.0) pf = 1.0;
  return Number(pf.toFixed(3));
};


function mapPmToTransformer(
  initialTx: TransformerData,
  pm?: ElectricPmItem,
  incomingVolts?: { wf1Volt: number | null; wf2Volt: number | null }
): TransformerData {
  if (!pm) return initialTx;

  const activePowerKw = pm.active_power_total !== null && pm.active_power_total !== undefined
    ? Number(Number(pm.active_power_total).toFixed(1))
    : null;
  const reactivePowerKvar = pm.reactive_power_total !== null && pm.reactive_power_total !== undefined
    ? Number(Number(pm.reactive_power_total).toFixed(1))
    : null;
  const apparentPowerKva = pm.apparent_power_total !== null && pm.apparent_power_total !== undefined
    ? Number(Number(pm.apparent_power_total).toFixed(1))
    : null;

  const powerFactor = pm.power_factor !== null && pm.power_factor !== undefined
    ? Number(pm.power_factor)
    : null;

  const frequencyHz = pm.frequency !== null && pm.frequency !== undefined
    ? Number(Number(pm.frequency).toFixed(2))
    : null;

  const vAb = pm.volt_ab !== null && pm.volt_ab !== undefined ? Number(pm.volt_ab) : null;
  const vBc = pm.volt_bc !== null && pm.volt_bc !== undefined ? Number(pm.volt_bc) : null;
  const vCa = pm.volt_ca !== null && pm.volt_ca !== undefined ? Number(pm.volt_ca) : null;

  const voltageOutL2L = pm.volt_ll !== null && pm.volt_ll !== undefined
    ? Number(Number(pm.volt_ll).toFixed(1))
    : null;

  const voltageOutL2N = pm.volt_ln !== null && pm.volt_ln !== undefined
    ? Number(Number(pm.volt_ln).toFixed(1))
    : null;

  const currentR = pm.current_a !== null && pm.current_a !== undefined ? Number(Number(pm.current_a).toFixed(1)) : null;
  const currentS = pm.current_b !== null && pm.current_b !== undefined ? Number(Number(pm.current_b).toFixed(1)) : null;
  const currentT = pm.current_c !== null && pm.current_c !== undefined ? Number(Number(pm.current_c).toFixed(1)) : null;

  const thdVa = pm.thd_volt_a !== null && pm.thd_volt_a !== undefined ? Number(pm.thd_volt_a) : null;
  const thdVb = pm.thd_volt_b !== null && pm.thd_volt_b !== undefined ? Number(pm.thd_volt_b) : null;
  const thdVc = pm.thd_volt_c !== null && pm.thd_volt_c !== undefined ? Number(pm.thd_volt_c) : null;

  const thdIa = pm.thd_current_a !== null && pm.thd_current_a !== undefined ? Number(pm.thd_current_a) : null;
  const thdIb = pm.thd_current_b !== null && pm.thd_current_b !== undefined ? Number(pm.thd_current_b) : null;
  const thdIc = pm.thd_current_c !== null && pm.thd_current_c !== undefined ? Number(pm.thd_current_c) : null;

  const vUnb = pm.voltage_unbalance !== null && pm.voltage_unbalance !== undefined ? Number(pm.voltage_unbalance) : null;
  const iUnb = pm.current_unbalance !== null && pm.current_unbalance !== undefined ? Number(pm.current_unbalance) : null;

  const kwh = pm.active_energy !== null && pm.active_energy !== undefined ? Number(Number(pm.active_energy).toFixed(0)) : null;
  const isOnline = pm.status !== null && pm.status !== undefined
    ? Boolean(pm.status)
    : ((activePowerKw !== null && activePowerKw !== undefined) || (vAb !== null && vAb > 100));

  return {
    ...initialTx,
    activePowerKw,
    reactivePowerKvar,
    apparentPowerKva,
    powerFactor,
    frequencyHz,
    voltageInKv: initialTx.factory === 1 ? (incomingVolts?.wf1Volt ?? initialTx.voltageInKv) : (incomingVolts?.wf2Volt ?? initialTx.voltageInKv),
    voltageOutL2L,
    voltageOutL2N,
    voltAb: vAb,
    voltBc: vBc,
    voltCa: vCa,
    currentR,
    currentS,
    currentT,
    thdVoltage: null,
    thdCurrent: null,
    thdVoltA: thdVa,
    thdVoltB: thdVb,
    thdVoltC: thdVc,
    thdCurrentA: thdIa,
    thdCurrentB: thdIb,
    thdCurrentC: thdIc,
    voltageUnbalance: vUnb,
    currentUnbalance: iUnb,
    tempCc: null,
    kwh,
    status: isOnline ? "online" : "offline",
  };
}

/* ═══════════ INITIAL TRANSFORMER DATA (EMPTY TELEMETRY) ═══════════ */
const INITIAL_TRANSFORMERS: TransformerData[] = [
  // Factory 1
  {
    id: "mdp-1.1", name: "MDP-1.1", factory: 1, capacityKva: 630, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "mdp-1.2", name: "MDP-1.2", factory: 1, capacityKva: 630, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "mdp-2", name: "MDP-2", factory: 1, capacityKva: 1000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "mdp-3", name: "MDP-3", factory: 1, capacityKva: 1000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  // Factory 2
  {
    id: "putr-1", name: "PUTR-1", factory: 2, capacityKva: 2000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "putr-2", name: "PUTR-2", factory: 2, capacityKva: 2000, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  },
  {
    id: "putr-new", name: "PUTR-New", factory: 2, capacityKva: 1600, activePowerKw: null, reactivePowerKvar: null,
    apparentPowerKva: null, powerFactor: null, frequencyHz: null, tempCc: null, voltageInKv: null,
    voltageOutL2L: null, voltageOutL2N: null, currentR: null, currentS: null, currentT: null,
    thdVoltage: null, thdCurrent: null, kwh: null, status: "offline"
  }
];

const TARIF_PER_KWH = 1114.74; // Industrial I-3 tariff in IDR

const formatCurrencyIDR = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);

/* ═══════════ TRADINGVIEW-STYLE INTERACTIVE CHART (ZOOM & 2D FREEVIEW) ═══════════ */
const TV_PRESETS: { key: string; label: string; spanMs: number }[] = [
  { key: "1m", label: "1M", spanMs: 60 * 1000 },
  { key: "5m", label: "5M", spanMs: 5 * 60 * 1000 },
  { key: "15m", label: "15M", spanMs: 15 * 60 * 1000 },
  { key: "1h", label: "1J", spanMs: 60 * 60 * 1000 },
  { key: "6h", label: "6J", spanMs: 6 * 3600 * 1000 },
  { key: "24h", label: "24J", spanMs: 24 * 3600 * 1000 },
];

type TradingViewChartProps = {
  data: {
    datasets: {
      label: string;
      data: { x: number; y: number }[];
      borderColor: string;
      backgroundColor: string;
      borderWidth?: number;
      tension?: number;
      fill?: boolean;
      pointRadius?: number;
      pointHoverRadius?: number;
    }[];
  };
  options: any;
  defaultRange: { min: number; max: number };
  isDark: boolean;
  resetKey?: string;
};

function TradingViewChart({ data, options, defaultRange, isDark, resetKey }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const defaultRangeRef = useRef(defaultRange);
  defaultRangeRef.current = defaultRange;

  const viewRef = useRef<{
    isFreeview: boolean;
    liveSpanMs: number;
    minX: number;
    maxX: number;
    yLocked: boolean;
    minY: number | undefined;
    maxY: number | undefined;
  }>({
    isFreeview: false,
    liveSpanMs: 24 * 3600 * 1000,
    minX: defaultRange.min,
    maxX: defaultRange.max,
    yLocked: false,
    minY: undefined,
    maxY: undefined,
  });

  const crosshairRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const [uiState, setUiState] = useState<{
    isFreeview: boolean;
    yLocked: boolean;
    activePreset: string;
    spanMs: number;
  }>({
    isFreeview: false,
    yLocked: false,
    activePreset: "24h",
    spanMs: 24 * 3600 * 1000,
  });

  const computeAutoY = useCallback((minX: number, maxX: number): { min: number; max: number } | undefined => {
    const datasets = dataRef.current?.datasets || [];
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let d = 0; d < datasets.length; d++) {
      const pts = datasets[d]?.data;
      if (!Array.isArray(pts)) continue;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (!pt || pt.x < minX || pt.x > maxX) continue;
        const y = Number(pt.y);
        if (!Number.isFinite(y)) continue;
        if (y < minVal) minVal = y;
        if (y > maxVal) maxVal = y;
      }
    }
    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) return undefined;
    const span = maxVal - minVal;
    const pad = span > 0.5 ? span * 0.15 : Math.max(Math.abs(maxVal) * 0.02, 1);
    const computedMin = minVal >= 0 ? Math.max(0, Number((minVal - pad).toFixed(2))) : Number((minVal - pad).toFixed(2));
    const computedMax = Number((maxVal + pad).toFixed(2));
    return { min: computedMin, max: computedMax > computedMin ? computedMax : computedMin + 1 };
  }, []);

  const syncChartInstance = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !chart.options?.scales) return;
    const v = viewRef.current;
    chart.options.scales.x.min = v.minX;
    chart.options.scales.x.max = v.maxX;
    if (v.yLocked && v.minY !== undefined && v.maxY !== undefined) {
      chart.options.scales.y.min = v.minY;
      chart.options.scales.y.max = v.maxY;
    } else {
      const autoY = computeAutoY(v.minX, v.maxX);
      v.minY = autoY?.min;
      v.maxY = autoY?.max;
      chart.options.scales.y.min = autoY?.min;
      chart.options.scales.y.max = autoY?.max;
    }
    const spanX = v.maxX - v.minX;
    const dynamicRadius = spanX <= 2 * 60 * 1000 ? 2.5 : spanX <= 10 * 60 * 1000 ? 1.5 : 0;
    if (Array.isArray(chart.data?.datasets)) {
      chart.data.datasets.forEach((ds: any) => {
        ds.pointRadius = dynamicRadius;
      });
    }
    chart.update("none");
  }, [computeAutoY]);

  // Reset view when switching transformer or tab
  useEffect(() => {
    const dr = defaultRangeRef.current;
    viewRef.current = {
      isFreeview: false,
      liveSpanMs: 24 * 3600 * 1000,
      minX: dr.min,
      maxX: dr.max,
      yLocked: false,
      minY: undefined,
      maxY: undefined,
    };
    setUiState({
      isFreeview: false,
      yLocked: false,
      activePreset: "24h",
      spanMs: 24 * 3600 * 1000,
    });
  }, [resetKey]);

  // Keep live window rolling when NOT in freeview mode
  if (!viewRef.current.isFreeview) {
    viewRef.current.maxX = defaultRange.max;
    viewRef.current.minX = Math.max(defaultRange.min, defaultRange.max - viewRef.current.liveSpanMs);
    if (!viewRef.current.yLocked) {
      const autoY = computeAutoY(viewRef.current.minX, viewRef.current.maxX);
      viewRef.current.minY = autoY?.min;
      viewRef.current.maxY = autoY?.max;
    }
  } else if (!viewRef.current.yLocked) {
    const autoY = computeAutoY(viewRef.current.minX, viewRef.current.maxX);
    viewRef.current.minY = autoY?.min;
    viewRef.current.maxY = autoY?.max;
  }

  const handleResetLive = useCallback(() => {
    const dr = defaultRangeRef.current;
    viewRef.current = {
      isFreeview: false,
      liveSpanMs: 24 * 3600 * 1000,
      minX: dr.min,
      maxX: dr.max,
      yLocked: false,
      minY: undefined,
      maxY: undefined,
    };
    setUiState({
      isFreeview: false,
      yLocked: false,
      activePreset: "24h",
      spanMs: 24 * 3600 * 1000,
    });
    syncChartInstance();
  }, [syncChartInstance]);

  const handleSelectPreset = useCallback((presetKey: string, spanMs: number) => {
    const dr = defaultRangeRef.current;
    viewRef.current.isFreeview = false;
    viewRef.current.liveSpanMs = spanMs;
    viewRef.current.maxX = dr.max;
    viewRef.current.minX = Math.max(dr.min, dr.max - spanMs);
    viewRef.current.yLocked = false;
    setUiState({
      isFreeview: false,
      yLocked: false,
      activePreset: presetKey,
      spanMs,
    });
    syncChartInstance();
  }, [syncChartInstance]);

  const handleStepZoom = useCallback((factor: number) => {
    const v = viewRef.current;
    const dr = defaultRangeRef.current;
    const curSpan = Math.max(15000, v.maxX - v.minX);
    const newSpan = Math.max(15000, Math.min(24 * 3600 * 1000, curSpan * factor));
    const center = (v.minX + v.maxX) / 2;
    let newMinX = center - newSpan / 2;
    let newMaxX = center + newSpan / 2;
    if (newMaxX > dr.max + newSpan * 0.05) {
      newMaxX = dr.max + newSpan * 0.05;
      newMinX = newMaxX - newSpan;
    }
    if (newMinX < dr.min - newSpan * 0.05) {
      newMinX = dr.min - newSpan * 0.05;
      newMaxX = newMinX + newSpan;
    }
    v.isFreeview = true;
    v.minX = newMinX;
    v.maxX = newMaxX;
    setUiState((prev) => ({
      ...prev,
      isFreeview: true,
      activePreset: "custom",
      spanMs: newSpan,
    }));
    syncChartInstance();
  }, [syncChartInstance]);

  const handleToggleAutoY = useCallback(() => {
    const v = viewRef.current;
    v.yLocked = false;
    setUiState((prev) => ({ ...prev, yLocked: false }));
    syncChartInstance();
  }, [syncChartInstance]);

  // Native non-passive Wheel Zoom + Mouse/Touch 2D Freeview Drag
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const chart = chartRef.current;
      if (!chart || !chart.chartArea) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = chart.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const area = chart.chartArea;
      const v = viewRef.current;
      const dr = defaultRangeRef.current;

      const isOverYAxis = mouseX < area.left;
      const zoomFactor = e.deltaY < 0 ? 0.80 : 1.25;

      if (isOverYAxis || e.altKey) {
        // Zoom Y-axis around cursor Y
        const curMinY = chart.scales.y.min;
        const curMaxY = chart.scales.y.max;
        const spanY = Math.max(0.1, curMaxY - curMinY);
        const ratioY = 1 - Math.max(0, Math.min(1, (mouseY - area.top) / Math.max(1, area.bottom - area.top)));
        const anchorY = curMinY + ratioY * spanY;
        const newSpanY = Math.max(0.2, Math.min(100000, spanY * zoomFactor));
        v.yLocked = true;
        v.isFreeview = true;
        v.minY = Number((anchorY - ratioY * newSpanY).toFixed(2));
        v.maxY = Number((v.minY + newSpanY).toFixed(2));
        setUiState((prev) => ({ ...prev, isFreeview: true, yLocked: true }));
        syncChartInstance();
        return;
      }

      // Zoom X-axis anchored at mouse cursor X (TradingView style)
      const ratioX = Math.max(0, Math.min(1, (mouseX - area.left) / Math.max(1, area.right - area.left)));
      const curSpanX = Math.max(15000, v.maxX - v.minX);
      const anchorX = v.minX + ratioX * curSpanX;
      const newSpanX = Math.max(15000, Math.min(24 * 3600 * 1000, curSpanX * zoomFactor));

      let newMinX = anchorX - ratioX * newSpanX;
      let newMaxX = newMinX + newSpanX;

      const maxBound = dr.max + newSpanX * 0.08;
      const minBound = dr.min - newSpanX * 0.08;
      if (newMaxX > maxBound) {
        newMaxX = maxBound;
        newMinX = newMaxX - newSpanX;
      }
      if (newMinX < minBound) {
        newMinX = minBound;
        newMaxX = newMinX + newSpanX;
      }

      v.isFreeview = true;
      v.minX = newMinX;
      v.maxX = newMaxX;

      // If Shift or Ctrl is held, also zoom Y-axis around cursor Y
      if (e.shiftKey || e.ctrlKey) {
        const curMinY = chart.scales.y.min;
        const curMaxY = chart.scales.y.max;
        const spanY = Math.max(0.1, curMaxY - curMinY);
        const ratioY = 1 - Math.max(0, Math.min(1, (mouseY - area.top) / Math.max(1, area.bottom - area.top)));
        const anchorY = curMinY + ratioY * spanY;
        const newSpanY = Math.max(0.2, Math.min(100000, spanY * zoomFactor));
        v.yLocked = true;
        v.minY = Number((anchorY - ratioY * newSpanY).toFixed(2));
        v.maxY = Number((v.minY + newSpanY).toFixed(2));
      }

      setUiState({
        isFreeview: true,
        yLocked: v.yLocked,
        activePreset: "custom",
        spanMs: newSpanX,
      });
      syncChartInstance();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [syncChartInstance]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const chart = chartRef.current;
    if (!chart || !chart.chartArea) return;

    const rect = chart.canvas.getBoundingClientRect();
    const startMouseX = e.clientX - rect.left;
    const startMouseY = e.clientY - rect.top;
    const area = chart.chartArea;
    const v = viewRef.current;
    const dr = defaultRangeRef.current;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startMinX = v.minX;
    const startMaxX = v.maxX;
    const startSpanX = Math.max(15000, startMaxX - startMinX);
    const startMinY = Number.isFinite(chart.scales.y?.min) ? chart.scales.y.min : (v.minY ?? 0);
    const startMaxY = Number.isFinite(chart.scales.y?.max) ? chart.scales.y.max : (v.maxY ?? 100);
    const startSpanY = Math.max(0.1, startMaxY - startMinY);

    const dragMode: "pan" | "scaleY" | "scaleX" =
      startMouseX < area.left ? "scaleY" : startMouseY > area.bottom ? "scaleX" : "pan";

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

      const plotW = Math.max(1, area.right - area.left);
      const plotH = Math.max(1, area.bottom - area.top);

      if (dragMode === "scaleY") {
        const scaleFactor = Math.max(0.2, Math.min(5, 1 + (dy / plotH) * 1.5));
        const centerY = (startMinY + startMaxY) / 2;
        const newSpanY = Math.max(0.2, startSpanY * scaleFactor);
        v.isFreeview = true;
        v.yLocked = true;
        v.minY = Number((centerY - newSpanY / 2).toFixed(2));
        v.maxY = Number((centerY + newSpanY / 2).toFixed(2));
        setUiState((prev) => ({ ...prev, isFreeview: true, yLocked: true }));
        syncChartInstance();
        return;
      }

      if (dragMode === "scaleX") {
        const scaleFactor = Math.max(0.2, Math.min(5, 1 - (dx / plotW) * 1.5));
        const newSpanX = Math.max(15000, Math.min(24 * 3600 * 1000, startSpanX * scaleFactor));
        v.isFreeview = true;
        v.minX = startMaxX - newSpanX;
        v.maxX = startMaxX;
        setUiState((prev) => ({ ...prev, isFreeview: true, activePreset: "custom", spanMs: newSpanX }));
        syncChartInstance();
        return;
      }

      // 2D Freeview Pan (Horizontal X + Vertical Y)
      const timeDelta = -(dx / plotW) * startSpanX;
      let newMinX = startMinX + timeDelta;
      let newMaxX = startMaxX + timeDelta;

      const maxBound = dr.max + startSpanX * 0.25;
      const minBound = dr.min - startSpanX * 0.25;
      if (newMaxX > maxBound) {
        newMaxX = maxBound;
        newMinX = newMaxX - startSpanX;
      }
      if (newMinX < minBound) {
        newMinX = minBound;
        newMaxX = newMinX + startSpanX;
      }

      v.isFreeview = true;
      v.minX = newMinX;
      v.maxX = newMaxX;

      if (Math.abs(dy) > 4 || v.yLocked) {
        const valDelta = (dy / plotH) * startSpanY;
        v.yLocked = true;
        v.minY = Number((startMinY + valDelta).toFixed(2));
        v.maxY = Number((startMaxY + valDelta).toFixed(2));
      }

      setUiState((prev) => ({
        ...prev,
        isFreeview: true,
        yLocked: v.yLocked,
        activePreset: "custom",
        spanMs: startSpanX,
      }));
      syncChartInstance();
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [syncChartInstance]);

  const handleMouseMoveCrosshair = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const chart = chartRef.current;
    if (!chart || !chart.chartArea) return;
    const rect = chart.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const area = chart.chartArea;
    if (x >= area.left && x <= area.right && y >= area.top && y <= area.bottom) {
      crosshairRef.current = { x, y, active: true };
    } else {
      crosshairRef.current.active = false;
    }
  }, []);

  const handleMouseLeaveCrosshair = useCallback(() => {
    crosshairRef.current.active = false;
    if (chartRef.current) chartRef.current.draw();
  }, []);

  const crosshairPlugin = useMemo(() => ({
    id: "tvCrosshair",
    afterDraw: (chart: any) => {
      const ch = crosshairRef.current;
      if (!ch.active || !chart.chartArea) return;
      const { ctx, chartArea: area, scales } = chart;
      if (ch.x < area.left || ch.x > area.right || ch.y < area.top || ch.y > area.bottom) return;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? "rgba(148, 163, 184, 0.45)" : "rgba(71, 85, 105, 0.45)";

      // Vertical line
      ctx.moveTo(ch.x, area.top);
      ctx.lineTo(ch.x, area.bottom);
      // Horizontal line
      ctx.moveTo(area.left, ch.y);
      ctx.lineTo(area.right, ch.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis value pill on left
      if (scales?.y) {
        const yVal = scales.y.getValueForPixel(ch.y);
        if (Number.isFinite(yVal)) {
          const label = Number(yVal).toFixed(1);
          ctx.font = "bold 9px monospace";
          const tw = ctx.measureText(label).width + 8;
          const th = 15;
          const bx = Math.max(0, area.left - tw - 2);
          const by = Math.max(area.top, Math.min(area.bottom - th, ch.y - th / 2));
          ctx.fillStyle = isDark ? "#0284c7" : "#0369a1";
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, th, 3);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, bx + tw / 2, by + th / 2);
        }
      }
      ctx.restore();
    }
  }), [isDark]);

  const mergedOptions = useMemo(() => {
    const v = viewRef.current;
    return {
      ...options,
      scales: {
        ...options.scales,
        x: {
          ...options.scales?.x,
          min: v.minX,
          max: v.maxX,
        },
        y: {
          ...options.scales?.y,
          min: v.minY,
          max: v.maxY,
        },
      },
    };
  }, [options, defaultRange, uiState]);

  const formatSpanLabel = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${(ms / 3600000).toFixed(ms % 3600000 === 0 ? 0 : 1)}h`;
  };

  return (
    <div className="w-full h-full flex flex-col select-none">
      {/* TradingView Compact Toolbar */}
      <div className="flex items-center justify-between gap-1.5 pb-1.5 flex-wrap shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          <div className="inline-flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-md border border-slate-300/60 dark:border-slate-700/70">
            {TV_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleSelectPreset(p.key, p.spanMs)}
                className={`px-1.5 py-0.5 text-[9px] font-extrabold font-mono rounded transition-all cursor-pointer ${
                  !uiState.isFreeview && uiState.activePreset === p.key
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
                title={`Tampilkan rentang ${p.label} terakhir (Live)`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-0.5 bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-md border border-slate-300/60 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => handleStepZoom(0.75)}
              className="px-1.5 py-0.5 text-[10px] font-extrabold font-mono text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition cursor-pointer"
              title="Zoom In (Atau Scroll Roda Mouse ke Atas)"
            >
              ＋
            </button>
            <button
              type="button"
              onClick={() => handleStepZoom(1.35)}
              className="px-1.5 py-0.5 text-[10px] font-extrabold font-mono text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition cursor-pointer"
              title="Zoom Out (Atau Scroll Roda Mouse ke Bawah)"
            >
              －
            </button>
          </div>

          {uiState.yLocked && (
            <button
              type="button"
              onClick={handleToggleAutoY}
              className="px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 transition cursor-pointer"
              title="Kembalikan skala sumbu Y ke Auto-Fit"
            >
              Auto Y
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-[9px] text-slate-400 dark:text-slate-500 font-medium">
            Scroll: Zoom • Drag: Freeview • 2x Klik: Reset
          </span>
          {uiState.isFreeview || uiState.activePreset !== "24h" || uiState.yLocked ? (
            <button
              type="button"
              onClick={handleResetLive}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition cursor-pointer"
              title="Kembalikan ke tampilan Live 24 Jam"
            >
              <span>✋ Freeview ({formatSpanLabel(uiState.spanMs)})</span>
              <span className="underline ml-0.5">⟳ Reset Live</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live 24J
            </span>
          )}
        </div>
      </div>

      {/* Interactive Chart Canvas Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveCrosshair}
        onMouseLeave={handleMouseLeaveCrosshair}
        onDoubleClick={handleResetLive}
        className="relative flex-1 min-h-0 w-full cursor-grab active:cursor-grabbing"
      >
        <Line ref={chartRef} data={data} options={mergedOptions} plugins={[crosshairPlugin]} />
      </div>
    </div>
  );
}

/* ═══════════ DETAILED HISTORICAL MODAL ═══════════ */
type ModalProps = {
  transformer: TransformerData & { vectorGroup: string; impedance: number; year: string; manufacturer: string };
  onClose: () => void;
  isDark: boolean;
  coverageList: { group?: string; breaker: string; load: string; label: string }[];
  onSaveSpecs: (specs: any) => void;
  onSaveCoverage: (items: any[]) => void;
};

function DetailRecordModal({ transformer, onClose, isDark, coverageList, onSaveSpecs, onSaveCoverage }: ModalProps) {
  const [activeTab, setActiveTab] = useState<"voltage" | "ampere" | "power">("voltage");
  const [rightTab, setRightTab] = useState<"specs" | "coverage">("specs");

  // Specs form state
  const [specForm, setSpecForm] = useState({
    capacityKva: transformer.capacityKva,
    vectorGroup: transformer.vectorGroup,
    impedance: transformer.impedance,
    year: transformer.year,
    manufacturer: transformer.manufacturer,
  });

  // Coverage items local state
  const [coverages, setCoverages] = useState(coverageList);

  // New coverage form state
  const [newGroup, setNewGroup] = useState("");
  const [newBreaker, setNewBreaker] = useState("");
  const [newLoad, setNewLoad] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const tabs = [
    { key: "voltage" as const, label: "Voltage Record" },
    { key: "ampere" as const, label: "Ampere Record (3 Fasa R, S, T)" },
    { key: "power" as const, label: "kW Total (Daya Aktif)" },
  ];

  const handleSaveSpecsClick = () => {
    onSaveSpecs(specForm);
    alert("Transformer Specifications saved successfully!");
  };

  const handleAddCoverage = () => {
    if (!newLoad.trim() || !newBreaker.trim()) {
      alert("Load name and Breaker MCCB rating are required.");
      return;
    }
    const newItem = {
      group: newGroup.trim() || undefined,
      breaker: newBreaker.trim(),
      load: newLoad.trim(),
      label: newLabel.trim() || newLoad.trim(),
    };
    const updated = [...coverages, newItem];
    setCoverages(updated);
    onSaveCoverage(updated);
    // Reset inputs
    setNewGroup("");
    setNewBreaker("");
    setNewLoad("");
    setNewLabel("");
  };

  const handleDeleteCoverage = (idxToDelete: number) => {
    const updated = coverages.filter((_, idx) => idx !== idxToDelete);
    setCoverages(updated);
    onSaveCoverage(updated);
  };

  const [modalPointCount, setModalPointCount] = useState(0);
  const [modalTickMs, setModalTickMs] = useState<number>(() => Math.floor(Date.now() / 1000) * 1000);
  const [loadingModalHistory, setLoadingModalHistory] = useState(true);
  const [modalVoltageType, setModalVoltageType] = useState<"380v" | "230v">("380v");

  const modalSeriesRef = useRef<{
    vAb: { x: number; y: number }[];
    vBc: { x: number; y: number }[];
    vCa: { x: number; y: number }[];
    vRn: { x: number; y: number }[];
    vSn: { x: number; y: number }[];
    vTn: { x: number; y: number }[];
    kw: { x: number; y: number }[];
    iTot: { x: number; y: number }[];
    iR: { x: number; y: number }[];
    iS: { x: number; y: number }[];
    iT: { x: number; y: number }[];
  }>({
    vAb: [], vBc: [], vCa: [],
    vRn: [], vSn: [], vTn: [],
    kw: [],
    iTot: [], iR: [], iS: [], iT: []
  });

  const latestModalLiveRef = useRef<{
    vAb: number; vBc: number; vCa: number;
    vRn: number; vSn: number; vTn: number;
    kw: number; iTot: number; iR: number; iS: number; iT: number;
  } | null>(null);

  const formatModalWibTick = useCallback((ms: number): string => {
    if (!Number.isFinite(ms)) return "";
    const wib = new Date(ms + 7 * 3600 * 1000);
    const hh = String(wib.getUTCHours()).padStart(2, "0");
    const mm = String(wib.getUTCMinutes()).padStart(2, "0");
    const ss = String(wib.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, []);

  const formatModalWibTooltip = useCallback((items: any[]): string => {
    const rawX = items?.[0]?.parsed?.x ?? items?.[0]?.raw?.x;
    const ms = Number(rawX);
    if (!Number.isFinite(ms)) return "";
    const wib = new Date(ms + 7 * 3600 * 1000);
    const dd = String(wib.getUTCDate()).padStart(2, "0");
    const mo = String(wib.getUTCMonth() + 1).padStart(2, "0");
    const hh = String(wib.getUTCHours()).padStart(2, "0");
    const mm = String(wib.getUTCMinutes()).padStart(2, "0");
    const ss = String(wib.getUTCSeconds()).padStart(2, "0");
    return `${dd}/${mo} ${hh}:${mm}:${ss} WIB`;
  }, []);

  useEffect(() => {
    if (!transformer?.id) return;
    setLoadingModalHistory(true);
    setModalPointCount(0);
    const pmId = TRAFO_PM_MAP[transformer.id]?.pmId || transformer.id;

    getJson<{ tuples?: number[][]; data?: any[] }>(`/analytics/electricity/power-meters/${pmId}/history?rolling=true&compact=true&_t=${Date.now()}`)
      .then((res) => {
        const rawTuples = res?.tuples;
        if (Array.isArray(rawTuples) && rawTuples.length > 0) {
          const maxClientMs = Date.now() + 2000;
          const tuples = rawTuples.filter((row) => Number(row[0]) <= maxClientMs);
          if (tuples.length === 0) return;
          const n = tuples.length;
          const vAb = new Array(n);
          const vBc = new Array(n);
          const vCa = new Array(n);
          const vRn: { x: number; y: number }[] = [];
          const vSn: { x: number; y: number }[] = [];
          const vTn: { x: number; y: number }[] = [];
          const kw = new Array(n);
          const iTot: { x: number; y: number }[] = [];
          const iR = new Array(n);
          const iS = new Array(n);
          const iT = new Array(n);

          for (let i = 0; i < n; i++) {
            const row = tuples[i];
            const x = Number(row[0]);
            const v1 = Number(row[1]) || 0;
            const v2 = Number(row[2]) || 0;
            const v3 = Number(row[3]) || 0;
            const p = Number(row[4]) || 0;
            const c1 = Number(row[5]) || 0;
            const c2 = Number(row[6]) || 0;
            const c3 = Number(row[7]) || 0;
            vAb[i] = { x, y: v1 };
            vBc[i] = { x, y: v2 };
            vCa[i] = { x, y: v3 };
            kw[i] = { x, y: p };
            iR[i] = { x, y: c1 };
            iS[i] = { x, y: c2 };
            iT[i] = { x, y: c3 };
          }

          modalSeriesRef.current = { vAb, vBc, vCa, vRn, vSn, vTn, kw, iTot, iR, iS, iT };
          const last = tuples[n - 1];
          const lv1 = Number(last[1]) || 0;
          const lv2 = Number(last[2]) || 0;
          const lv3 = Number(last[3]) || 0;
          const lc1 = Number(last[5]) || 0;
          const lc2 = Number(last[6]) || 0;
          const lc3 = Number(last[7]) || 0;
          latestModalLiveRef.current = {
            vAb: lv1, vBc: lv2, vCa: lv3,
            vRn: 0,
            vSn: 0,
            vTn: 0,
            kw: Number(last[4]) || 0,
            iR: lc1, iS: lc2, iT: lc3,
            iTot: 0
          };
          setModalPointCount(n);
          setModalTickMs(Number(last[0]) || Math.floor(Date.now() / 1000) * 1000);
        }
      })
      .catch((err) => console.error("Failed to load modal trafo history:", err))
      .finally(() => setLoadingModalHistory(false));

    const socket = getSocket();
    const targetPmId = pmId.toUpperCase();

    const appendModalPoint = (pm: any, fallbackTs?: number) => {
      const v1 = pm.volt_ab !== undefined && pm.volt_ab !== null ? Number(Number(pm.volt_ab).toFixed(1)) : 0;
      const v2 = pm.volt_bc !== undefined && pm.volt_bc !== null ? Number(Number(pm.volt_bc).toFixed(1)) : 0;
      const v3 = pm.volt_ca !== undefined && pm.volt_ca !== null ? Number(Number(pm.volt_ca).toFixed(1)) : 0;
      const c1 = pm.current_a !== undefined && pm.current_a !== null ? Number(Number(pm.current_a).toFixed(1)) : 0;
      const c2 = pm.current_b !== undefined && pm.current_b !== null ? Number(Number(pm.current_b).toFixed(1)) : 0;
      const c3 = pm.current_c !== undefined && pm.current_c !== null ? Number(Number(pm.current_c).toFixed(1)) : 0;
      const p = pm.active_power_total !== undefined && pm.active_power_total !== null ? Number(Number(pm.active_power_total).toFixed(2)) : 0;
      if (v1 <= 0 && p <= 0 && c1 <= 0) return;

      const s = modalSeriesRef.current;
      const lastX = s.vAb.length > 0 ? s.vAb[s.vAb.length - 1].x : 0;
      const rawX = Number(pm.ts) || fallbackTs || Date.now();
      if (rawX - lastX < 800) return;
      const nextX = rawX;
      const cutoff = nextX - 24 * 3600 * 1000;

      const pushAndShift = (arr: { x: number; y: number }[], val: number) => {
        arr.push({ x: nextX, y: val });
        while (arr.length > 0 && arr[0].x < cutoff) {
          arr.shift();
        }
      };

      pushAndShift(s.vAb, v1);
      pushAndShift(s.vBc, v2);
      pushAndShift(s.vCa, v3);
      pushAndShift(s.kw, p);
      pushAndShift(s.iR, c1);
      pushAndShift(s.iS, c2);
      pushAndShift(s.iT, c3);

      setModalPointCount(s.vAb.length);
      setModalTickMs(nextX);
    };

    const handleModalSaved3s = (payload: any) => {
      if (!payload || !Array.isArray(payload.data)) return;
      const pm = payload.data.find((item: any) => String(item.pm_id).toUpperCase() === targetPmId);
      if (pm) appendModalPoint(pm, Number(payload.ts));
    };

    socket.on("electricity:trafo_3s_saved", handleModalSaved3s);
    return () => {
      socket.off("electricity:trafo_3s_saved", handleModalSaved3s);
    };
  }, [transformer?.id]);

  const modalWindowRange = useMemo(() => {
    const min24h = modalTickMs - 24 * 3600 * 1000;
    return { min: min24h, max: modalTickMs };
  }, [modalTickMs, modalPointCount]);

  const chartData = useMemo(() => {
    const s = modalSeriesRef.current;
    if (activeTab === "voltage") {
      const is380 = modalVoltageType === "380v";
      return {
        datasets: [
          {
            label: is380 ? "Fasa R-S (380V)" : "Fasa R-N (230V)",
            data: is380 ? s.vAb : s.vRn,
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            borderWidth: 1.5,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: is380 ? "Fasa S-T (380V)" : "Fasa S-N (230V)",
            data: is380 ? s.vBc : s.vSn,
            borderColor: "#06b6d4",
            backgroundColor: "transparent",
            borderWidth: 1.5,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: is380 ? "Fasa T-R (380V)" : "Fasa T-N (230V)",
            data: is380 ? s.vCa : s.vTn,
            borderColor: "#8b5cf6",
            backgroundColor: "transparent",
            borderWidth: 1.5,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      };
    }
    if (activeTab === "ampere") {
      return {
        datasets: [
          {
            label: "Phase R (A)",
            data: s.iR,
            borderColor: "#ef4444",
            backgroundColor: "transparent",
            borderWidth: 1.3,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: "Phase S (A)",
            data: s.iS,
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            borderWidth: 1.3,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: "Phase T (A)",
            data: s.iT,
            borderColor: "#10b981",
            backgroundColor: "transparent",
            borderWidth: 1.3,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      };
    }
    return {
      datasets: [
        {
          label: "kW Total (Daya Aktif)",
          data: s.kw,
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.15)",
          borderWidth: 1.6,
          tension: 0,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [activeTab, modalVoltageType, modalTickMs, modalPointCount]);

  const modalChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    parsing: false as const,
    normalized: true,
    plugins: {
      legend: {
        display: activeTab === "ampere" || activeTab === "voltage",
        position: "top" as const,
        labels: {
          boxWidth: 10,
          font: { size: 10, weight: 700 },
          color: isDark ? "#94a3b8" : "#64748b"
        }
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "#f8fafc" : "#0f172a",
        bodyColor: isDark ? "#94a3b8" : "#475569",
        borderColor: isDark ? "#334155" : "#e2e8f0",
        borderWidth: 1,
        padding: 8,
        callbacks: {
          title: formatModalWibTooltip,
        },
      },
    },
    scales: {
      x: {
        type: "linear" as const,
        min: modalWindowRange.min,
        max: modalWindowRange.max,
        afterBuildTicks: (axis: any) => {
          const min = axis.min;
          const max = axis.max;
          if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
          const step = (max - min) / 8;
          const ticks: { value: number }[] = [];
          for (let i = 0; i <= 8; i++) {
            ticks.push({ value: Math.round(min + i * step) });
          }
          axis.ticks = ticks;
        },
        grid: { color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)" },
        ticks: {
          color: isDark ? "#64748b" : "#94a3b8",
          font: { size: 9, weight: 600 },
          maxRotation: 0,
          autoSkip: false,
          callback: (val: any) => formatModalWibTick(Number(val)),
        },
      },
      y: {
        grid: { color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)" },
        ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9, weight: 600 } },
      },
    },
  }), [isDark, activeTab, modalWindowRange, formatModalWibTick, formatModalWibTooltip]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500"
              style={{ width: 28, height: 28 }}
            >
              <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Detailed Configurations & Records — {transformer.name}
              </h3>
              <p className="text-[10px] text-slate-400">Transformator {transformer.factory === 1 ? "Factory 1" : "Factory 2"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
              transformer.status === "online" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"
            }`}>
              {transformer.status === "online" ? "ON" : "OFF"}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 overflow-hidden flex-1">
          
          {/* Left Column: Tab & Chart (Historical Trends) */}
          <div className="flex flex-col overflow-hidden space-y-4">
            <h4 className="text-xs font-extrabold uppercase text-[#47729f] dark:text-sky-400 tracking-wider">
              📈 Historical Trend (24 Jam)
            </h4>
            {/* Tab Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 bg-slate-100/80 dark:bg-slate-800/40 p-1 rounded-xl self-start flex-shrink-0">
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === t.key
                        ? "bg-white dark:bg-slate-800 shadow-sm text-[#002b5c] dark:text-sky-400"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === "voltage" && (
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/40 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalVoltageType("380v")}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      modalVoltageType === "380v"
                        ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    Tegangan 380V
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalVoltageType("230v")}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      modalVoltageType === "230v"
                        ? "bg-white dark:bg-slate-700 text-cyan-500 shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    Tegangan 230V
                  </button>
                </div>
              )}

            </div>

            {/* Chart View */}
            <div className="relative flex-1 flex flex-col p-4 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl overflow-hidden" style={{ minHeight: 280, height: "100%" }}>
              {activeTab === "voltage" && modalVoltageType === "230v" ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-amber-500/30 bg-amber-500/5 rounded-xl">
                  <span className="text-xs font-extrabold text-amber-500 dark:text-amber-400 font-mono tracking-wider">{NO_REALTIME_API}</span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 max-w-sm">
                    Tag tegangan 230V (L-N) belum tersedia dari API Power Meter ({transformer.name}).
                  </p>
                </div>
              ) : loadingModalHistory ? (
                <div className="flex-1 flex items-center justify-center text-xs text-sky-500 font-bold gap-2">
                  <span className="animate-spin">⏳</span> Memuat riwayat telemetri...
                </div>
              ) : modalPointCount > 0 ? (
                <div className="w-full h-full min-h-[240px]">
                  <TradingViewChart
                    data={chartData}
                    options={modalChartOptions}
                    defaultRange={modalWindowRange}
                    isDark={isDark}
                    resetKey={`${transformer.id}-${activeTab}-${modalVoltageType}`}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">{NO_REALTIME_API}</span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 max-w-sm">
                    Belum ada rekaman histori hari ini untuk {transformer.name}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Configurations Specs & Coverage split tabs */}
          <div className="flex flex-col border-l border-slate-100 dark:border-slate-800/80 pl-6 overflow-hidden">
            {/* Right Side Tabs */}
            <div className="flex gap-2 bg-slate-100/80 dark:bg-slate-800/40 p-1 rounded-xl self-start mb-4 flex-shrink-0">
              <button
                onClick={() => setRightTab("specs")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rightTab === "specs"
                    ? "bg-white dark:bg-slate-800 shadow-sm text-[#002b5c] dark:text-sky-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                🪪 Nameplate Specifications
              </button>
              <button
                onClick={() => setRightTab("coverage")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rightTab === "coverage"
                    ? "bg-white dark:bg-slate-800 shadow-sm text-[#002b5c] dark:text-sky-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                📋 Coverage Equipment ({coverages.length})
              </button>
            </div>

            {/* TAB 1: Specs Editor */}
            {rightTab === "specs" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Kapasitas (kVA)</label>
                    <input
                      type="number"
                      value={specForm.capacityKva}
                      onChange={e => setSpecForm({ ...specForm, capacityKva: +e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={specForm.manufacturer}
                      onChange={e => setSpecForm({ ...specForm, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vector Group</label>
                    <input
                      type="text"
                      value={specForm.vectorGroup}
                      onChange={e => setSpecForm({ ...specForm, vectorGroup: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Impedansi (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={specForm.impedance}
                      onChange={e => setSpecForm({ ...specForm, impedance: +e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tahun Pembuatan</label>
                    <input
                      type="text"
                      value={specForm.year}
                      onChange={e => setSpecForm({ ...specForm, year: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveSpecsClick}
                  className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow"
                >
                  Save Specification Details
                </button>
              </div>
            )}

            {/* TAB 2: Coverage Editor */}
            {rightTab === "coverage" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 flex flex-col justify-between">
                
                {/* List items */}
                <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                  {coverages.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.load}</span>
                        {item.group && (
                          <span className="text-[8px] text-slate-400 font-semibold">{item.group}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 font-mono text-[9px] font-extrabold text-blue-500 dark:text-sky-400 bg-blue-500/10 border border-blue-500/20 rounded">
                          {item.breaker}
                        </span>
                        <button
                          onClick={() => handleDeleteCoverage(idx)}
                          className="text-rose-500 hover:text-rose-700 font-extrabold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {coverages.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                      No coverage equipment added yet.
                    </div>
                  )}
                </div>

                {/* Add new coverage Form */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 space-y-2 mt-auto">
                  <h5 className="text-[10px] font-extrabold text-[#47729f] dark:text-slate-400 uppercase tracking-wider">
                    ➕ Add Equipment Coverage
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Load Name"
                      value={newLoad}
                      onChange={e => {
                        setNewLoad(e.target.value);
                        setNewLabel(e.target.value);
                      }}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Breaker MCCB"
                      value={newBreaker}
                      onChange={e => setNewBreaker(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Group (optional)"
                      value={newGroup}
                      onChange={e => setNewGroup(e.target.value)}
                      className="col-span-2 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddCoverage}
                    className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    Add to Coverage List
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-4 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ TRANSFORMER DETAIL CARD (Section B) ═══════════ */
function TransformerDetailCard({ tx, factoryLabel }: { tx: TransformerData; factoryLabel: string; loadConfig: { safeMax: number; cautionMax: number } }) {
  const hasData = tx.activePowerKw !== null && tx.activePowerKw !== undefined;

  const has400V =
    tx.voltAb !== null && tx.voltAb !== undefined &&
    tx.voltBc !== null && tx.voltBc !== undefined &&
    tx.voltCa !== null && tx.voltCa !== undefined;

  const hasThdV =
    tx.thdVoltA !== null && tx.thdVoltA !== undefined &&
    tx.thdVoltB !== null && tx.thdVoltB !== undefined &&
    tx.thdVoltC !== null && tx.thdVoltC !== undefined;

  const hasThdI =
    tx.thdCurrentA !== null && tx.thdCurrentA !== undefined &&
    tx.thdCurrentB !== null && tx.thdCurrentB !== undefined &&
    tx.thdCurrentC !== null && tx.thdCurrentC !== undefined;

  const hasCurrent =
    tx.currentR !== null && tx.currentR !== undefined &&
    tx.currentS !== null && tx.currentS !== undefined &&
    tx.currentT !== null && tx.currentT !== undefined;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-full"
            style={{
              width: 8, height: 8,
              backgroundColor: hasData ? (tx.status === "online" ? "#10b981" : "#f59e0b") : "#94a3b8",
              boxShadow: hasData ? "0 0 6px #10b981" : "none",
            }}
          />
          <span className="text-sm font-extrabold text-slate-800 dark:text-white">{tx.name}</span>
          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold bg-sky-500/10 text-sky-500 border border-sky-500/20 uppercase">
            {factoryLabel} — {tx.capacityKva} kVA
          </span>
        </div>
        {(() => {
          const loadPct = tx.apparentPowerKva && tx.capacityKva
            ? Math.round((tx.apparentPowerKva / tx.capacityKva) * 100)
            : (tx.activePowerKw && tx.capacityKva ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null);
          const loadColor = loadPct !== null
            ? (loadPct <= 70 ? "#10b981" : loadPct <= 85 ? "#eab308" : "#ef4444")
            : "#f59e0b";
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400">LOAD:</span>
              {loadPct !== null ? (
                <span className="text-[11px] font-mono font-extrabold" style={{ color: loadColor }}>
                  {loadPct}%
                </span>
              ) : (
                <span className="text-[9px] font-extrabold text-amber-500">
                  {NO_REALTIME_API}
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Parameters Grid */}
      <div className="p-5">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 16px" }} className="text-xs">
          <ParamCell label="Input Voltage" value={tx.voltageInKv !== null ? `${tx.voltageInKv.toFixed(2)} kV` : NO_REALTIME_API} warn={tx.voltageInKv === null} />
          <ParamCell label="Output Volt 400V" value={has400V ? `R:${tx.voltAb!.toFixed(1)} S:${tx.voltBc!.toFixed(1)} T:${tx.voltCa!.toFixed(1)} V` : NO_REALTIME_API} warn={!has400V} />
          <ParamCell label="Output Volt 230V" value={tx.voltageOutL2N !== null ? `${tx.voltageOutL2N.toFixed(1)} V` : NO_REALTIME_API} warn={tx.voltageOutL2N === null} />
          
          <ParamCell label="Active Power" value={tx.activePowerKw !== null ? `${tx.activePowerKw} kW` : NO_REALTIME_API} accent={hasData} warn={tx.activePowerKw === null} />
          <ParamCell label="Reactive Power" value={tx.reactivePowerKvar !== null ? `${tx.reactivePowerKvar} kVAR` : NO_REALTIME_API} warn={tx.reactivePowerKvar === null} />
          <ParamCell label="Apparent Power" value={tx.apparentPowerKva !== null ? `${tx.apparentPowerKva} kVA` : NO_REALTIME_API} warn={tx.apparentPowerKva === null} />
          
          <ParamCell label="Power Factor" value={tx.powerFactor !== null ? Math.abs(tx.powerFactor).toFixed(3) : NO_REALTIME_API} warn={tx.powerFactor === null} />
          <ParamCell label="Frequency" value={tx.frequencyHz !== null ? `${tx.frequencyHz.toFixed(2)} Hz` : NO_REALTIME_API} warn={tx.frequencyHz === null} />
          <ParamCell label="Temperature" value={tx.tempCc !== null ? `${tx.tempCc.toFixed(1)} °C` : NO_REALTIME_API} warn={tx.tempCc === null || tx.tempCc > 60} />

          <ParamCell label="Impedance" value={`${tx.impedance ?? 4.5} %`} />
          <ParamCell label="Vector Group" value={tx.vectorGroup ?? "Dyn11"} />
          <ParamCell label="Mfg / Year" value={`${tx.manufacturer ?? "Schneider"} (${tx.year ?? "2021"})`} />
        </div>

        {/* Current & THD Section */}
        <div
          className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-2.5"
        >
          <div className="flex justify-between items-center text-xs">
            <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Arus Per Fasa (A)</span>
            {hasCurrent ? (
              <div className="font-mono font-bold text-slate-600 dark:text-slate-300">
                R: <span className="mr-2">{tx.currentR!.toFixed(1)}</span>
                S: <span className="mr-2">{tx.currentS!.toFixed(1)}</span>
                T: <span>{tx.currentT!.toFixed(1)}</span>
              </div>
            ) : (
              <span className="text-[9px] font-bold text-amber-500">{NO_REALTIME_API}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-xs">
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider mb-0.5">THDV Per Fasa (%)</span>
              {hasThdV ? (
                <div className="font-mono font-bold text-slate-600 dark:text-slate-300">
                  R:<span className="mr-1">{tx.thdVoltA!.toFixed(2)}</span>
                  S:<span className="mr-1">{tx.thdVoltB!.toFixed(2)}</span>
                  T:<span>{tx.thdVoltC!.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-[9px] font-bold text-amber-500">{NO_REALTIME_API}</span>
              )}
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase block font-extrabold tracking-wider mb-0.5">THDi Per Fasa (%)</span>
              {hasThdI ? (
                <div className="font-mono font-bold text-slate-600 dark:text-slate-300">
                  R:<span className="mr-1">{tx.thdCurrentA!.toFixed(2)}</span>
                  S:<span className="mr-1">{tx.thdCurrentB!.toFixed(2)}</span>
                  T:<span>{tx.thdCurrentC!.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-[9px] font-bold text-amber-500">{NO_REALTIME_API}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-[10px] font-bold text-slate-500">
            <div>
              <span>Voltage Unbalanced: </span>
              {tx.voltageUnbalance !== null && tx.voltageUnbalance !== undefined ? (
                <span className="text-slate-600 dark:text-slate-300 font-mono font-bold">
                  {tx.voltageUnbalance.toFixed(2)} %
                </span>
              ) : (
                <span className="text-[9px] font-bold text-amber-500">{NO_REALTIME_API}</span>
              )}
            </div>
            <div>
              <span>Current Unbalanced: </span>
              {tx.currentUnbalance !== null && tx.currentUnbalance !== undefined ? (
                <span className="text-slate-600 dark:text-slate-300 font-mono font-bold">
                  {tx.currentUnbalance.toFixed(2)} %
                </span>
              ) : (
                <span className="text-[9px] font-bold text-amber-500">{NO_REALTIME_API}</span>
              )}
            </div>
          </div>
        </div>

        {/* Cost & kWh */}
        <div
          className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center" }}
        >
          <div>
            <span className="text-[9px] text-slate-400 uppercase block font-bold">Total Konsumsi</span>
            {tx.kwh !== null ? (
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">
                {tx.kwh.toLocaleString("id-ID")} <span className="text-[9px] text-slate-400 font-bold">kWh</span>
              </span>
            ) : (
              <span className="text-[9px] font-bold text-amber-500">{NO_REALTIME_API}</span>
            )}
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase block font-bold">Estimasi Cost</span>
            <span className="text-[9px] font-bold text-amber-500">
              {NO_REALTIME_API}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParamCell({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">{label}</span>
      <span className={`font-bold font-mono text-[10px] ${
        accent ? "text-emerald-500 font-extrabold" :
        warn ? "text-amber-500" :
        "text-slate-800 dark:text-slate-200"
      }`}>
        {value}
      </span>
    </div>
  );
}

/* ═══════════ SLD SCALED CANVAS (RESPONSIVE) ═══════════ */
const SLD_DESIGN_W = 1200;
const SLD_DESIGN_H = 665;

function SldScaledCanvas({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Subtract total padding (16px left + 16px right = 32px) from clientWidth
    const padding = 32;
    const availableWidth = el.clientWidth - padding;
    if (availableWidth > 0) {
      const s = availableWidth / SLD_DESIGN_W;
      setScale(s);
    }
  }, []);

  useEffect(() => {
    measure();

    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);
    
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div 
      ref={containerRef} 
      className="w-full overflow-hidden" 
      style={{ 
        padding: "16px", 
        boxSizing: "border-box",
        height: SLD_DESIGN_H * scale + 32, // design height scaled + padding
        position: "relative"
      }}
    >
      <div
        style={{
          width: SLD_DESIGN_W,
          height: SLD_DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 16,
          left: 16
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════════ SLD TRANSFORMER MINI CARD ═══════════ */
function SldMiniCard({ tx, onClick, loadConfig, isLoading = false }: { tx: TransformerData; onClick: () => void; loadConfig: { safeMax: number; cautionMax: number }; isLoading?: boolean }) {
  const hasData = tx.activePowerKw !== null && tx.activePowerKw !== undefined;
  const loadPct = hasData && tx.capacityKva && tx.activePowerKw !== null ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null;
  
  // Dynamic color thresholds based on user parameters
  const loadColor = loadPct !== null 
    ? (loadPct <= loadConfig.safeMax ? "#10b981" : loadPct <= loadConfig.cautionMax ? "#eab308" : "#ef4444")
    : "#94a3b8";

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 shadow-sm flex flex-col hover:border-sky-500/40 hover:shadow-md transition-all duration-300 cursor-pointer"
      style={{ padding: "10px 12px", minWidth: 0 }}
      onClick={onClick}
    >
      {/* Name row */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-700/40">
        <span className="text-[10px] font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: 6, height: 6,
              backgroundColor: isLoading ? "#38bdf8" : hasData ? (tx.status === "online" ? "#10b981" : "#f59e0b") : "#94a3b8",
              boxShadow: isLoading ? "0 0 4px #38bdf8" : hasData ? "0 0 4px #10b981" : "none",
            }}
          />
          {tx.name}
        </span>
        <span className="text-[8px] font-bold text-slate-400 ml-1 flex-shrink-0">{tx.capacityKva} kVA</span>
      </div>

      {/* Power value */}
      {isLoading ? (
        <div className="py-2 space-y-1">
          <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse" />
          <div className="h-2.5 w-10 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse" />
        </div>
      ) : (
        <div className="py-2 space-y-0.5">
          <div className={`text-xs font-extrabold font-mono ${hasData ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}`}>
            {hasData ? `${tx.activePowerKw} kW` : "— kW"}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            PF: <span className="font-mono text-slate-400">{tx.powerFactor !== null ? Math.abs(tx.powerFactor).toFixed(3) : "—"}</span>
          </div>
        </div>
      )}

      {/* Load bar */}
      {isLoading ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[7px] font-extrabold text-slate-400">
            <span>LOAD</span>
            <span className="text-slate-400 font-mono animate-pulse">...</span>
          </div>
          <div className="w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700/60" style={{ height: 4 }}>
            <div className="h-full bg-slate-300 dark:bg-slate-600 rounded-full animate-pulse w-1/3" />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between text-[7px] font-extrabold text-slate-400">
            <span>LOAD</span>
            <span style={{ color: loadColor }}>{loadPct !== null ? `${loadPct}%` : "—%"}</span>
          </div>
          <div
            className="w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700/60"
            style={{ height: 4 }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${loadPct ? Math.min(100, loadPct) : 0}%`, backgroundColor: loadColor }}
            />
          </div>
        </div>
      )}

      {/* Detail button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="w-full mt-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sky-500/40 text-[8px] font-extrabold text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 tracking-wider bg-slate-50/50 dark:bg-slate-800/30 hover:bg-sky-500/5 transition-all"
      >
        DETAIL ▾
      </button>
    </div>
  );
}

/* ═══════════ SLD CONNECTOR COMPONENTS ═══════════ */
function VerticalLine({ height = 24, color = "currentColor" }: { height?: number; color?: string }) {
  return <div style={{ width: 2, height, backgroundColor: color, margin: "0 auto", borderRadius: 1 }} />;
}

function CircuitBreaker({ closed = true }: { closed?: boolean }) {
  const bg = closed ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)";
  const border = closed ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)";
  const text = closed ? "#10b981" : "#ef4444";
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 26, height: 26, borderRadius: 6, margin: "0 auto",
        backgroundColor: bg, border: `1px solid ${border}`,
      }}
    >
      <span style={{ fontSize: 8, fontWeight: 800, fontFamily: "monospace", color: text }}>CB</span>
    </div>
  );
}

function TransformerSymbol() {
  return (
    <div className="flex flex-col items-center" style={{ margin: "0 auto" }}>
      <div
        className="flex items-center justify-center"
        style={{
          width: 24, height: 24, borderRadius: "50%",
          border: "1.5px solid rgba(56,189,248,0.5)",
          fontSize: 7, fontWeight: 800, color: "#38bdf8",
        }}
      >
        20k
      </div>
      <div
        className="flex items-center justify-center"
        style={{
          width: 24, height: 24, borderRadius: "50%",
          border: "1.5px solid rgba(56,189,248,0.5)",
          marginTop: -8,
          fontSize: 7, fontWeight: 800, color: "#38bdf8",
        }}
      >
        400
      </div>
    </div>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function PowerDistribution() {
  const { t, language } = useTranslation();
  const isPageActive = usePageActive();
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const [telemetryTransformers, setTelemetryTransformers] = useState<TransformerData[]>(INITIAL_TRANSFORMERS);
  const [selectedTx, setSelectedTx] = useState<TransformerData | null>(null);
  const [loadingSld, setLoadingSld] = useState<boolean>(true);

  // Safety timer so skeleton never gets stuck indefinitely
  useEffect(() => {
    const t = setTimeout(() => setLoadingSld(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // Incoming live telemetry data
  const [incomingData, setIncomingData] = useState<{
    plnKw: number | null;
    plnPf: number | null;
    wf1Kw: number | null;
    wf1Pf: number | null;
    wf1Volt: number | null;
    wf2Kw: number | null;
    wf2Pf: number | null;
    wf2Volt: number | null;
  }>({
    plnKw: null,
    plnPf: null,
    wf1Kw: null,
    wf1Pf: null,
    wf1Volt: null,
    wf2Kw: null,
    wf2Pf: null,
    wf2Volt: null,
  });

  const incomingDataRef = useRef(incomingData);
  useEffect(() => {
    incomingDataRef.current = incomingData;
  }, [incomingData]);

  // Sync 20 kV feeder voltages to transformer cards
  useEffect(() => {
    if (!incomingData.wf1Volt && !incomingData.wf2Volt) return;
    setTelemetryTransformers(prev => prev.map(tx => ({
      ...tx,
      voltageInKv: tx.factory === 1 ? (incomingData.wf1Volt ?? tx.voltageInKv) : (incomingData.wf2Volt ?? tx.voltageInKv)
    })));
  }, [incomingData.wf1Volt, incomingData.wf2Volt]);

  const toKv = (v: number | null | undefined): number | null => {
    if (v === null || v === undefined || isNaN(Number(v))) return null;
    const num = Number(v);
    return num > 100 ? Number((num / 1000).toFixed(2)) : Number(num.toFixed(2));
  };

  const parsePowerVal = (val: any, prev: number | null): number | null => {
    if (val === undefined || val === null || isNaN(Number(val))) return prev;
    return Number(Number(val).toFixed(1));
  };

  // Fetch incoming telemetries for PLN, Fact-1, Fact-2
  useEffect(() => {
    if (!isPageActive) return;
    const fetchIncomingData = async () => {
      try {
        const [plnRes, wf1Res, wf2Res] = await Promise.all([
          getJson<{ data: any }>("/analytics/electricity?deviceId=Cubicle_PLN_PM8000"),
          getJson<{ data: any }>("/analytics/electricity?deviceId=Feeder_WF1_PM5560"),
          getJson<{ data: any }>("/analytics/electricity?deviceId=Feeder_WF2_PM5500"),
        ]);
        setIncomingData(prev => ({
          plnKw: plnRes?.data?.pqData?.activePower !== undefined ? parsePowerVal(plnRes.data.pqData.activePower, prev.plnKw) : prev.plnKw,
          plnPf: decodePf(plnRes?.data?.pqData?.pf !== undefined ? plnRes.data.pqData.pf : prev.plnPf),
          wf1Kw: wf1Res?.data?.pqData?.activePower !== undefined ? parsePowerVal(wf1Res.data.pqData.activePower, prev.wf1Kw) : prev.wf1Kw,
          wf1Pf: decodePf(wf1Res?.data?.pqData?.pf !== undefined ? wf1Res.data.pqData.pf : prev.wf1Pf),
          wf1Volt: toKv(wf1Res?.data?.pqData?.vll1 ?? wf1Res?.data?.pqData?.voltage) ?? prev.wf1Volt,
          wf2Kw: wf2Res?.data?.pqData?.activePower !== undefined ? parsePowerVal(wf2Res.data.pqData.activePower, prev.wf2Kw) : prev.wf2Kw,
          wf2Pf: decodePf(wf2Res?.data?.pqData?.pf !== undefined ? wf2Res.data.pqData.pf : prev.wf2Pf),
          wf2Volt: toKv(wf2Res?.data?.pqData?.vll1 ?? wf2Res?.data?.pqData?.voltage) ?? prev.wf2Volt,
        }));
        setLoadingSld(false);
      } catch (err) {
        console.error("Failed to load incoming telemetries for SLD:", err);
      }
    };

    fetchIncomingData();
    const interval = setInterval(fetchIncomingData, 1000);

    const socket = getSocket();
    const handleIncomingLive = (payload: any) => {
      if (!payload || !payload.deviceId || !payload.pqData) return;
      setLoadingSld(false);
      setIncomingData(prev => {
        if (payload.deviceId === "Cubicle_PLN_PM8000") {
          return {
            ...prev,
            plnKw: parsePowerVal(payload.pqData.activePower, prev.plnKw),
            plnPf: decodePf(payload.pqData.pf !== undefined ? payload.pqData.pf : prev.plnPf)
          };
        }
        if (payload.deviceId === "Feeder_WF1_PM5560") {
          return {
            ...prev,
            wf1Kw: parsePowerVal(payload.pqData.activePower, prev.wf1Kw),
            wf1Pf: decodePf(payload.pqData.pf !== undefined ? payload.pqData.pf : prev.wf1Pf),
            wf1Volt: toKv(payload.pqData.vll1 ?? payload.pqData.voltage) ?? prev.wf1Volt
          };
        }
        if (payload.deviceId === "Feeder_WF2_PM5500") {
          return {
            ...prev,
            wf2Kw: parsePowerVal(payload.pqData.activePower, prev.wf2Kw),
            wf2Pf: decodePf(payload.pqData.pf !== undefined ? payload.pqData.pf : prev.wf2Pf),
            wf2Volt: toKv(payload.pqData.vll1 ?? payload.pqData.voltage) ?? prev.wf2Volt
          };
        }
        return prev;
      });
    };

    socket.on("electricity:live_update", handleIncomingLive);
    return () => {
      clearInterval(interval);
      socket.off("electricity:live_update", handleIncomingLive);
    };
  }, [isPageActive]);

  // Solar PV POI-1 & POI-2 Telemetry State
  const [solarData, setSolarData] = useState<{
    poi1Kw: number | null;
    poi1Pf: number | null;
    poi2Kw: number | null;
    poi2Pf: number | null;
  }>({
    poi1Kw: null,
    poi1Pf: null,
    poi2Kw: null,
    poi2Pf: null,
  });

  // Fetch solar telemetries for SLD
  useEffect(() => {
    if (!isPageActive) return;
    const fetchSolar = () => {
      getJson<{ data: any }>("/analytics/solar/latest")
        .then((res) => {
          if (res?.data) {
            setSolarData({
              poi1Kw: res.data.poi1?.activePower !== undefined ? res.data.poi1.activePower : null,
              poi1Pf: decodePf(res.data.poi1?.powerFactor !== undefined ? res.data.poi1.powerFactor : null),
              poi2Kw: res.data.poi2?.activePower !== undefined ? res.data.poi2.activePower : null,
              poi2Pf: decodePf(res.data.poi2?.powerFactor !== undefined ? res.data.poi2.powerFactor : null),
            });
          }
        })
        .catch((err) => console.error("Failed to load solar telemetry for SLD:", err));
    };

    fetchSolar();
    const interval = setInterval(fetchSolar, 1000);

    const socket = getSocket();
    const handleSolarLive = (payload: any) => {
      if (!payload) return;
      setSolarData(prev => ({
        poi1Kw: payload.poi1?.activePower !== undefined ? payload.poi1.activePower : prev.poi1Kw,
        poi1Pf: payload.poi1?.powerFactor !== undefined ? payload.poi1.powerFactor : prev.poi1Pf,
        poi2Kw: payload.poi2?.activePower !== undefined ? payload.poi2.activePower : prev.poi2Kw,
        poi2Pf: payload.poi2?.powerFactor !== undefined ? payload.poi2.powerFactor : prev.poi2Pf,
      }));
    };

    socket.on("electricity:solar_live", handleSolarLive);
    socket.on("solar:live_update", handleSolarLive);

    return () => {
      clearInterval(interval);
      socket.off("electricity:solar_live", handleSolarLive);
      socket.off("solar:live_update", handleSolarLive);
    };
  }, [isPageActive]);

  // Fetch and sync power meter records for all 7 transformers
  useEffect(() => {
    if (!isPageActive) return;

    const fetchTrafoTelemetries = async () => {
      try {
        const res = await getJson<{ data: ElectricPmItem[] }>(`/analytics/electricity/power-meters?group=all&_t=${Date.now()}`);
        if (res?.data && Array.isArray(res.data)) {
          const pmMap = new Map<string, ElectricPmItem>();
          res.data.forEach((pm) => {
            if (pm.pm_id) {
              pmMap.set(String(pm.pm_id).toUpperCase(), pm);
            }
          });

          setTelemetryTransformers((prevTrafos) =>
            prevTrafos.map((tx) => {
              const mapping = TRAFO_PM_MAP[tx.id];
              if (!mapping) return tx;
              const pmRecord = pmMap.get(mapping.pmId.toUpperCase());
              if (!pmRecord) return tx;
              return mapPmToTransformer(tx, pmRecord, incomingDataRef.current);
            })
          );
          setLoadingSld(false);
        }
      } catch (err) {
        console.error("Failed to load transformer telemetries:", err);
      }
    };

    fetchTrafoTelemetries();
    const interval = setInterval(fetchTrafoTelemetries, 1000);

    const socket = getSocket();
    let lastLivePmUpdate = 0;
    const handlePmUpdate = (payload: { groupId: string; data: ElectricPmItem[] }) => {
      const now = Date.now();
      if (now - lastLivePmUpdate < 800) return; // 1-second display polling cadence
      lastLivePmUpdate = now;
      if (!payload || !Array.isArray(payload.data)) return;
      setLoadingSld(false);
      const pmMap = new Map<string, ElectricPmItem>();
      payload.data.forEach((pm) => {
        if (pm.pm_id) {
          pmMap.set(String(pm.pm_id).toUpperCase(), pm);
        }
      });

      setTelemetryTransformers((prevTrafos) =>
        prevTrafos.map((tx) => {
          const mapping = TRAFO_PM_MAP[tx.id];
          if (!mapping) return tx;
          const pmRecord = pmMap.get(mapping.pmId.toUpperCase());
          if (!pmRecord) return tx;
          return mapPmToTransformer(tx, pmRecord, incomingDataRef.current);
        })
      );
    };

    socket.on("electricity:pm_live_update", handlePmUpdate);
    socket.on("electricity:ew21_live", handlePmUpdate);
    socket.on("electricity:ew22_live", handlePmUpdate);
    socket.on("electricity:ew23_live", handlePmUpdate);

    return () => {
      clearInterval(interval);
      socket.off("electricity:pm_live_update", handlePmUpdate);
      socket.off("electricity:ew21_live", handlePmUpdate);
      socket.off("electricity:ew22_live", handlePmUpdate);
      socket.off("electricity:ew23_live", handlePmUpdate);
    };
  }, [isPageActive]);

  // Sub-Distribution Power Meters (EW23, EW21, EW22)
  const [selectedEwGroup, setSelectedEwGroup] = useState<"ew23" | "ew21" | "ew22">("ew23");
  const [ewPowerMeters, setEwPowerMeters] = useState<ElectricPmItem[]>([]);

  // Fetch initial EW power meters and listen to live socket updates
  useEffect(() => {
    let active = true;
    const fetchPmData = () => {
      if (!isPageActive) return;
      getJson<{ data: ElectricPmItem[] }>(`/analytics/electricity/power-meters?group=${selectedEwGroup}&_t=${Date.now()}`)
        .then((res) => {
          if (active && res?.data) {
            setEwPowerMeters((prev) => {
              if (prev.length === 0) {
                return [...res.data].sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
              }
              const map = new Map<string, ElectricPmItem>();
              for (const item of res.data) {
                if (item?.pm_id) map.set(item.pm_id.toUpperCase(), item);
              }
              for (const prevItem of prev) {
                if (!prevItem?.pm_id) continue;
                const upId = prevItem.pm_id.toUpperCase();
                const existing = map.get(upId);
                if (existing) {
                  const prevTime = prevItem.t_stamp ? new Date(prevItem.t_stamp).getTime() : 0;
                  const newTime = existing.t_stamp ? new Date(existing.t_stamp).getTime() : 0;
                  if (prevTime >= newTime) {
                    map.set(upId, { ...existing, ...prevItem });
                  }
                } else {
                  map.set(upId, prevItem);
                }
              }
              return Array.from(map.values()).sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
            });
          }
        })
        .catch((err) => console.error("Failed to load EW power meters:", err));
    };

    fetchPmData();
    const interval = setInterval(fetchPmData, 1000);

    const socket = getSocket();
    const handleLiveUpdate = (payload: { groupId: string; data: ElectricPmItem[] }) => {
      if (!payload || !Array.isArray(payload.data)) return;
      const targetGroup = payload.groupId?.toLowerCase();
      const isRelevant = targetGroup === selectedEwGroup || targetGroup === "custom_pm" || !targetGroup;
      if (!isRelevant) return;

      setEwPowerMeters((prev) => {
        if (prev.length === 0) {
          const sorted = [...payload.data]
            .filter((p) => !p.group_id || p.group_id.toLowerCase() === selectedEwGroup || targetGroup !== "custom_pm")
            .sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
          return sorted;
        }
        const map = new Map<string, ElectricPmItem>();
        for (const p of prev) {
          if (p?.pm_id) map.set(p.pm_id.toUpperCase(), p);
        }
        let updated = false;
        for (const incoming of payload.data) {
          if (!incoming?.pm_id) continue;
          if (targetGroup === "custom_pm" && incoming.group_id && incoming.group_id.toLowerCase() !== selectedEwGroup) {
            continue;
          }
          const upId = incoming.pm_id.toUpperCase();
          const existing = map.get(upId);
          map.set(upId, existing ? { ...existing, ...incoming } : incoming);
          updated = true;
        }
        if (!updated) return prev;
        return Array.from(map.values()).sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
      });
    };

    socket.on(`electricity:${selectedEwGroup}_live`, handleLiveUpdate);
    socket.on("electricity:custom_pm_live", handleLiveUpdate);
    socket.on("electricity:pm_live_update", handleLiveUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off(`electricity:${selectedEwGroup}_live`, handleLiveUpdate);
      socket.off("electricity:custom_pm_live", handleLiveUpdate);
      socket.off("electricity:pm_live_update", handleLiveUpdate);
    };
  }, [selectedEwGroup, isPageActive]);

  const [customSpecs, setCustomSpecs] = useState<Record<string, any>>({});
  const [customCoverage, setCustomCoverage] = useState<Record<string, any[]>>({});

  // Merge specs into transformers
  const transformers = useMemo(() => {
    return telemetryTransformers.map(tx => {
      const spec = customSpecs[tx.id];
      if (spec) {
        return {
          ...tx,
          capacityKva: spec.capacityKva || tx.capacityKva,
          vectorGroup: spec.vectorGroup || "Dyn11",
          impedance: spec.impedance || 4.5,
          year: spec.year || "2021",
          manufacturer: spec.manufacturer || "Schneider"
        };
      }
      return {
        ...tx,
        vectorGroup: "Dyn11",
        impedance: 4.5,
        year: "2021",
        manufacturer: "Schneider"
      };
    });
  }, [telemetryTransformers, customSpecs]);

  // Load specs & coverage from database on mount
  useEffect(() => {
    getJson<{ data: any[] }>("/config/electricity?configType=trafo_spec")
      .then(res => {
        if (res?.data) {
          const specs: any = {};
          res.data.forEach(item => {
            specs[item.config_key] = item.value;
          });
          setCustomSpecs(specs);
        }
      })
      .catch(e => console.error("Error loading specs", e));

    getJson<{ data: any[] }>("/config/electricity?configType=trafo_coverage")
      .then(res => {
        if (res?.data) {
          const coverage: any = {};
          res.data.forEach(item => {
            coverage[item.config_key] = item.value;
          });
          setCustomCoverage(coverage);
        }
      })
      .catch(e => console.error("Error loading coverage", e));
  }, []);

  const handleSaveSpecs = async (id: string, specs: any) => {
    setCustomSpecs(prev => ({ ...prev, [id]: specs }));
    try {
      await postJson("/config/electricity", {
        config_type: "trafo_spec",
        config_key: id,
        label: `Trafo Spec ${id}`,
        value: specs,
        sort_order: 0,
        enabled: true
      });
    } catch (e) {
      console.error("Failed to save spec to DB", e);
    }
  };

  const handleSaveCoverage = async (id: string, items: any[]) => {
    setCustomCoverage(prev => ({ ...prev, [id]: items }));
    try {
      await postJson("/config/electricity", {
        config_type: "trafo_coverage",
        config_key: id,
        label: `Trafo Coverage ${id}`,
        value: items,
        sort_order: 0,
        enabled: true
      });
    } catch (e) {
      console.error("Failed to save coverage to DB", e);
    }
  };

  // Load color threshold configs
  const [loadConfig, setLoadConfig] = useState({
    safeMax: 50,
    cautionMax: 80,
    dangerMax: 100
  });

  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canAccessConfig = canAccessConfigAndAudit(role);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [formConfig, setFormConfig] = useState(loadConfig);

  // Bottom historical panel selection state
  const [bottomTxId, setBottomTxId] = useState("mdp-1.1");
  const bottomTx = useMemo(() => {
    return transformers.find(t => t.id === bottomTxId) || transformers[0];
  }, [transformers, bottomTxId]);

  // Section C Historical records state (24-Hour Rolling Window with Consistent 1-Second Polling & FIFO)
  const [bottomPointCount, setBottomPointCount] = useState(0);
  const [bottomTickMs, setBottomTickMs] = useState<number>(() => Math.floor(Date.now() / 1000) * 1000);
  const [loadingBottomHistory, setLoadingBottomHistory] = useState(false);
  const [bottomVoltageMode, setBottomVoltageMode] = useState<"380v" | "230v">("380v");
  const [bottomZoomChart, setBottomZoomChart] = useState<"voltage" | "power" | "current" | null>(null);

  const bottomSeriesRef = useRef<{
    vAb: { x: number; y: number }[];
    vBc: { x: number; y: number }[];
    vCa: { x: number; y: number }[];
    vRn: { x: number; y: number }[];
    vSn: { x: number; y: number }[];
    vTn: { x: number; y: number }[];
    kw: { x: number; y: number }[];
    iTot: { x: number; y: number }[];
    iR: { x: number; y: number }[];
    iS: { x: number; y: number }[];
    iT: { x: number; y: number }[];
  }>({
    vAb: [], vBc: [], vCa: [],
    vRn: [], vSn: [], vTn: [],
    kw: [],
    iTot: [], iR: [], iS: [], iT: []
  });

  const latestBottomLiveRef = useRef<{
    vAb: number; vBc: number; vCa: number;
    vRn: number; vSn: number; vTn: number;
    kw: number; iTot: number; iR: number; iS: number; iT: number;
  } | null>(null);

  const formatWibTick = useCallback((ms: number): string => {
    if (!Number.isFinite(ms)) return "";
    const wib = new Date(ms + 7 * 3600 * 1000);
    const hh = String(wib.getUTCHours()).padStart(2, "0");
    const mm = String(wib.getUTCMinutes()).padStart(2, "0");
    const ss = String(wib.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, []);

  const formatWibTooltipTitle = useCallback((items: any[]): string => {
    const rawX = items?.[0]?.parsed?.x ?? items?.[0]?.raw?.x;
    const ms = Number(rawX);
    if (!Number.isFinite(ms)) return "";
    const wib = new Date(ms + 7 * 3600 * 1000);
    const dd = String(wib.getUTCDate()).padStart(2, "0");
    const mo = String(wib.getUTCMonth() + 1).padStart(2, "0");
    const hh = String(wib.getUTCHours()).padStart(2, "0");
    const mm = String(wib.getUTCMinutes()).padStart(2, "0");
    const ss = String(wib.getUTCSeconds()).padStart(2, "0");
    return `${dd}/${mo} ${hh}:${mm}:${ss} WIB`;
  }, []);

  useEffect(() => {
    if (!bottomZoomChart) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBottomZoomChart(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bottomZoomChart]);

  useEffect(() => {
    if (!isPageActive) return;

    // Reset series when switching transformer to lazy-load only the selected unit
    bottomSeriesRef.current = {
      vAb: [], vBc: [], vCa: [],
      vRn: [], vSn: [], vTn: [],
      kw: [],
      iTot: [], iR: [], iS: [], iT: []
    };
    latestBottomLiveRef.current = null;
    setBottomPointCount(0);
    setLoadingBottomHistory(true);

    const pmId = TRAFO_PM_MAP[bottomTxId]?.pmId || bottomTxId;
    const fetchBottomHistory = () => {
      getJson<{ tuples?: number[][]; data?: any[] }>(`/analytics/electricity/power-meters/${pmId}/history?rolling=true&compact=true&_t=${Date.now()}`)
        .then((res) => {
          const rawTuples = res?.tuples;
          if (Array.isArray(rawTuples) && rawTuples.length > 0) {
            const maxClientMs = Date.now() + 2000;
            const tuples = rawTuples.filter((row) => Number(row[0]) <= maxClientMs);
            if (tuples.length === 0) return;
            const n = tuples.length;
            const vAb = new Array(n);
            const vBc = new Array(n);
            const vCa = new Array(n);
            const vRn: { x: number; y: number }[] = [];
            const vSn: { x: number; y: number }[] = [];
            const vTn: { x: number; y: number }[] = [];
            const kw = new Array(n);
            const iTot: { x: number; y: number }[] = [];
            const iR = new Array(n);
            const iS = new Array(n);
            const iT = new Array(n);

            for (let i = 0; i < n; i++) {
              const row = tuples[i];
              const x = Number(row[0]);
              const v1 = Number(row[1]) || 0;
              const v2 = Number(row[2]) || 0;
              const v3 = Number(row[3]) || 0;
              const p = Number(row[4]) || 0;
              const c1 = Number(row[5]) || 0;
              const c2 = Number(row[6]) || 0;
              const c3 = Number(row[7]) || 0;
              vAb[i] = { x, y: v1 };
              vBc[i] = { x, y: v2 };
              vCa[i] = { x, y: v3 };
              kw[i] = { x, y: p };
              iR[i] = { x, y: c1 };
              iS[i] = { x, y: c2 };
              iT[i] = { x, y: c3 };
            }

            bottomSeriesRef.current = { vAb, vBc, vCa, vRn, vSn, vTn, kw, iTot, iR, iS, iT };
            const last = tuples[n - 1];
            const lv1 = Number(last[1]) || 0;
            const lv2 = Number(last[2]) || 0;
            const lv3 = Number(last[3]) || 0;
            const lc1 = Number(last[5]) || 0;
            const lc2 = Number(last[6]) || 0;
            const lc3 = Number(last[7]) || 0;
            latestBottomLiveRef.current = {
              vAb: lv1, vBc: lv2, vCa: lv3,
              vRn: 0,
              vSn: 0,
              vTn: 0,
              kw: Number(last[4]) || 0,
              iR: lc1, iS: lc2, iT: lc3,
              iTot: 0
            };
            setBottomPointCount(n);
            setBottomTickMs(Number(last[0]) || Math.floor(Date.now() / 1000) * 1000);
          }
        })
        .catch((err) => console.error("Failed to load bottom trafo history:", err))
        .finally(() => setLoadingBottomHistory(false));
    };

    // Fetch initial 24h 1-second rolling history once; subsequent 1-second updates stream via WebSocket
    fetchBottomHistory();

    const socket = getSocket();
    const targetPmId = (TRAFO_PM_MAP[bottomTxId]?.pmId || bottomTxId).toUpperCase();

    const appendBottomPoint = (pm: any, fallbackTs?: number) => {
      const v1 = pm.volt_ab !== undefined && pm.volt_ab !== null ? Number(Number(pm.volt_ab).toFixed(1)) : 0;
      const v2 = pm.volt_bc !== undefined && pm.volt_bc !== null ? Number(Number(pm.volt_bc).toFixed(1)) : 0;
      const v3 = pm.volt_ca !== undefined && pm.volt_ca !== null ? Number(Number(pm.volt_ca).toFixed(1)) : 0;
      const c1 = pm.current_a !== undefined && pm.current_a !== null ? Number(Number(pm.current_a).toFixed(1)) : 0;
      const c2 = pm.current_b !== undefined && pm.current_b !== null ? Number(Number(pm.current_b).toFixed(1)) : 0;
      const c3 = pm.current_c !== undefined && pm.current_c !== null ? Number(Number(pm.current_c).toFixed(1)) : 0;
      const p = pm.active_power_total !== undefined && pm.active_power_total !== null ? Number(Number(pm.active_power_total).toFixed(2)) : 0;
      if (v1 <= 0 && p <= 0 && c1 <= 0) return;

      const s = bottomSeriesRef.current;
      const lastX = s.vAb.length > 0 ? s.vAb[s.vAb.length - 1].x : 0;
      const rawX = Number(pm.ts) || fallbackTs || Date.now();
      if (rawX - lastX < 800) return;
      const nextX = rawX;
      const cutoff = nextX - 24 * 3600 * 1000;

      const pushAndShift = (arr: { x: number; y: number }[], val: number) => {
        arr.push({ x: nextX, y: val });
        while (arr.length > 0 && arr[0].x < cutoff) {
          arr.shift();
        }
      };

      pushAndShift(s.vAb, v1);
      pushAndShift(s.vBc, v2);
      pushAndShift(s.vCa, v3);
      pushAndShift(s.kw, p);
      pushAndShift(s.iR, c1);
      pushAndShift(s.iS, c2);
      pushAndShift(s.iT, c3);

      setBottomPointCount(s.vAb.length);
      setBottomTickMs(nextX);
    };

    // Auto-refresh immediately when a new 1-second batch is saved into electric_trafo_rolling_3s in PostgreSQL
    const handleTrafo3sSaved = (payload: any) => {
      if (!payload || !Array.isArray(payload.data)) return;
      const pm = payload.data.find((item: any) => String(item.pm_id).toUpperCase() === targetPmId);
      if (pm) appendBottomPoint(pm, Number(payload.ts));
    };

    socket.on("electricity:trafo_3s_saved", handleTrafo3sSaved);
    socket.on("connect", fetchBottomHistory);

    return () => {
      socket.off("electricity:trafo_3s_saved", handleTrafo3sSaved);
      socket.off("connect", fetchBottomHistory);
    };
  }, [bottomTxId, isPageActive]);

  const bottomWindowRange = useMemo(() => {
    const min24h = bottomTickMs - 24 * 3600 * 1000;
    return { min: min24h, max: bottomTickMs };
  }, [bottomTickMs, bottomPointCount]);

  const voltageTrendChart = useMemo(() => {
    const is380 = bottomVoltageMode === "380v";
    const s = bottomSeriesRef.current;
    return {
      datasets: [
        {
          label: is380 ? "Fasa R-S (380V)" : "Fasa R-N (230V)",
          data: is380 ? s.vAb : s.vRn,
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: is380 ? "Fasa S-T (380V)" : "Fasa S-N (230V)",
          data: is380 ? s.vBc : s.vSn,
          borderColor: "#06b6d4",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: is380 ? "Fasa T-R (380V)" : "Fasa T-N (230V)",
          data: is380 ? s.vCa : s.vTn,
          borderColor: "#8b5cf6",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ]
    };
  }, [bottomTickMs, bottomPointCount, bottomVoltageMode]);

  const powerTrendChart = useMemo(() => {
    const s = bottomSeriesRef.current;
    return {
      datasets: [
        {
          label: "kW Total (Daya Aktif)",
          data: s.kw,
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.08)",
          borderWidth: 1.6,
          tension: 0,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
        }
      ]
    };
  }, [bottomTickMs, bottomPointCount]);

  const currentTrendChart = useMemo(() => {
    const s = bottomSeriesRef.current;
    return {
      datasets: [
        {
          label: "Fasa R (A)",
          data: s.iR,
          borderColor: "#ef4444",
          backgroundColor: "transparent",
          borderWidth: 1.3,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: "Fasa S (A)",
          data: s.iS,
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          borderWidth: 1.3,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: "Fasa T (A)",
          data: s.iT,
          borderColor: "#10b981",
          backgroundColor: "transparent",
          borderWidth: 1.3,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ]
    };
  }, [bottomTickMs, bottomPointCount]);

  const lineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    parsing: false as const,
    normalized: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "#f8fafc" : "#0f172a",
        bodyColor: isDark ? "#94a3b8" : "#475569",
        borderColor: isDark ? "#334155" : "#e2e8f0",
        borderWidth: 1,
        padding: 6,
        callbacks: {
          title: formatWibTooltipTitle,
        },
      },
    },
    scales: {
      x: {
        type: "linear" as const,
        min: bottomWindowRange.min,
        max: bottomWindowRange.max,
        afterBuildTicks: (axis: any) => {
          const min = axis.min;
          const max = axis.max;
          if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
          const step = (max - min) / 8;
          const ticks: { value: number }[] = [];
          for (let i = 0; i <= 8; i++) {
            ticks.push({ value: Math.round(min + i * step) });
          }
          axis.ticks = ticks;
        },
        grid: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)" },
        ticks: {
          color: isDark ? "#64748b" : "#94a3b8",
          font: { size: 9 },
          maxRotation: 0,
          autoSkip: false,
          callback: (val: any) => formatWibTick(Number(val)),
        },
      },
      y: {
        grid: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)" },
        ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9 } },
      },
    },
  }), [isDark, bottomWindowRange, formatWibTick, formatWibTooltipTitle]);

  const multiLineChartOptions = useMemo(() => ({
    ...lineChartOptions,
    plugins: {
      ...lineChartOptions.plugins,
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          boxWidth: 8,
          font: { size: 9, weight: 700 },
          color: isDark ? "#94a3b8" : "#64748b"
        }
      }
    }
  }), [lineChartOptions, isDark]);

  const currentChartOptions = multiLineChartOptions;

  // Load threshold config from Postgres
  useEffect(() => {
    getJson<{ data: any[] }>("/config/electricity?configType=load_thresholds")
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          const stored = res.data.find(item => item.config_key === "thresholds");
          if (stored && stored.value) {
            setLoadConfig(stored.value);
            setFormConfig(stored.value);
          }
        }
      })
      .catch((err) => console.error("Failed to load load thresholds:", err));
  }, []);

  const handleOpenConfig = () => {
    setFormConfig(loadConfig);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await postJson("/config/electricity", {
        config_type: "load_thresholds",
        config_key: "thresholds",
        label: "Load Threshold Limits",
        value: formConfig,
        sort_order: 0,
        enabled: true
      });
      setLoadConfig(formConfig);
      setShowConfigModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save load color configurations.");
    } finally {
      setSavingConfig(false);
    }
  };

  const totalCapacityKva = useMemo(() => {
    return transformers.reduce((sum, tx) => sum + tx.capacityKva, 0);
  }, [transformers]);

  const factory1 = transformers.filter(tx => tx.factory === 1);
  const factory2 = transformers.filter(tx => tx.factory === 2);

  const totalSolarKw = useMemo(() => {
    if (solarData.poi1Kw === null && solarData.poi2Kw === null) return null;
    return Number(((solarData.poi1Kw || 0) + (solarData.poi2Kw || 0)).toFixed(1));
  }, [solarData.poi1Kw, solarData.poi2Kw]);

  const f1TotalCapacityKva = useMemo(() => {
    return factory1.reduce((sum, tx) => sum + tx.capacityKva, 0);
  }, [factory1]);

  const f1TotalKw = useMemo(() => {
    const valid = factory1.filter(tx => tx.activePowerKw !== null && tx.activePowerKw !== undefined);
    if (valid.length === 0) return null;
    return Number(valid.reduce((sum, tx) => sum + Number(tx.activePowerKw || 0), 0).toFixed(1));
  }, [factory1]);

  const f2TotalCapacityKva = useMemo(() => {
    return factory2.reduce((sum, tx) => sum + tx.capacityKva, 0);
  }, [factory2]);

  const f2TotalKw = useMemo(() => {
    const valid = factory2.filter(tx => tx.activePowerKw !== null && tx.activePowerKw !== undefined);
    if (valid.length === 0) return null;
    return Number(valid.reduce((sum, tx) => sum + Number(tx.activePowerKw || 0), 0).toFixed(1));
  }, [factory2]);

  const activeLineColor = isDark ? "#06b6d4" : "#3b82f6";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title={t("electricity.distributionSldTitle")}
          description={t("electricity.distributionSldDesc")}
        />
        <div className="flex items-center gap-4">
          {canAccessConfig && (
            <button
              onClick={handleOpenConfig}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              ⚙️ {t("electricity.configLoad")}
            </button>
          )}
          <div className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">{t("electricity.totalLoad")}</span>
            {loadingSld ? (
              <span className="inline-block h-5 w-20 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-extrabold text-amber-500">
                {NO_REALTIME_API}
              </span>
            )}
          </div>
          <div className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">{t("electricity.capacity")}</span>
            <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">
              {totalCapacityKva.toLocaleString("id-ID")} <span className="text-xs text-slate-400 font-bold">kVA</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION A: SINGLE LINE DIAGRAM ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden w-full">
        {/* SLD Header Bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-2">
            <svg style={{ width: 16, height: 16 }} className="text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Single Line Diagram</span>
          </div>
          <div className="flex items-center gap-2">
            {loadingSld ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/10 text-sky-500 border border-sky-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                Memuat SLD Real-Time...
              </span>
            ) : (
              <>
                <span
                  className="rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: "#10b981", boxShadow: "0 0 6px #10b981" }}
                />
                <span className="text-[10px] font-bold text-slate-400">Real-time</span>
              </>
            )}
          </div>
        </div>

        {/* SLD Canvas */}
        <SldScaledCanvas>
          
          {/* 1. SVG PIPELINE AND POWER LINES OVERLAY (z-20 on top so never occluded) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            <defs>
              <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
              </marker>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
              </marker>
              <marker id="arrow-orange" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
              </marker>
              <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={activeLineColor} />
              </marker>
            </defs>

            {/* --- AUXILIARY POWER ROUTING --- */}
            {/* 1. Genset Natural Gas (Center 105, 242) -> Channels down X=165 between MDP-1.1 & MDP-1.2, feeds MDP-1.2 (173, 415) and bridges over MDP-1.2 feeder (220) to MDP-2 (283, 415) */}
            <path
              d="M 105 242 L 105 253 L 165 253 L 165 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Arrowhead into left side of MDP-1.2 */}
            <path
              d="M 165 415 L 173 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />
            {/* Branch from X=165 to MDP-2 at X=275 with jumper bridge arc over MDP-1.2 feeder (X=220) */}
            <path
              d="M 165 345 L 213 345 A 7 7 0 0 1 227 345 L 275 345 L 275 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Arrowhead on second branch into left side of MDP-2 */}
            <path
              d="M 275 415 L 283 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />
            {/* Branch junction circle */}
            <circle cx="165" cy="345" r="3" fill="#10b981" />

            {/* 2. Solar PV POI-1 (Center 445, 242) -> Steps to X=505, feeds right side of MDP-3 (487, 415) */}
            <path
              d="M 445 242 L 445 253 L 505 253 L 505 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <path
              d="M 505 415 L 487 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              markerEnd="url(#arrow-red)"
            />

            {/* 3. Solar PV POI-2 (Center 930, 242) -> Steps to channel X=988 between PUTR-2 & PUTR-NEW, feeds right side of PUTR-2 (975, 415) */}
            <path
              d="M 930 242 L 930 253 L 988 253 L 988 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <path
              d="M 988 415 L 975 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              markerEnd="url(#arrow-red)"
            />

            {/* 4. Genset Diesel Fuel (Center 1095, 242) -> Steps to X=1118 along right side, feeds right side of PUTR-NEW (1100, 415) */}
            <path
              d="M 1095 242 L 1095 253 L 1118 253 L 1118 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <path
              d="M 1118 415 L 1100 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />

            {/* Main PLN line down (X=505) and split symmetrically to Factory 1 (275) & Factory 2 (760) */}
            <path d="M 505 110 L 505 126 M 275 126 L 760 126" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            <circle cx="505" cy="126" r="3" fill={activeLineColor} />
            
            {/* Feeder line into Incoming Fact-1 */}
            <path d="M 275 126 L 275 150" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            
            {/* Feeder line into Incoming Fact-2 */}
            <path d="M 760 126 L 760 150" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Total Solar PV line down (X=695) with bridge over PLN line (Y=126) and split to POI-1 (445) & POI-2 (930) */}
            <path
              d="M 695 110 L 695 119 A 7 7 0 0 1 695 133 L 695 139"
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <path
              d="M 445 139 L 753 139 A 7 7 0 0 1 767 139 L 930 139"
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <path d="M 445 139 L 445 152" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="3 2" />
            <path d="M 930 139 L 930 152" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="3 2" />
            <circle cx="695" cy="139" r="3" fill="#f97316" />

            {/* Blue lines from Incoming Feeders down to Yellow Busbars */}
            <path d="M 275 246 L 275 265" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            <path d="M 760 246 L 760 265" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Busbars: Thick Yellow Lines with Ambient Glow (Rendered IN FRONT of auxiliary lines) */}
            {/* Factory 1 Busbar (Centered at X = 275, Width = 430) */}
            <path d="M 60 265 L 490 265" fill="none" stroke="#eab308" strokeWidth="6.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(234,179,8,0.35))" }} />

            {/* Factory 2 Busbar (Centered at X = 925, Width = 360) */}
            <path d="M 745 265 L 1105 265" fill="none" stroke="#eab308" strokeWidth="6.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(234,179,8,0.35))" }} />

            {/* Factory 1: 4 Symmetrical Transformer Branches (Centers: 110, 220, 330, 440) */}
            {[110, 220, 330, 440].map((x) => (
              <g key={x}>
                <path d={`M ${x} 265 L ${x} 288`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                {/* Transformer Dual Circles with Voltage Text */}
                <circle cx={x} cy="300" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="303" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">21 kV</text>
                <circle cx={x} cy="318" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="321" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">400 V</text>
                <path d={`M ${x} 331 L ${x} 360`} fill="none" stroke={activeLineColor} strokeWidth="2" />
              </g>
            ))}

            {/* Factory 2: 3 Symmetrical Transformer Branches (Centers: 800, 925, 1050) */}
            {[800, 925, 1050].map((x) => (
              <g key={x}>
                <path d={`M ${x} 265 L ${x} 288`} fill="none" stroke={activeLineColor} strokeWidth="2" />
                {/* Transformer Dual Circles with Voltage Text */}
                <circle cx={x} cy="300" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="303" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">21 kV</text>
                <circle cx={x} cy="318" r="12.5" fill={isDark ? "#0f172a" : "#ffffff"} stroke={activeLineColor} strokeWidth="1.8" />
                <text x={x} y="321" textAnchor="middle" fill={isDark ? "#94a3b8" : "#475569"} fontSize="6.5" fontWeight="bold">400 V</text>
                <path d={`M ${x} 331 L ${x} 360`} fill="none" stroke={activeLineColor} strokeWidth="2" />
              </g>
            ))}

            {/* Collector bracket lines for Total MDP (Factory 1: 110, 220, 330, 440 -> Center 275) */}
            {[110, 220, 330, 440].map((x) => (
              <path key={`f1-tot-${x}`} d={`M ${x} 538 L ${x} 549`} fill="none" stroke={activeLineColor} strokeWidth="1.8" opacity="0.85" />
            ))}
            <path d="M 110 549 L 440 549 M 275 549 L 275 560" fill="none" stroke={activeLineColor} strokeWidth="2" opacity="0.9" />
            <circle cx="275" cy="549" r="2.5" fill={activeLineColor} />

            {/* Collector bracket lines for Total PUTR (Factory 2: 800, 925, 1050 -> Center 925) */}
            {[800, 925, 1050].map((x) => (
              <path key={`f2-tot-${x}`} d={`M ${x} 538 L ${x} 549`} fill="none" stroke="#10b981" strokeWidth="1.8" opacity="0.85" />
            ))}
            <path d="M 800 549 L 1050 549 M 925 549 L 925 560" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.9" />
            <circle cx="925" cy="549" r="2.5" fill="#10b981" />
          </svg>

          {/* 2. ABSOLUTE CARDS LAYOUT */}
          {/* Main PLN card at top left-center (Center X = 505) */}
          <div className="absolute z-30" style={{ left: 420, top: 14 }}>
            <div className={`text-center px-3 py-2 w-[170px] h-[96px] flex flex-col justify-center rounded-2xl border shadow-md transition duration-300 ${
              isDark ? "bg-blue-950/40 border-blue-500/40 text-white" : "bg-blue-50/90 border-blue-300 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-blue-600 dark:text-blue-400 tracking-wide">PLN-21 kV</div>
              <div className="text-[11px] leading-tight font-extrabold text-blue-700 dark:text-blue-300">5,540 kVa</div>
              <div className="text-[9px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse my-0.5" />
                ) : (
                  <span className={`font-extrabold ${incomingData.plnKw !== null ? "font-mono text-slate-800 dark:text-slate-200" : "text-[7px] text-amber-500"}`}>
                    {incomingData.plnKw !== null ? `${incomingData.plnKw.toLocaleString("id-ID")} kW` : NO_REALTIME_API}
                  </span>
                )}
              </div>
              <div className="text-[8px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                PF : {loadingSld ? (
                  <span className="inline-block h-2.5 w-8 bg-slate-300 dark:bg-slate-700 rounded animate-pulse align-middle" />
                ) : (
                  <span className={`font-bold ${incomingData.plnPf !== null ? "font-mono" : "text-[7px] text-amber-500"}`}>
                    {decodePf(incomingData.plnPf) !== null ? decodePf(incomingData.plnPf)!.toFixed(3) : NO_REALTIME_API}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Total Solar PV card at top right-center (Center X = 695) */}
          <div className="absolute z-30" style={{ left: 610, top: 14 }}>
            <div className={`text-center px-3 py-2 w-[170px] h-[96px] flex flex-col justify-center rounded-2xl border shadow-md transition duration-300 ${
              isDark ? "bg-orange-950/35 border-orange-500/40 text-orange-100" : "bg-orange-50/95 border-orange-300 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-orange-600 dark:text-orange-400 tracking-wide">TOTAL SOLAR PV</div>
              <div className="text-[10px] leading-tight font-extrabold text-orange-700 dark:text-orange-300">POI-1 + POI-2</div>
              <div className="text-[9px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse my-0.5" />
                ) : (
                  <span className={`text-[11px] font-extrabold ${totalSolarKw !== null ? "font-mono text-slate-800 dark:text-slate-100" : "text-[7px] text-amber-500"}`}>
                    {totalSolarKw !== null ? `${totalSolarKw.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW` : NO_REALTIME_API}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════ FACTORY 1 SOURCES (Left Wing, Symmetrical around Center = 275) ═══════════ */}
          {/* 1. Genset Natural Gas (Outer Left, Center = 105) */}
          <div className="absolute z-30" style={{ left: 40, top: 152 }}>
            <div className={`px-2.5 py-1.5 w-[130px] h-[90px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">Genset</div>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">Natural Gas</div>
              <div className="text-[10px] leading-tight font-bold text-slate-600 dark:text-slate-300 mt-0.5">1350 kVa</div>
              <div className="text-[7.5px] leading-tight text-amber-500 mt-1 font-bold">{NO_REALTIME_API}</div>
            </div>
          </div>

          {/* 2. Incoming Fact-1 (Center F1, Center = 275) */}
          <div className="absolute z-30" style={{ left: 205, top: 150 }}>
            <div className={`px-2.5 py-1.5 w-[140px] h-[96px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-blue-950/40 border-blue-500/40 text-white" : "bg-blue-50/90 border-blue-300 text-slate-800"
            }`}>
              <div className="text-[11px] leading-tight font-black text-blue-600 dark:text-blue-400">Incoming</div>
              <div className="text-[11px] leading-tight font-black text-blue-600 dark:text-blue-400">Fact-1</div>
              <div className="text-[9px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse my-0.5" />
                ) : (
                  <span className={`font-extrabold ${incomingData.wf1Kw !== null ? "font-mono text-slate-800 dark:text-slate-200" : "text-[7px] text-amber-500"}`}>
                    {incomingData.wf1Kw !== null ? `${incomingData.wf1Kw.toLocaleString("id-ID")} kW` : NO_REALTIME_API}
                  </span>
                )}
              </div>
              <div className="text-[8px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                PF : {loadingSld ? (
                  <span className="inline-block h-2.5 w-8 bg-slate-300 dark:bg-slate-700 rounded animate-pulse align-middle" />
                ) : (
                  <span className={`font-bold ${incomingData.wf1Pf !== null ? "font-mono" : "text-[7px] text-amber-500"}`}>
                    {incomingData.wf1Pf !== null ? incomingData.wf1Pf.toFixed(3) : NO_REALTIME_API}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Solar PV POI-1 (Inner Left, Center = 445) */}
          <div className="absolute z-30" style={{ left: 380, top: 152 }}>
            <div className={`px-2.5 py-1.5 w-[130px] h-[90px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">Solar PV</div>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">POI-1</div>
              <div className="text-[9px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse my-0.5" />
                ) : (
                  <span className={`font-extrabold ${solarData.poi1Kw !== null ? "font-mono text-slate-800 dark:text-slate-200" : "text-[7px] text-amber-500"}`}>
                    {solarData.poi1Kw !== null ? `${solarData.poi1Kw.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW` : NO_REALTIME_API}
                  </span>
                )}
              </div>
              <div className="text-[8px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                PF : {loadingSld ? (
                  <span className="inline-block h-2.5 w-8 bg-slate-300 dark:bg-slate-700 rounded animate-pulse align-middle" />
                ) : (
                  <span className={`font-bold ${solarData.poi1Pf !== null ? "font-mono" : "text-[7px] text-amber-500"}`}>
                    {solarData.poi1Pf !== null ? solarData.poi1Pf.toFixed(2) : NO_REALTIME_API}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════ FACTORY 2 SOURCES (Right Wing, Symmetrical around Center = 925) ═══════════ */}
          {/* 1. Incoming Fact-2 (Left F2, Center = 760) */}
          <div className="absolute z-30" style={{ left: 690, top: 150 }}>
            <div className={`px-2.5 py-1.5 w-[140px] h-[96px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-blue-950/40 border-blue-500/40 text-white" : "bg-blue-50/90 border-blue-300 text-slate-800"
            }`}>
              <div className="text-[11px] leading-tight font-black text-blue-600 dark:text-blue-400">Incoming</div>
              <div className="text-[11px] leading-tight font-black text-blue-600 dark:text-blue-400">Fact-2</div>
              <div className="text-[9px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse my-0.5" />
                ) : (
                  <span className={`font-extrabold ${incomingData.wf2Kw !== null ? "font-mono text-slate-800 dark:text-slate-200" : "text-[7px] text-amber-500"}`}>
                    {incomingData.wf2Kw !== null ? `${incomingData.wf2Kw.toLocaleString("id-ID")} kW` : NO_REALTIME_API}
                  </span>
                )}
              </div>
              <div className="text-[8px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                PF : {loadingSld ? (
                  <span className="inline-block h-2.5 w-8 bg-slate-300 dark:bg-slate-700 rounded animate-pulse align-middle" />
                ) : (
                  <span className={`font-bold ${incomingData.wf2Pf !== null ? "font-mono" : "text-[7px] text-amber-500"}`}>
                    {incomingData.wf2Pf !== null ? incomingData.wf2Pf.toFixed(3) : NO_REALTIME_API}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Solar PV POI-2 (Center F2, Center = 930) */}
          <div className="absolute z-30" style={{ left: 865, top: 152 }}>
            <div className={`px-2.5 py-1.5 w-[130px] h-[90px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">Solar PV</div>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">POI-2</div>
              <div className="text-[9px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse my-0.5" />
                ) : (
                  <span className={`font-extrabold ${solarData.poi2Kw !== null ? "font-mono text-slate-800 dark:text-slate-200" : "text-[7px] text-amber-500"}`}>
                    {solarData.poi2Kw !== null ? `${solarData.poi2Kw.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW` : NO_REALTIME_API}
                  </span>
                )}
              </div>
              <div className="text-[8px] leading-tight font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                PF : {loadingSld ? (
                  <span className="inline-block h-2.5 w-8 bg-slate-300 dark:bg-slate-700 rounded animate-pulse align-middle" />
                ) : (
                  <span className={`font-bold ${solarData.poi2Pf !== null ? "font-mono" : "text-[7px] text-amber-500"}`}>
                    {solarData.poi2Pf !== null ? solarData.poi2Pf.toFixed(2) : NO_REALTIME_API}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Genset Diesel Fuel (Outer Right, Center = 1095) */}
          <div className="absolute z-30" style={{ left: 1030, top: 152 }}>
            <div className={`px-2.5 py-1.5 w-[130px] h-[90px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition duration-300 ${
              isDark ? "bg-orange-950/30 border-orange-500/30 text-orange-200" : "bg-orange-50/90 border-orange-200 text-slate-800"
            }`}>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">Genset</div>
              <div className="text-[10px] leading-tight font-extrabold text-orange-600 dark:text-orange-400">Diesel Fuel</div>
              <div className="text-[10px] leading-tight font-bold text-slate-600 dark:text-slate-300 mt-0.5">1000 kVa</div>
              <div className="text-[7.5px] leading-tight text-amber-500 mt-1 font-bold">{NO_REALTIME_API}</div>
            </div>
          </div>

          {/* ═══════════ FACTORY 1 TRANSFORMER CARDS (4 Units: Centers 110, 220, 330, 440) ═══════════ */}
          {factory1.map((tx, idx) => {
            const cardLeft = 63 + idx * 110;
            const hasData = tx.activePowerKw !== null;
            return (
              <div key={tx.id} className="absolute z-30" style={{ left: cardLeft, top: 360, width: 94 }}>
                <div
                  onClick={() => setSelectedTx(tx)}
                  className={`rounded-2xl border p-2.5 h-[118px] flex flex-col justify-between text-center cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    idx === 0
                      ? "bg-slate-900 border-slate-700 text-white"
                      : isDark
                        ? "bg-slate-800/80 border-slate-700 text-slate-200"
                        : "bg-slate-100/90 border-slate-300 text-slate-800"
                  }`}
                >
                  <div>
                    <div className={`text-[11px] font-black leading-tight ${idx === 0 ? "text-slate-200" : "text-slate-800 dark:text-white"}`}>
                      {tx.capacityKva} kVa
                    </div>
                    <div className={`text-[9px] font-black tracking-wider uppercase leading-tight ${idx === 0 ? "text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
                      {tx.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-400 font-semibold leading-tight">Active Power</div>
                    {loadingSld ? (
                      <div className="my-0.5 space-y-1">
                        <div className="h-3 w-14 bg-slate-300 dark:bg-slate-700 rounded animate-pulse mx-auto" />
                        <div className="h-2 w-10 bg-slate-300 dark:bg-slate-700 rounded animate-pulse mx-auto" />
                      </div>
                    ) : (
                      <>
                        <div className={`${hasData ? `text-[11px] font-mono ${idx === 0 ? "text-sky-400" : "text-slate-800 dark:text-slate-100"}` : "text-[7px] text-amber-500 leading-tight"} font-extrabold`}>
                          {hasData ? `${tx.activePowerKw} kW` : NO_REALTIME_API}
                        </div>
                        <div className="text-[8px] text-slate-400 leading-tight">
                          PF: <span className={`font-bold ${tx.powerFactor === null ? "text-[6.5px] text-amber-500" : ""}`}>{tx.powerFactor !== null ? Math.abs(tx.powerFactor).toFixed(3) : NO_REALTIME_API}</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Load indicator */}
                  {(() => {
                    const txLoadPct = tx.apparentPowerKva && tx.capacityKva 
                      ? Math.round((tx.apparentPowerKva / tx.capacityKva) * 100) 
                      : (tx.activePowerKw && tx.capacityKva ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null);
                    const txLoadColor = txLoadPct !== null
                      ? (txLoadPct <= loadConfig.safeMax ? "#10b981" : txLoadPct <= loadConfig.cautionMax ? "#eab308" : "#ef4444")
                      : "#f59e0b";
                    return (
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60">
                        <div className="text-[7px] font-extrabold text-center leading-tight" style={{ color: txLoadColor }}>
                          {loadingSld ? "..." : (txLoadPct !== null ? `LOAD: ${txLoadPct}%` : `LOAD: ${NO_REALTIME_API}`)}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 400V/230V Label Box */}
                <div className="mt-1.5 text-center py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800 text-[8px] font-black text-slate-700 dark:text-slate-300 tracking-wider">
                  400V/230V
                </div>

                {/* Detail Button */}
                <button
                  onClick={() => setSelectedTx(tx)}
                  className="w-full mt-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-300/80 hover:bg-sky-500 hover:text-white dark:bg-slate-700 dark:hover:bg-sky-600 text-[9px] font-extrabold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                >
                  Detail
                </button>
              </div>
            );
          })}

          {/* ═══════════ FACTORY 2 TRANSFORMER CARDS (3 Units: Centers 800, 925, 1050) ═══════════ */}
          {factory2.map((tx, idx) => {
            const cardLeft = 750 + idx * 125;
            const hasData = tx.activePowerKw !== null;
            return (
              <div key={tx.id} className="absolute z-30" style={{ left: cardLeft, top: 360, width: 100 }}>
                <div
                  onClick={() => setSelectedTx(tx)}
                  className={`rounded-2xl border p-2.5 h-[118px] flex flex-col justify-between text-center cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    idx === 0
                      ? "bg-slate-900 border-slate-700 text-white"
                      : isDark
                        ? "bg-slate-800/80 border-slate-700 text-slate-200"
                        : "bg-slate-100/90 border-slate-300 text-slate-800"
                  }`}
                >
                  <div>
                    <div className={`text-[11px] font-black leading-tight ${idx === 0 ? "text-slate-200" : "text-slate-800 dark:text-white"}`}>
                      {tx.capacityKva} kVa
                    </div>
                    <div className={`text-[9px] font-black tracking-wider uppercase leading-tight ${idx === 0 ? "text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
                      {tx.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-400 font-semibold leading-tight">Active Power</div>
                    {loadingSld ? (
                      <div className="my-0.5 space-y-1">
                        <div className="h-3 w-14 bg-slate-300 dark:bg-slate-700 rounded animate-pulse mx-auto" />
                        <div className="h-2 w-10 bg-slate-300 dark:bg-slate-700 rounded animate-pulse mx-auto" />
                      </div>
                    ) : (
                      <>
                        <div className={`${hasData ? `text-[11px] font-mono ${idx === 0 ? "text-emerald-400" : "text-slate-800 dark:text-slate-100"}` : "text-[7px] text-amber-500 leading-tight"} font-extrabold`}>
                          {hasData ? `${tx.activePowerKw} kW` : NO_REALTIME_API}
                        </div>
                        <div className="text-[8px] text-slate-400 leading-tight">
                          PF: <span className={`font-bold ${tx.powerFactor === null ? "text-[6.5px] text-amber-500" : ""}`}>{tx.powerFactor !== null ? Math.abs(tx.powerFactor).toFixed(3) : NO_REALTIME_API}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Load indicator */}
                  {(() => {
                    const txLoadPct = tx.apparentPowerKva && tx.capacityKva 
                      ? Math.round((tx.apparentPowerKva / tx.capacityKva) * 100) 
                      : (tx.activePowerKw && tx.capacityKva ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null);
                    const txLoadColor = txLoadPct !== null
                      ? (txLoadPct <= loadConfig.safeMax ? "#10b981" : txLoadPct <= loadConfig.cautionMax ? "#eab308" : "#ef4444")
                      : "#f59e0b";
                    return (
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60">
                        <div className="text-[7px] font-extrabold text-center leading-tight" style={{ color: txLoadColor }}>
                          {loadingSld ? "..." : (txLoadPct !== null ? `LOAD: ${txLoadPct}%` : `LOAD: ${NO_REALTIME_API}`)}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 400V/230V Label Box */}
                <div className="mt-1.5 text-center py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800 text-[8px] font-black text-slate-700 dark:text-slate-300 tracking-wider">
                  400V/230V
                </div>

                {/* Detail Button */}
                <button
                  onClick={() => setSelectedTx(tx)}
                  className="w-full mt-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-300/80 hover:bg-sky-500 hover:text-white dark:bg-slate-700 dark:hover:bg-sky-600 text-[9px] font-extrabold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                >
                  Detail
                </button>
              </div>
            );
          })}

          {/* ═══════════ TOTAL MDP SUMMARY CARD (Factory 1: MDP-1.1, MDP-1.2, MDP-2, MDP-3) ═══════════ */}
          <div className="absolute z-30" style={{ left: 63, top: 560, width: 424 }}>
            <div className={`px-4 h-[52px] rounded-2xl border shadow-sm flex items-center justify-between transition duration-300 ${
              isDark ? "bg-blue-950/40 border-blue-500/40 text-white" : "bg-blue-50/90 border-blue-300 text-slate-800"
            }`}>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  TOTAL MDP (Factory 1)
                </div>
                <div className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  MDP-1.1 • MDP-1.2 • MDP-2 • MDP-3
                </div>
              </div>
              <div className="flex items-center gap-4 text-right shrink-0">
                <div>
                  <div className="text-[8px] font-bold uppercase text-slate-400 whitespace-nowrap">Total Kapasitas</div>
                  <div className="text-xs font-black font-mono text-blue-700 dark:text-blue-300 whitespace-nowrap">
                    {f1TotalCapacityKva.toLocaleString("id-ID")} kVA
                  </div>
                </div>
                <div className="pl-3 border-l border-blue-200 dark:border-blue-800/60">
                  <div className="text-[8px] font-bold uppercase text-slate-400 whitespace-nowrap">Total Active Power</div>
                  {loadingSld ? (
                    <span className="inline-block h-3.5 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse mt-0.5" />
                  ) : (
                    <div className={`text-xs font-extrabold whitespace-nowrap ${f1TotalKw !== null ? "font-mono text-sky-600 dark:text-sky-400" : "text-[8px] text-amber-500"}`}>
                      {f1TotalKw !== null ? `${f1TotalKw.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW` : NO_REALTIME_API}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════ TOTAL PUTR SUMMARY CARD (Factory 2: PUTR-1, PUTR-2, PUTR-NEW) ═══════════ */}
          <div className="absolute z-30" style={{ left: 750, top: 560, width: 350 }}>
            <div className={`px-3.5 h-[52px] rounded-2xl border shadow-sm flex items-center justify-between transition duration-300 ${
              isDark ? "bg-emerald-950/35 border-emerald-500/40 text-white" : "bg-emerald-50/90 border-emerald-300 text-slate-800"
            }`}>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  TOTAL PUTR (Factory 2)
                </div>
                <div className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  PUTR-1 • PUTR-2 • PUTR-NEW
                </div>
              </div>
              <div className="flex items-center gap-3 text-right shrink-0">
                <div>
                  <div className="text-[8px] font-bold uppercase text-slate-400 whitespace-nowrap">Total Kapasitas</div>
                  <div className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                    {f2TotalCapacityKva.toLocaleString("id-ID")} kVA
                  </div>
                </div>
                <div className="pl-3 border-l border-emerald-200 dark:border-emerald-800/60">
                  <div className="text-[8px] font-bold uppercase text-slate-400 whitespace-nowrap">Total Active Power</div>
                  {loadingSld ? (
                    <span className="inline-block h-3.5 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse mt-0.5" />
                  ) : (
                    <div className={`text-xs font-extrabold whitespace-nowrap ${f2TotalKw !== null ? "font-mono text-emerald-600 dark:text-emerald-400" : "text-[8px] text-amber-500"}`}>
                      {f2TotalKw !== null ? `${f2TotalKw.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW` : NO_REALTIME_API}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[9px] font-bold text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/40">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Online</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> {NO_REALTIME_API}</span>
            <span className="text-[8px] text-slate-500 italic ml-2">Klik panel / Detail untuk info lengkap</span>
          </div>
        </SldScaledCanvas>
      </section>

      {/* ═══════════ SECTION B: DETAIL TRANSFORMATOR CARDS (MDP) ═══════════ */}
      <section className="space-y-6">
        <div className="flex items-center gap-2.5">
          <svg style={{ width: 18, height: 18 }} className="text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
            Detail Transformator — Parameter Lengkap
          </h3>
        </div>

        {/* Factory 1 */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-[#47729f] dark:text-sky-400 uppercase tracking-widest pl-2">
            ● Factory 1 — {factory1.length} Transformator
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {factory1.map((tx) => (
              <TransformerDetailCard key={tx.id} tx={tx} factoryLabel="F1" loadConfig={loadConfig} />
            ))}
          </div>
        </div>

        {/* Factory 2 */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-[#47729f] dark:text-sky-400 uppercase tracking-widest pl-2">
            ● Factory 2 — {factory2.length} Transformator
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {factory2.map((tx) => (
              <TransformerDetailCard key={tx.id} tx={tx} factoryLabel="F2" loadConfig={loadConfig} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION: SUB-DISTRIBUTION POWER METERS (SDP) ═══════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-sky-500">⚡</span>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
              Sub-Distribution Power Meters Telemetry
            </h3>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(["ew23", "ew21", "ew22"] as const).map((grp) => (
              <button
                key={grp}
                onClick={() => { setSelectedEwGroup(grp); setEwPowerMeters([]); }}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase transition-all ${
                  selectedEwGroup === grp
                    ? "bg-white dark:bg-slate-900 text-sky-500 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {grp.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <EwPowerMetersGrid
          powerMeters={ewPowerMeters}
          isDark={isDark}
          groupId={selectedEwGroup}
          title={`Sub-Distribution ${selectedEwGroup.toUpperCase()}`}
        />
      </div>

      {/* ═══════════ SECTION C: HISTORICAL TREND BOTTOM CHARTS ═══════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sky-500 font-bold">📈</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("electricity.trafoRecords")}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              {t("electricity.trafoBadge")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bottomTxId}
              onChange={(e) => setBottomTxId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer"
            >
              {transformers.map(t => (
                <option key={t.id} value={t.id}>{t.factory === 1 ? "F1" : "F2"} {t.name}</option>
              ))}
            </select>
            <span className={`w-20 inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border transition-colors ${
              bottomTx?.status === "online"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20"
            }`}>
              {bottomTx?.status === "online" ? "● ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* 3 Line Charts */}
        <div className="grid gap-6 grid-cols-1">
          {/* Voltage */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {t("electricity.voltageRecord")} {bottomVoltageMode === "380v" ? t("electricity.voltage380Label") : t("electricity.voltage230Label")}
                </h4>
                {loadingBottomHistory && <span className="text-[10px] text-sky-500 font-bold animate-pulse">Memuat...</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBottomVoltageMode("380v")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                      bottomVoltageMode === "380v"
                        ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    380V (L-L)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomVoltageMode("230v")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                      bottomVoltageMode === "230v"
                        ? "bg-white dark:bg-slate-700 text-cyan-500 shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    230V (L-N)
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setBottomZoomChart("voltage")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition cursor-pointer"
                  title={t("electricity.zoomVoltageChart")}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  <span>Perbesar</span>
                </button>
              </div>
            </div>
            <div className="h-[175px] w-full">
              {bottomVoltageMode === "230v" ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-amber-500/30 bg-amber-500/5 rounded-xl">
                  <span className="text-xs font-extrabold text-amber-500 dark:text-amber-400 font-mono tracking-wider">{NO_REALTIME_API}</span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Tag tegangan 230V (L-N) belum tersedia dari API Power Meter ({bottomTx?.name}).
                  </p>
                </div>
              ) : bottomPointCount > 0 ? (
                <TradingViewChart
                  data={voltageTrendChart}
                  options={multiLineChartOptions}
                  defaultRange={bottomWindowRange}
                  isDark={isDark}
                  resetKey={`${bottomTxId}-voltage-${bottomVoltageMode}`}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">{NO_REALTIME_API}</span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Belum ada riwayat tegangan tersimpan hari ini.</p>
                </div>
              )}
            </div>
          </div>

          {/* Daya Aktif */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t("electricity.activePowerRecord")}</h4>
              <div className="flex items-center gap-2">
                {loadingBottomHistory && <span className="text-[10px] text-sky-500 font-bold animate-pulse">Memuat...</span>}
                <button
                  type="button"
                  onClick={() => setBottomZoomChart("power")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition cursor-pointer"
                  title={t("electricity.zoomPowerChart")}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  <span>Perbesar</span>
                </button>
              </div>
            </div>
            <div className="h-[175px] w-full">
              {bottomPointCount > 0 ? (
                <TradingViewChart
                  data={powerTrendChart}
                  options={lineChartOptions}
                  defaultRange={bottomWindowRange}
                  isDark={isDark}
                  resetKey={`${bottomTxId}-power`}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">{NO_REALTIME_API}</span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Belum ada riwayat daya aktif tersimpan hari ini.</p>
                </div>
              )}
            </div>
          </div>

          {/* Ampere */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t("electricity.ampereRecord")}</h4>

              </div>
              <div className="flex items-center gap-2">
                {loadingBottomHistory && <span className="text-[10px] text-sky-500 font-bold animate-pulse">Memuat...</span>}
                <button
                  type="button"
                  onClick={() => setBottomZoomChart("current")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition cursor-pointer"
                  title={t("electricity.zoomAmpereChart")}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  <span>Perbesar</span>
                </button>
              </div>
            </div>
            <div className="h-[180px] w-full">
              {bottomPointCount > 0 ? (
                <TradingViewChart
                  data={currentTrendChart}
                  options={currentChartOptions}
                  defaultRange={bottomWindowRange}
                  isDark={isDark}
                  resetKey={`${bottomTxId}-current`}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">{NO_REALTIME_API}</span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Belum ada riwayat arus tersimpan hari ini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ZOOM MODAL FOR SECTION C */}
      {bottomZoomChart && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
          onClick={() => setBottomZoomChart(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col space-y-4 overflow-hidden"
            style={{ width: "90vw", maxWidth: "1480px", height: "85vh", maxHeight: "86vh", padding: "1.25rem 1.5rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                    {bottomZoomChart === "voltage"
                      ? `Voltage Record (V) — ${bottomVoltageMode === "380v" ? "Tegangan 380V" : "Tegangan 230V"}`
                      : bottomZoomChart === "power"
                      ? "Daya Aktif Record — kW Total (kW)"
                      : "Ampere Record (A) — 3 Fasa (R, S, T)"}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold">
                    {bottomTx?.factory === 1 ? "F1" : "F2"} {bottomTx?.name}
                  </span>

                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                    Rentang: 24 Jam Terakhir (Rolling Sliding Window)
                  </span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    • Resolusi 1 Detik (Real-Time Buffer & Historikal)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {bottomZoomChart === "voltage" && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setBottomVoltageMode("380v")}
                      className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                        bottomVoltageMode === "380v"
                          ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {t("electricity.voltage380Label")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomVoltageMode("230v")}
                      className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                        bottomVoltageMode === "230v"
                          ? "bg-white dark:bg-slate-700 text-cyan-500 shadow-sm"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {t("electricity.voltage230Label")}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setBottomZoomChart(null)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                  title="Tutup Modal"
                >
                  <span>{t("common.close")}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body: Large Chart */}
            <div className="relative w-full flex-1 min-h-[420px] sm:min-h-[460px]">
              {bottomZoomChart === "voltage" ? (
                bottomVoltageMode === "230v" ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-amber-500/30 bg-amber-500/5 rounded-2xl">
                    <span className="text-sm font-extrabold text-amber-500 dark:text-amber-400 font-mono tracking-wider">{NO_REALTIME_API}</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Tag tegangan 230V (L-N) belum tersedia dari API Power Meter ({bottomTx?.name}).
                    </p>
                  </div>
                ) : (
                  <TradingViewChart
                    data={voltageTrendChart}
                    options={multiLineChartOptions}
                    defaultRange={bottomWindowRange}
                    isDark={isDark}
                    resetKey={`zoom-${bottomTxId}-voltage-${bottomVoltageMode}`}
                  />
                )
              ) : bottomZoomChart === "power" ? (
                <TradingViewChart
                  data={powerTrendChart}
                  options={lineChartOptions}
                  defaultRange={bottomWindowRange}
                  isDark={isDark}
                  resetKey={`zoom-${bottomTxId}-power`}
                />
              ) : (
                <TradingViewChart
                  data={currentTrendChart}
                  options={currentChartOptions}
                  defaultRange={bottomWindowRange}
                  isDark={isDark}
                  resetKey={`zoom-${bottomTxId}-current`}
                />
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs text-slate-400">
              <span>{t("electricity.syncNote")}</span>
              <span className="text-[11px]">Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] border border-slate-200 dark:border-slate-700">ESC</kbd> untuk menutup</span>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL IF OPENED */}
      {selectedTx && (
        <DetailRecordModal
          transformer={transformers.find(t => t.id === selectedTx.id) as any}
          onClose={() => setSelectedTx(null)}
          isDark={isDark}
          coverageList={customCoverage[selectedTx.id] || COVERED_EQUIPMENT[selectedTx.id] || []}
          onSaveSpecs={(specs) => handleSaveSpecs(selectedTx.id, specs)}
          onSaveCoverage={(items) => handleSaveCoverage(selectedTx.id, items)}
        />
      )}

      {/* CONFIG LOAD LIMITS MODAL */}
      {canAccessConfig && showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">
                ⚙️ Config Threshold Load
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-emerald-500 block mb-1">Aman (Hijau) - Batas Maks (%)</label>
                <input
                  type="number"
                  value={formConfig.safeMax}
                  onChange={(e) => setFormConfig({ ...formConfig, safeMax: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-amber-500 block mb-1">Waspada (Kuning) - Batas Maks (%)</label>
                <input
                  type="number"
                  value={formConfig.cautionMax}
                  onChange={(e) => setFormConfig({ ...formConfig, cautionMax: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-rose-500 block mb-1">Bahaya (Merah) - Batas Maks (%)</label>
                <input
                  type="number"
                  value={formConfig.dangerMax}
                  disabled
                  className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-400 dark:text-slate-500 outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-colors shadow-md shadow-sky-500/20"
              >
                {savingConfig ? "Saving..." : "💾 Simpan Config"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
