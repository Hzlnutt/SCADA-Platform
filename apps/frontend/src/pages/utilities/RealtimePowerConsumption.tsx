import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import { useLanguageStore } from "../../store/language.store";
import { PM_NAME_MAPPING, getPmSortIndex } from "../../data/pmMapping";
import {
  SeniorUnitHeadConfigModal,
  type ConsumptionFactCategory
} from "../../components/electricity/SeniorUnitHeadConfigModal";

interface ElectricPmItem {
  id: number;
  t_stamp: string;
  group_id: string;
  pm_id: string;
  status: boolean;
  volt_ab: number | null;
  volt_bc: number | null;
  volt_ca: number | null;
  volt_ll: number | null;
  current_a: number | null;
  current_b: number | null;
  current_c: number | null;
  frequency: number | null;
  active_power_total: number | null;
  reactive_power_total: number | null;
  apparent_power_total: number | null;
  power_factor: number | null;
  voltage_unbalance: number | null;
  current_unbalance: number | null;
  thd_volt_a: number | null;
  thd_volt_b: number | null;
  thd_volt_c: number | null;
  thd_current_a: number | null;
  thd_current_b: number | null;
  thd_current_c: number | null;
  active_energy: number | null;
}

interface ChartBarRow {
  pmId: string;
  numId: number;
  machineName: string;
  displayLabel: string;
  value: number;
  kw: number;
  kwh: number;
  kva: number;
  pf: number;
  volt: number;
  online: boolean;
  groupId: string;
}

interface MonthlyBatchResponse {
  currentMonth: string;
  comparisonMonth: string;
  data: Record<
    string,
    {
      pmId: string;
      label: string;
      currTotalKwh: number;
      prevTotalKwh: number;
      hasData: boolean;
    }
  >;
}

/**
 * Aggregate transformer / main distribution panels (MDP & PUTR & Incoming Cubicles)
 * that must be excluded because they represent combined feeder totals rather than machines.
 */
const AGGREGATE_PANEL_PM_IDS = new Set([
  "PM133", // F1 MDP3
  "PM135", // F1 MDP-2
  "PM136", // F1 MDP-1.2
  "PM139", // F1 MDP-1.1
  "PM201", // F2 PUTR-1
  "PM202", // F2 PUTR-2
  "PM327", // F2 PUTR-NEW
  "PM410", // Incoming Cubicle WF2
  "PM411", // Incoming Cubicle PLN
  "PM412"  // Incoming Cubicle WF1
]);

function isAggregatePanelPm(pmId: string, label?: string): boolean {
  const cleanId = String(pmId || "").toUpperCase().trim();
  const numPart = cleanId.replace(/\D/g, "");
  const normId = numPart ? `PM${numPart}` : cleanId;
  if (AGGREGATE_PANEL_PM_IDS.has(normId) || AGGREGATE_PANEL_PM_IDS.has(cleanId)) {
    return true;
  }
  const mappedName = numPart ? PM_NAME_MAPPING[numPart]?.name || "" : "";
  const combinedLabel = `${label || ""} ${mappedName}`;
  return /(\bMDP|\bPUTR|incoming cubicle)/i.test(combinedLabel);
}

function getCurrentWibMonthStr(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit"
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value || String(new Date().getFullYear());
    const m = parts.find((p) => p.type === "month")?.value || String(new Date().getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
}

function formatMonthPeriodLabel(monthStr: string, lang: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return monthStr;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    month: "long",
    year: "numeric"
  });
}

function buildDefaultCategories(factory: 1 | 2): ConsumptionFactCategory[] {
  const list: ConsumptionFactCategory[] = [];
  let idx = 1;
  for (const [numStr, info] of Object.entries(PM_NAME_MAPPING)) {
    const num = parseInt(numStr, 10);
    if (isNaN(num)) continue;
    const isFact1 = num >= 100 && num < 200;
    const isFact2 = num >= 200 && num < 400;
    if ((factory === 1 && !isFact1) || (factory === 2 && !isFact2)) continue;

    const pmId = `PM${numStr}`;
    const name = info.name;
    if (isAggregatePanelPm(pmId, name)) continue;

    const groupId = isFact1 ? "ew21" : num < 300 ? "ew22" : "ew23";
    const configType = factory === 1 ? "realtime_fact_1" : "realtime_fact_2";

    list.push({
      id: -(factory * 1000 + idx),
      config_type: configType,
      config_key: pmId.toLowerCase(),
      label: `${name} (${pmId})`,
      value: {
        endpoint_url: `electric_${groupId}`,
        json_key: pmId,
        pm_id: pmId,
        department: "Utility",
        factory: factory === 1 ? "consumption_fact_1" : "consumption_fact_2",
        kWh: 0
      },
      sort_order: idx,
      enabled: true
    });
    idx++;
  }
  return list;
}

const DEFAULT_FACT1_CATEGORIES = buildDefaultCategories(1);
const DEFAULT_FACT2_CATEGORIES = buildDefaultCategories(2);

/**
 * Seed initial dictionary from PM_NAME_MAPPING (excluding MDP & PUTR aggregate panels)
 * so all machine meters are represented immediately on load.
 */
function buildInitialPmMap(): Record<string, ElectricPmItem> {
  const initial: Record<string, ElectricPmItem> = {};
  for (const numId of Object.keys(PM_NAME_MAPPING)) {
    const num = parseInt(numId, 10);
    if (isNaN(num) || num >= 400) continue;
    const pmKey = `PM${numId}`;
    if (isAggregatePanelPm(pmKey, PM_NAME_MAPPING[numId]?.name)) continue;
    const groupId = num >= 100 && num < 200 ? "ew21" : num >= 200 && num < 300 ? "ew22" : "ew23";
    initial[pmKey] = {
      id: num,
      t_stamp: new Date().toISOString(),
      group_id: groupId,
      pm_id: pmKey,
      status: false,
      volt_ab: null,
      volt_bc: null,
      volt_ca: null,
      volt_ll: null,
      current_a: null,
      current_b: null,
      current_c: null,
      frequency: null,
      active_power_total: 0,
      reactive_power_total: null,
      apparent_power_total: 0,
      power_factor: 0,
      voltage_unbalance: null,
      current_unbalance: null,
      thd_volt_a: null,
      thd_volt_b: null,
      thd_volt_c: null,
      thd_current_a: null,
      thd_current_b: null,
      thd_current_c: null,
      active_energy: 0
    };
  }
  return initial;
}

/**
 * Compute nice X-axis ticks similar to the Electricity Overview chart
 */
function buildNiceTicks(maxValue: number): { domainMax: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { domainMax: 100, ticks: [0, 20, 40, 60, 80, 100] };
  }
  const rawStep = maxValue / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceStep = magnitude;
  if (residual > 5) niceStep = 10 * magnitude;
  else if (residual > 2) niceStep = 5 * magnitude;
  else if (residual > 1) niceStep = 2 * magnitude;

  if (niceStep < 1) niceStep = 1;
  const domainMax = Math.ceil((maxValue * 1.08) / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = 0; v <= domainMax; v += niceStep) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { domainMax, ticks };
}

function cleanDisplayMachineLabel(pmId: string, rawLabel?: string): string {
  const numPart = pmId.replace(/\D/g, "");
  const defaultName = (numPart && PM_NAME_MAPPING[numPart]?.name) || pmId;
  if (!rawLabel) return `${pmId} — ${defaultName}`;

  // Strip redundant "(PMxxx)" or leading "PMxxx — " so we format uniformly as "PMxxx — NAME"
  let cleaned = rawLabel
    .replace(new RegExp(`\\(\\s*${pmId}\\s*\\)`, "ig"), "")
    .replace(new RegExp(`^\\s*${pmId}\\s*[-—:]\\s*`, "i"), "")
    .trim();
  if (!cleaned) cleaned = defaultName;
  return `${pmId} — ${cleaned}`;
}

export const RealtimePowerConsumption: React.FC = () => {
  const theme = useSystemStore((state) => state.theme);
  const language = useLanguageStore((state) => state.language);
  const isDark = theme === "dark";

  const [pmDataMap, setPmDataMap] = useState<Record<string, ElectricPmItem>>(() => buildInitialPmMap());
  const [monthlyKwhMap, setMonthlyKwhMap] = useState<Record<string, number>>({});
  const [currentMonthStr, setCurrentMonthStr] = useState<string>(() => getCurrentWibMonthStr());
  const [factCategories1, setFactCategories1] = useState<ConsumptionFactCategory[]>(DEFAULT_FACT1_CATEGORIES);
  const [factCategories2, setFactCategories2] = useState<ConsumptionFactCategory[]>(DEFAULT_FACT2_CATEGORIES);

  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Senior Unit Head item configuration modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modalInitialFact, setModalInitialFact] = useState<"consumption_fact_1" | "consumption_fact_2">(
    "consumption_fact_1"
  );

  // Track initial active_energy baseline per PM during the current session between 30s monthly batch refreshes
  const energyBaselineRef = useRef<Record<string, number>>({});
  const isFetchingRef = useRef(false);

  const formatKw = (val: number) =>
    val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  const formatKwh = (val: number) =>
    val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  // Fetch PM display configuration (realtime_fact_1 & realtime_fact_2)
  const refreshFactCategories = useCallback(() => {
    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=realtime_fact_1")
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setFactCategories1(
            res.data.filter((item) => {
              const pmId = String(item.value?.pm_id || item.value?.json_key || item.config_key || "").toUpperCase();
              return !isAggregatePanelPm(pmId, item.label);
            })
          );
        }
      })
      .catch(() => {});

    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=realtime_fact_2")
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setFactCategories2(
            res.data.filter((item) => {
              const pmId = String(item.value?.pm_id || item.value?.json_key || item.config_key || "").toUpperCase();
              return !isAggregatePanelPm(pmId, item.label);
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  // Fetch 1-month cumulative kWh batch (resets automatically to 0 when WIB calendar month rolls over)
  const fetchMonthlyCumulativeBatch = useCallback(async (forceRefresh = false) => {
    const activeWibMonth = getCurrentWibMonthStr();
    setCurrentMonthStr(activeWibMonth);
    try {
      const res = await getJson<MonthlyBatchResponse>(
        `/analytics/electricity/equipment-monthly-batch?currentMonth=${encodeURIComponent(activeWibMonth)}${
          forceRefresh ? "&force=true" : ""
        }`
      );
      if (res?.data) {
        const nextMap: Record<string, number> = {};
        for (const [key, item] of Object.entries(res.data)) {
          if (item && typeof item.currTotalKwh === "number") {
            const upKey = key.toUpperCase();
            nextMap[upKey] = Math.max(0, item.currTotalKwh);
            if (item.pmId) {
              nextMap[item.pmId.toUpperCase()] = Math.max(0, item.currTotalKwh);
            }
          }
        }
        // Reset progressive delta baseline whenever fresh batch totals arrive
        energyBaselineRef.current = {};
        setMonthlyKwhMap(nextMap);
      }
    } catch {}
  }, []);

  const mergeTelemetryList = useCallback((list: ElectricPmItem[]) => {
    if (!Array.isArray(list) || list.length === 0) return;
    setPmDataMap((prev) => {
      const next = { ...prev };
      for (const item of list) {
        if (!item?.pm_id) continue;
        const rawId = String(item.pm_id).toUpperCase().trim();
        const numPart = rawId.replace(/\D/g, "");
        const key = numPart ? `PM${numPart}` : rawId;
        if (isAggregatePanelPm(key)) continue;
        next[key] = { ...item, pm_id: key };

        // Track live incremental energy delta between 30s batch refreshes
        if (typeof item.active_energy === "number" && item.active_energy > 0) {
          if (energyBaselineRef.current[key] === undefined) {
            energyBaselineRef.current[key] = item.active_energy;
          }
        }
      }
      return next;
    });
    setLastUpdated(new Date());
  }, []);

  const fetchAllLatest = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const resAll = await getJson<{ data: ElectricPmItem[] }>(
        "/analytics/electricity/power-meters?group=all"
      );
      if (resAll?.data && resAll.data.length > 0) {
        mergeTelemetryList(resAll.data);
      } else {
        const [r1, r2, r3] = await Promise.all([
          getJson<{ data: ElectricPmItem[] }>("/analytics/electricity/power-meters?group=ew21"),
          getJson<{ data: ElectricPmItem[] }>("/analytics/electricity/power-meters?group=ew22"),
          getJson<{ data: ElectricPmItem[] }>("/analytics/electricity/power-meters?group=ew23")
        ]);
        mergeTelemetryList([...(r1?.data || []), ...(r2?.data || []), ...(r3?.data || [])]);
      }
    } catch {
      // Retain last valid telemetry state on transient network error
    } finally {
      isFetchingRef.current = false;
    }
  }, [mergeTelemetryList]);

  useEffect(() => {
    refreshFactCategories();
    fetchAllLatest();
    fetchMonthlyCumulativeBatch(false);

    const pollInterval = setInterval(fetchAllLatest, 3000);
    const monthlyPollInterval = setInterval(() => fetchMonthlyCumulativeBatch(false), 30000);

    const socket = getSocket();
    const handleLivePm = (payload: { group: string; data: ElectricPmItem[] }) => {
      if (payload?.data && Array.isArray(payload.data)) {
        mergeTelemetryList(payload.data);
      }
    };

    socket.on("electric:pm_telemetry", handleLivePm);
    return () => {
      clearInterval(pollInterval);
      clearInterval(monthlyPollInterval);
      socket.off("electric:pm_telemetry", handleLivePm);
    };
  }, [fetchAllLatest, fetchMonthlyCumulativeBatch, mergeTelemetryList, refreshFactCategories]);

  const handleConfigRefresh = useCallback(() => {
    refreshFactCategories();
    fetchAllLatest();
    fetchMonthlyCumulativeBatch(true);
  }, [refreshFactCategories, fetchAllLatest, fetchMonthlyCumulativeBatch]);

  const openManageModal = (fact: "consumption_fact_1" | "consumption_fact_2") => {
    setModalInitialFact(fact);
    setShowConfigModal(true);
  };

  /**
   * Build base rows for Factory 1 and Factory 2 from active/enabled configuration items
   * (excluding all MDP & PUTR aggregate distribution panels).
   */
  const {
    factory1RealtimeRows,
    factory2RealtimeRows,
    factory1CumulativeRows,
    factory2CumulativeRows,
    f1TotalKw,
    f2TotalKw,
    f1TotalKwh,
    f2TotalKwh,
    f1OnlineCount,
    f2OnlineCount
  } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const buildFactoryRows = (configItems: ConsumptionFactCategory[], defaultGroupId: string): ChartBarRow[] => {
      const enabledItems = configItems.filter((c) => c.enabled !== false);
      const seenPmIds = new Set<string>();
      const rows: ChartBarRow[] = [];

      for (const cfg of enabledItems) {
        const rawPm = String(cfg.value?.pm_id || cfg.value?.json_key || cfg.config_key || "")
          .toUpperCase()
          .trim();
        const numPart = rawPm.replace(/\D/g, "");
        const pmId = numPart ? `PM${numPart}` : rawPm;
        if (!pmId || seenPmIds.has(pmId)) continue;
        if (isAggregatePanelPm(pmId, cfg.label)) continue;
        seenPmIds.add(pmId);

        const numId = parseInt(numPart || "999", 10);
        const displayLabel = cleanDisplayMachineLabel(pmId, cfg.label);
        const machineName = displayLabel.replace(new RegExp(`^${pmId}\\s*—\\s*`, "i"), "");

        if (q && !pmId.toLowerCase().includes(q) && !displayLabel.toLowerCase().includes(q)) {
          continue;
        }

        const telemetry = pmDataMap[pmId];
        const kw =
          telemetry?.active_power_total !== null && telemetry?.active_power_total !== undefined
            ? Math.max(0, Number(telemetry.active_power_total))
            : 0;
        const kva =
          telemetry?.apparent_power_total !== null && telemetry?.apparent_power_total !== undefined
            ? Math.max(0, Number(telemetry.apparent_power_total))
            : 0;
        const pf =
          telemetry?.power_factor !== null && telemetry?.power_factor !== undefined
            ? Math.abs(Number(telemetry.power_factor))
            : 0;
        const volt =
          telemetry?.volt_ll ?? telemetry?.volt_ab ?? telemetry?.volt_bc ?? telemetry?.volt_ca ?? 0;
        const online = Boolean(telemetry?.status);

        // 1-month cumulative kWh from batch analytics + any live session delta since last 30s batch poll
        const baseMonthKwh =
          monthlyKwhMap[pmId] !== undefined
            ? monthlyKwhMap[pmId]
            : typeof cfg.value?.kWh === "number"
              ? Math.max(0, cfg.value.kWh)
              : 0;

        let liveSessionDelta = 0;
        if (
          typeof telemetry?.active_energy === "number" &&
          telemetry.active_energy > 0 &&
          energyBaselineRef.current[pmId] !== undefined
        ) {
          const diff = telemetry.active_energy - energyBaselineRef.current[pmId];
          if (diff > 0 && diff < 500) {
            liveSessionDelta = diff;
          }
        }
        const kwh = Math.round((baseMonthKwh + liveSessionDelta) * 100) / 100;

        rows.push({
          pmId,
          numId: isNaN(numId) ? 999 : numId,
          machineName,
          displayLabel,
          value: kw,
          kw,
          kwh,
          kva,
          pf,
          volt: Number(volt) || 0,
          online,
          groupId: telemetry?.group_id || defaultGroupId
        });
      }

      return rows;
    };

    const baseF1 = buildFactoryRows(factCategories1, "ew21");
    const baseF2 = buildFactoryRows(factCategories2, "ew22");

    // Sort Realtime kW rows descending by highest active kW consumer
    const sortByRealtimeKw = (a: ChartBarRow, b: ChartBarRow) => {
      if (b.kw !== a.kw) return b.kw - a.kw;
      return getPmSortIndex(a.pmId) - getPmSortIndex(b.pmId);
    };

    // Sort Monthly Cumulative kWh rows independently descending by highest cumulative kWh consumer
    const sortByCumulativeKwh = (a: ChartBarRow, b: ChartBarRow) => {
      if (b.kwh !== a.kwh) return b.kwh - a.kwh;
      if (b.kw !== a.kw) return b.kw - a.kw;
      return getPmSortIndex(a.pmId) - getPmSortIndex(b.pmId);
    };

    const f1Realtime = [...baseF1].sort(sortByRealtimeKw).map((r) => ({ ...r, value: r.kw }));
    const f2Realtime = [...baseF2].sort(sortByRealtimeKw).map((r) => ({ ...r, value: r.kw }));

    const f1Cumulative = [...baseF1].sort(sortByCumulativeKwh).map((r) => ({ ...r, value: r.kwh }));
    const f2Cumulative = [...baseF2].sort(sortByCumulativeKwh).map((r) => ({ ...r, value: r.kwh }));

    return {
      factory1RealtimeRows: f1Realtime,
      factory2RealtimeRows: f2Realtime,
      factory1CumulativeRows: f1Cumulative,
      factory2CumulativeRows: f2Cumulative,
      f1TotalKw: baseF1.reduce((acc, r) => acc + r.kw, 0),
      f2TotalKw: baseF2.reduce((acc, r) => acc + r.kw, 0),
      f1TotalKwh: baseF1.reduce((acc, r) => acc + r.kwh, 0),
      f2TotalKwh: baseF2.reduce((acc, r) => acc + r.kwh, 0),
      f1OnlineCount: baseF1.filter((r) => r.online).length,
      f2OnlineCount: baseF2.filter((r) => r.online).length
    };
  }, [pmDataMap, monthlyKwhMap, factCategories1, factCategories2, searchQuery]);

  const f1KwMax = useMemo(
    () => (factory1RealtimeRows.length > 0 ? Math.max(...factory1RealtimeRows.map((r) => r.kw), 10) : 100),
    [factory1RealtimeRows]
  );
  const f2KwMax = useMemo(
    () => (factory2RealtimeRows.length > 0 ? Math.max(...factory2RealtimeRows.map((r) => r.kw), 10) : 100),
    [factory2RealtimeRows]
  );
  const f1KwhMax = useMemo(
    () => (factory1CumulativeRows.length > 0 ? Math.max(...factory1CumulativeRows.map((r) => r.kwh), 10) : 100),
    [factory1CumulativeRows]
  );
  const f2KwhMax = useMemo(
    () => (factory2CumulativeRows.length > 0 ? Math.max(...factory2CumulativeRows.map((r) => r.kwh), 10) : 100),
    [factory2CumulativeRows]
  );

  const f1KwScale = useMemo(() => buildNiceTicks(f1KwMax), [f1KwMax]);
  const f2KwScale = useMemo(() => buildNiceTicks(f2KwMax), [f2KwMax]);
  const f1KwhScale = useMemo(() => buildNiceTicks(f1KwhMax), [f1KwhMax]);
  const f2KwhScale = useMemo(() => buildNiceTicks(f2KwhMax), [f2KwhMax]);

  const activePeriodLabel = useMemo(
    () => formatMonthPeriodLabel(currentMonthStr, language),
    [currentMonthStr, language]
  );

  const renderHorizontalBarChart = (
    title: string,
    subtitle: string,
    gatewayBadge: string,
    rows: ChartBarRow[],
    totalValue: number,
    unit: "kW" | "kWh",
    badgeInfo: string,
    scale: { domainMax: number; ticks: number[] },
    barGradient: string,
    badgeThemeClass: string,
    factKey: "consumption_fact_1" | "consumption_fact_2"
  ) => {
    const formatVal = unit === "kW" ? formatKw : formatKwh;

    return (
      <div
        className={`h-full rounded-2xl border p-4 sm:p-6 shadow-sm transition-colors flex flex-col justify-between ${
          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-200/90"
        }`}
      >
        {/* Card Header matching Electricity Overview Horizontal Bar Chart style */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase text-slate-800 dark:text-slate-100">
                {title}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${badgeThemeClass}`}>
                Total: {formatVal(totalValue)} {unit}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {gatewayBadge}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {badgeInfo}
            </span>
            <button
              type="button"
              onClick={() => openManageModal(factKey)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 transition cursor-pointer shadow-2xs"
              title="Kelola tampilan item Power Meter atau tambahkan PM baru dengan API baru"
            >
              <span>⚙️</span>
              <span>{language === "id" ? "Kelola Item" : "Manage Items"}</span>
            </button>
          </div>
        </div>

        {/* Horizontal Bar Chart Area (stretches equally on both left & right cards) */}
        <div className="mt-4 flex-1 flex flex-col overflow-x-auto scrollbar-thin">
          <div className="min-w-[540px] flex-1 flex flex-col">
            {rows.length === 0 ? (
              <div className="py-12 my-auto text-center text-xs text-slate-400">
                {language === "id"
                  ? "Tidak ada Power Meter yang aktif atau sesuai pencarian. Klik '⚙️ Kelola Item' untuk mengatur tampilan."
                  : "No active Power Meter matches the filter. Click '⚙️ Manage Items' to configure display."}
              </div>
            ) : (
              <div className="relative flex-1 flex flex-col justify-between">
                {/* Vertical Grid Lines & Bars Area */}
                <div className="flex flex-1">
                  <div className="w-[215px] sm:w-[245px] shrink-0" />
                  <div className="relative flex-1 flex flex-col">
                    <div className="absolute inset-0 flex justify-between pointer-events-none">
                      {scale.ticks.map((tick) => (
                        <div
                          key={tick}
                          className="h-full border-r border-dashed border-slate-200/80 dark:border-slate-800/90 first:border-l first:border-r-0"
                        />
                      ))}
                    </div>

                    {/* Bars List distributes evenly across full card height so left & right cards align top-to-bottom */}
                    <div className="relative z-10 flex-1 flex flex-col justify-between gap-1.5 py-1">
                      {rows.map((row, idx) => {
                        const pct =
                          scale.domainMax > 0
                            ? Math.min(100, Math.max(0, (row.value / scale.domainMax) * 100))
                            : 0;
                        const isTopConsumer = idx === 0 && row.value > 0;

                        return (
                          <div
                            key={row.pmId}
                            className="group flex items-center gap-3 min-h-[24px] hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-lg px-1 -mx-1 transition-colors"
                            title={`${row.displayLabel} | Realtime: ${formatKw(row.kw)} kW | Akumulasi Bulan Ini: ${formatKwh(row.kwh)} kWh | ${formatKw(row.kva)} kVA | PF: ${row.pf.toFixed(2)} | ${Math.round(row.volt)} V`}
                          >
                            {/* Left Y-Axis Label (moved via negative margin into the reserved label column) */}
                            <div className="-ml-[215px] sm:-ml-[245px] w-[205px] sm:w-[235px] shrink-0 pr-2 text-right flex items-center justify-end gap-1.5">
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                                  row.online ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                                }`}
                              />
                              <span
                                className={`text-[11px] leading-tight truncate ${
                                  isTopConsumer
                                    ? "font-extrabold text-slate-900 dark:text-white"
                                    : "font-semibold text-slate-600 dark:text-slate-300"
                                }`}
                              >
                                {row.displayLabel}
                              </span>
                            </div>

                            {/* Horizontal Bar Track */}
                            <div className="flex-1 flex items-center gap-2 pr-14">
                              <div className="w-full bg-slate-100/80 dark:bg-slate-800/60 h-4 rounded-r-md overflow-hidden flex items-center">
                                <div
                                  className={`h-full rounded-r-md transition-all duration-500 ${barGradient} ${
                                    row.value > 0 ? "min-w-[4px]" : "w-0"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span
                                className={`text-[11px] font-mono whitespace-nowrap shrink-0 ${
                                  row.value > 0
                                    ? "font-extrabold text-slate-700 dark:text-slate-200"
                                    : "font-medium text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                {formatVal(row.value)} {unit}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* X-Axis Ticks Footer pinned cleanly at the bottom of both cards */}
                <div className="flex items-center pt-2 mt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="w-[215px] sm:w-[245px] shrink-0 text-right pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {unit === "kW"
                      ? language === "id"
                        ? "Skala Daya (kW)"
                        : "Power Scale (kW)"
                      : language === "id"
                        ? "Skala Energi (kWh)"
                        : "Energy Scale (kWh)"}
                  </div>
                  <div className="flex-1 flex justify-between pr-14 text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                    {scale.ticks.map((tick) => (
                      <span key={tick}>{tick.toLocaleString("id-ID")}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Top Page Header & Controls */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4 ${
          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-200/90"
        }`}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
              ⚡
            </span>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {language === "id"
                ? "Konsumsi Daya Realtime (kW) & Energi Akumulatif Bulanan (kWh)"
                : "Realtime Power (kW) & Monthly Cumulative Energy (kWh)"}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === "id"
              ? "Perbandingan konsumsi mesin tertinggi per Power Meter (tanpa panel gabungan MDP & PUTR) antara Factory 1 (Kiri) dan Factory 2 (Kanan)."
              : "Highest machine consumption comparison per Power Meter (excluding aggregate MDP & PUTR panels) between Factory 1 (Left) and Factory 2 (Right)."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === "id" ? "Cari PM atau nama mesin..." : "Search PM or machine name..."
              }
              className={`w-56 sm:w-64 rounded-xl border px-3 py-1.5 text-xs font-medium outline-none transition ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                  : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => openManageModal("consumption_fact_1")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition cursor-pointer"
          >
            <span>⚙️</span>
            <span>{language === "id" ? "Kelola Item & Tambah PM" : "Manage & Add PM"}</span>
          </button>

          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            Update: {lastUpdated.toLocaleTimeString("id-ID")}
          </div>
        </div>
      </div>

      {/* ROW 1: Side-by-Side Horizontal Bar Charts for REALTIME kW (Left: Factory 1, Right: Factory 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {renderHorizontalBarChart(
          language === "id" ? "FACTORY 1 CONSUMPTION (REALTIME kW)" : "FACTORY 1 CONSUMPTION (REALTIME kW)",
          language === "id"
            ? "Konsumsi daya aktif (kW) realtime Factory 1 diurutkan dari beban mesin tertinggi."
            : "Factory 1 realtime active power (kW) sorted by highest machine consumer.",
          "Gateway 1 (PM 1xx)",
          factory1RealtimeRows,
          f1TotalKw,
          "kW",
          `${f1OnlineCount}/${factory1RealtimeRows.length} Online`,
          f1KwScale,
          "bg-gradient-to-r from-[#2b6cb0] to-[#4a90d9]",
          "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
          "consumption_fact_1"
        )}

        {renderHorizontalBarChart(
          language === "id" ? "FACTORY 2 CONSUMPTION (REALTIME kW)" : "FACTORY 2 CONSUMPTION (REALTIME kW)",
          language === "id"
            ? "Konsumsi daya aktif (kW) realtime Factory 2 diurutkan dari beban mesin tertinggi."
            : "Factory 2 realtime active power (kW) sorted by highest machine consumer.",
          "Gateway 2 & 3 (PM 2xx & 3xx)",
          factory2RealtimeRows,
          f2TotalKw,
          "kW",
          `${f2OnlineCount}/${factory2RealtimeRows.length} Online`,
          f2KwScale,
          "bg-gradient-to-r from-[#0891b2] to-[#06b6d4]",
          "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
          "consumption_fact_2"
        )}
      </div>

      {/* Section Divider Banner for 1-Month Cumulative Energy (kWh Akumulatif) */}
      <div
        className={`rounded-2xl border px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 ${
          isDark ? "bg-[#111827]/90 border-slate-800" : "bg-slate-50/90 border-slate-200/80"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-bold">
            📊
          </span>
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-800 dark:text-slate-100">
              {language === "id"
                ? "Konsumsi Energi Akumulatif Bulanan (kWh Akumulatif — 1 Bulan)"
                : "Monthly Cumulative Energy Consumption (1-Month Cumulative kWh)"}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === "id"
                ? "Diurutkan berdasarkan total pemakaian energi (kWh) terbesar selama bulan berjalan. Akumulasi 1 bulan penuh dan otomatis mulai kembali dari 0 kWh setiap tanggal 1 awal bulan."
                : "Sorted by highest cumulative energy (kWh) during the current calendar month. Accumulates for 1 month and automatically resets to 0 kWh on the 1st of each month."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            {language === "id"
              ? `Periode: ${activePeriodLabel} • Reset 0 Tiap Awal Bulan`
              : `Period: ${activePeriodLabel} • Resets Monthly`}
          </span>
        </div>
      </div>

      {/* ROW 2: Side-by-Side Horizontal Bar Charts for MONTHLY CUMULATIVE kWh (Left: Factory 1, Right: Factory 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {renderHorizontalBarChart(
          language === "id"
            ? "FACTORY 1 CUMULATIVE CONSUMPTION (kWh)"
            : "FACTORY 1 CUMULATIVE CONSUMPTION (kWh)",
          language === "id"
            ? `Akumulasi energi (kWh) mesin Factory 1 bulan ${activePeriodLabel} (diurutkan dari kWh tertinggi, reset 0 awal bulan).`
            : `Factory 1 monthly cumulative energy (kWh) for ${activePeriodLabel} (sorted by highest kWh, resets monthly).`,
          "Gateway 1 (PM 1xx)",
          factory1CumulativeRows,
          f1TotalKwh,
          "kWh",
          `1 Bulan (${activePeriodLabel})`,
          f1KwhScale,
          "bg-gradient-to-r from-[#2b6cb0] to-[#4a90d9]",
          "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
          "consumption_fact_1"
        )}

        {renderHorizontalBarChart(
          language === "id"
            ? "FACTORY 2 CUMULATIVE CONSUMPTION (kWh)"
            : "FACTORY 2 CUMULATIVE CONSUMPTION (kWh)",
          language === "id"
            ? `Akumulasi energi (kWh) mesin Factory 2 bulan ${activePeriodLabel} (diurutkan dari kWh tertinggi, reset 0 awal bulan).`
            : `Factory 2 monthly cumulative energy (kWh) for ${activePeriodLabel} (sorted by highest kWh, resets monthly).`,
          "Gateway 2 & 3 (PM 2xx & 3xx)",
          factory2CumulativeRows,
          f2TotalKwh,
          "kWh",
          `1 Bulan (${activePeriodLabel})`,
          f2KwhScale,
          "bg-gradient-to-r from-[#0891b2] to-[#06b6d4]",
          "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
          "consumption_fact_2"
        )}
      </div>

      {/* Modal Kelola Tampilan Power Meter & Sub-Metering + Tambah PM Baru dengan API Baru */}
      <SeniorUnitHeadConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        isDark={isDark}
        fact1Items={factCategories1}
        fact2Items={factCategories2}
        onRefresh={handleConfigRefresh}
        initialFact={modalInitialFact}
        fact1ConfigType="realtime_fact_1"
        fact2ConfigType="realtime_fact_2"
        fact1TabLabel="Biggest Consumption Fact 1"
        fact2TabLabel="Biggest Consumption Fact 2"
        excludeAggregatePanels={true}
      />
    </div>
  );
};

export default RealtimePowerConsumption;
