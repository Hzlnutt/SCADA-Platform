import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { usePageActive } from "../../hooks/usePageActive";
import { PageHeader } from "../../components/ui/PageHeader";
import { Bar, Line } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { machineGroups } from "../../data/machines";
import { buildTimeAwareSeries, buildTimeLabels, getElapsedIndex } from "../../utils/series";
import { getJson, postJson, deleteJson } from "../../services/api.client";
import { useConfigStore } from "../../store/config.store";
import { getSocket } from "../../services/socket.service";
import { useSystemStore } from "../../store/system.store";
import { ApiSourcesPanel } from "../machines/MachineConfig";
import { useAuthStore } from "../../store/auth.store";
import { canAccessConfigAndAudit, isSeniorUnitHeadOrAdmin } from "../../utils/roles";
import { ElectricityExportModal } from "../../components/electricity/ElectricityExportModal";
import { SeniorUnitHeadConfigModal, type ConsumptionFactCategory } from "../../components/electricity/SeniorUnitHeadConfigModal";
import { EquipmentConfigModal, type EquipmentDisplayItem } from "../../components/electricity/EquipmentConfigModal";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import {
  DEFAULT_FACT1_CATEGORIES,
  DEFAULT_FACT2_CATEGORIES,
  getMachineSeries
} from "../../data/equipmentSeriesData";

/* ═══════════ CONSTANTS ═══════════ */
const dailyEnergyTotal = machineGroups.reduce((sum, group) => {
  const energy = group.summaryCards.find((card) => card.label === "Total Energy")?.value ?? 0;
  return sum + energy;
}, 0);

const electricityRate = 1467;

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const MONTH_SHORT_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];
const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const AVAILABLE_YEARS = [2025, 2026];

const ranges = [
  { id: "ytd", label: "YTD", points: 12, type: "month" as const, scale: 30 },
  { id: "hour", label: "Per Jam", points: 24, type: "time" as const, scale: 1 / 24 },
  { id: "day", label: "Per Hari", points: 30, type: "day" as const, scale: 1 },
  { id: "month", label: "Per Bulan", points: 12, type: "month" as const, scale: 30 },
  { id: "custom", label: "Kustom", points: 30, type: "day" as const, scale: 1 }
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const formatNumber = (value: number | undefined | null) => {
  const val = Number(value ?? 0);
  if (val > 0 && val < 1) {
    return val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 3 });
  }
  return val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const getLocalTodayString = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

const formatPeakTs = (tsStr: string) => {
  if (!tsStr) return "";
  const dateObj = new Date(tsStr);
  const day = dateObj.getDate();
  const month = MONTH_SHORT_ID[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hrs = String(dateObj.getHours()).padStart(2, "0");
  const mins = String(dateObj.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hrs}:${mins} WIB`;
};

const DEFAULT_PLN_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln";
const DEFAULT_WF1_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf1";
const DEFAULT_WF2_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf2";
const DEFAULT_PLTS_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_plts";
const DEFAULT_EW21_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew21";
const DEFAULT_EW22_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew22";
const DEFAULT_EW23_API_URL = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew23";

const ENDPOINT_MAP: Record<string, string> = {
  "electric_pln": DEFAULT_PLN_API_URL,
  "electric_wf1": DEFAULT_WF1_API_URL,
  "electric_wf2": DEFAULT_WF2_API_URL,
  "electric_plts": DEFAULT_PLTS_API_URL,
  "electric_ew21": DEFAULT_EW21_API_URL,
  "electric_ew22": DEFAULT_EW22_API_URL,
  "electric_ew23": DEFAULT_EW23_API_URL,
};

const DEFAULT_PLN_JSON_KEYS: Record<string, string> = {
  "pln/active_power": "Active_Power",
  "pln/reactive_power": "Reactive_Power_Total",
  "pln/apparent_power": "Apparent_Power_Total",
  "pln/power_factor": "Power_Factor",
  "pln/voltage": "Volt_LL",
  "pln/frequency": "Frequency",
  "pln/current_r": "Current_A",
  "pln/current_s": "Current_B",
  "pln/current_t": "Current_C",
  "pln/voltage_rn": "VoltAB",
  "pln/voltage_sn": "VoltBC",
  "pln/voltage_tn": "VoltCA",
  "pln/unbalance_v": "Volatage_Unbalance",
  "pln/unbalance_i": "Current_Umbalance",
  "electricity/p_grid": "Active_Power",
  "wf1/active_power": "Active_Power_Total",
  "wf2/active_power": "Active_Power_Total"
};

/* ═══════════ DEFAULT FACT CATEGORIES (MODULE LEVEL) ═══════════ */
const defaultFact1Categories: ConsumptionFactCategory[] = [
  { id: 101, config_type: "consumption_fact_1", config_key: "pm132", label: "PM132 — F1 MAIN SUPPLY QC OFFICE & LAB", value: { endpoint_url: "electric_ew21", json_key: "PM132", pm_id: "PM132", department: "Other", subArea: "QC Laboratory", kWh: 0, factory: "consumption_fact_1" }, sort_order: 1, enabled: true },
  { id: 102, config_type: "consumption_fact_1", config_key: "pm133", label: "PM133 — F1 MDP3", value: { endpoint_url: "electric_ew21", json_key: "PM133", pm_id: "PM133", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_1" }, sort_order: 2, enabled: true },
  { id: 103, config_type: "consumption_fact_1", config_key: "pm134", label: "PM134 — F1 WH 4 PENERANGAN", value: { endpoint_url: "electric_ew21", json_key: "PM134", pm_id: "PM134", department: "Other", subArea: "Warehouse", kWh: 0, factory: "consumption_fact_1" }, sort_order: 3, enabled: true },
  { id: 104, config_type: "consumption_fact_1", config_key: "pm135", label: "PM135 — F1 MDP-2", value: { endpoint_url: "electric_ew21", json_key: "PM135", pm_id: "PM135", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_1" }, sort_order: 4, enabled: true },
  { id: 105, config_type: "consumption_fact_1", config_key: "pm136", label: "PM136 — F1 MDP-1.2", value: { endpoint_url: "electric_ew21", json_key: "PM136", pm_id: "PM136", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_1" }, sort_order: 5, enabled: true },
  { id: 106, config_type: "consumption_fact_1", config_key: "pm138", label: "PM138 — F1 FULL COOLING WF1-U3", value: { endpoint_url: "electric_ew21", json_key: "PM138", pm_id: "PM138", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_1" }, sort_order: 6, enabled: true },
  { id: 107, config_type: "consumption_fact_1", config_key: "pm139", label: "PM139 — F1 MDP-1.1", value: { endpoint_url: "electric_ew21", json_key: "PM139", pm_id: "PM139", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_1" }, sort_order: 7, enabled: true },
  { id: 108, config_type: "consumption_fact_1", config_key: "pm140", label: "PM140 — F1 COMPRESSED AIR ZT-55", value: { endpoint_url: "electric_ew21", json_key: "PM140", pm_id: "PM140", department: "Utility", subArea: "Compressors", kWh: 0, factory: "consumption_fact_1" }, sort_order: 8, enabled: true },
  { id: 109, config_type: "consumption_fact_1", config_key: "pm151", label: "PM151 — F1 HVAC OFFICE ATAS", value: { endpoint_url: "electric_ew21", json_key: "PM151", pm_id: "PM151", department: "HVAC", subArea: "AHUs", kWh: 0, factory: "consumption_fact_1" }, sort_order: 9, enabled: true },
  { id: 110, config_type: "consumption_fact_1", config_key: "pm152", label: "PM152 — F1 COOLING TOWER PUMP WF1-U3", value: { endpoint_url: "electric_ew21", json_key: "PM152", pm_id: "PM152", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_1" }, sort_order: 10, enabled: true },
  { id: 111, config_type: "consumption_fact_1", config_key: "pm153", label: "PM153 — F1 HVAC-QC", value: { endpoint_url: "electric_ew21", json_key: "PM153", pm_id: "PM153", department: "HVAC", subArea: "AHUs", kWh: 0, factory: "consumption_fact_1" }, sort_order: 11, enabled: true },
  { id: 112, config_type: "consumption_fact_1", config_key: "pm154", label: "PM154 — F1 LIGHTING WH 1", value: { endpoint_url: "electric_ew21", json_key: "PM154", pm_id: "PM154", department: "Other", subArea: "Warehouse", kWh: 0, factory: "consumption_fact_1" }, sort_order: 12, enabled: true },
  { id: 113, config_type: "consumption_fact_1", config_key: "pm175", label: "PM175 — F1 ST3", value: { endpoint_url: "electric_ew21", json_key: "PM175", pm_id: "PM175", department: "Other", subArea: "Production Lines", kWh: 0, factory: "consumption_fact_1" }, sort_order: 13, enabled: true },
  { id: 114, config_type: "consumption_fact_1", config_key: "pm176", label: "PM176 — F1 QC LAB", value: { endpoint_url: "electric_ew21", json_key: "PM176", pm_id: "PM176", department: "Other", subArea: "QC Laboratory", kWh: 0, factory: "consumption_fact_1" }, sort_order: 14, enabled: true },
  { id: 115, config_type: "consumption_fact_1", config_key: "pm177", label: "PM177 — F1 CHILLER PREP DAIKIN BARAT", value: { endpoint_url: "electric_ew21", json_key: "PM177", pm_id: "PM177", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_1" }, sort_order: 15, enabled: true },
  { id: 116, config_type: "consumption_fact_1", config_key: "pm178", label: "PM178 — F1 CHILLER PREP DAIKIN TIMUR", value: { endpoint_url: "electric_ew21", json_key: "PM178", pm_id: "PM178", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_1" }, sort_order: 16, enabled: true },
  { id: 117, config_type: "consumption_fact_1", config_key: "pm179", label: "PM179 — F1 HVAC WH-3", value: { endpoint_url: "electric_ew21", json_key: "PM179", pm_id: "PM179", department: "HVAC", subArea: "Warehouse", kWh: 0, factory: "consumption_fact_1" }, sort_order: 17, enabled: true },
  { id: 118, config_type: "consumption_fact_1", config_key: "pm180", label: "PM180 — F1 CHILLER BP WF1-U3", value: { endpoint_url: "electric_ew21", json_key: "PM180", pm_id: "PM180", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_1" }, sort_order: 18, enabled: true },
  { id: 119, config_type: "consumption_fact_1", config_key: "pm181", label: "PM181 — F1 COOLING TOWER FAN WF1-U3", value: { endpoint_url: "electric_ew21", json_key: "PM181", pm_id: "PM181", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_1" }, sort_order: 19, enabled: true },
  { id: 120, config_type: "consumption_fact_1", config_key: "pm182", label: "PM182 — F1 COMPRESSED AIR ZT-30.1&2", value: { endpoint_url: "electric_ew21", json_key: "PM182", pm_id: "PM182", department: "Utility", subArea: "Compressors", kWh: 0, factory: "consumption_fact_1" }, sort_order: 20, enabled: true },
  { id: 121, config_type: "consumption_fact_1", config_key: "pm183", label: "PM183 — F1 COMPRESSED AIR ALE-30", value: { endpoint_url: "electric_ew21", json_key: "PM183", pm_id: "PM183", department: "Utility", subArea: "Compressors", kWh: 0, factory: "consumption_fact_1" }, sort_order: 21, enabled: true },
  { id: 122, config_type: "consumption_fact_1", config_key: "pm184", label: "PM184 — F1 BOILER 4", value: { endpoint_url: "electric_ew21", json_key: "PM184", pm_id: "PM184", department: "Utility", subArea: "Boiler", kWh: 0, factory: "consumption_fact_1" }, sort_order: 22, enabled: true },
  { id: 123, config_type: "consumption_fact_1", config_key: "pm185", label: "PM185 — F1 HVAC WF1U3", value: { endpoint_url: "electric_ew21", json_key: "PM185", pm_id: "PM185", department: "HVAC", subArea: "AHUs", kWh: 0, factory: "consumption_fact_1" }, sort_order: 23, enabled: true }
];

const defaultFact2Categories: ConsumptionFactCategory[] = [
  // EW22 (21 Units)
  { id: 201, config_type: "consumption_fact_2", config_key: "pm206", label: "PM206 — F2 COOLING FASE-1", value: { endpoint_url: "electric_ew22", json_key: "PM206", pm_id: "PM206", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 1, enabled: true },
  { id: 202, config_type: "consumption_fact_2", config_key: "pm205", label: "PM205 — F2 AHU WF2UI", value: { endpoint_url: "electric_ew22", json_key: "PM205", pm_id: "PM205", department: "HVAC", subArea: "AHUs", kWh: 0, factory: "consumption_fact_2" }, sort_order: 2, enabled: true },
  { id: 203, config_type: "consumption_fact_2", config_key: "pm203", label: "PM203 — F2 HEATER WF2U2", value: { endpoint_url: "electric_ew22", json_key: "PM203", pm_id: "PM203", department: "HVAC", subArea: "Cleanroom HVAC", kWh: 0, factory: "consumption_fact_2" }, sort_order: 3, enabled: true },
  { id: 204, config_type: "consumption_fact_2", config_key: "pm208", label: "PM208 — F2 WH 5", value: { endpoint_url: "electric_ew22", json_key: "PM208", pm_id: "PM208", department: "Other", subArea: "Warehouse", kWh: 0, factory: "consumption_fact_2" }, sort_order: 4, enabled: true },
  { id: 205, config_type: "consumption_fact_2", config_key: "pm207", label: "PM207 — F2 WH 6", value: { endpoint_url: "electric_ew22", json_key: "PM207", pm_id: "PM207", department: "Other", subArea: "Warehouse", kWh: 0, factory: "consumption_fact_2" }, sort_order: 5, enabled: true },
  { id: 206, config_type: "consumption_fact_2", config_key: "pm271", label: "PM271 — F2 CHILLER RTAC 250 (RO&HVAC)", value: { endpoint_url: "electric_ew22", json_key: "PM271", pm_id: "PM271", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 6, enabled: true },
  { id: 207, config_type: "consumption_fact_2", config_key: "pm272", label: "PM272 — F2 CHILLER RTAC 170 (RO)", value: { endpoint_url: "electric_ew22", json_key: "PM272", pm_id: "PM272", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 7, enabled: true },
  { id: 208, config_type: "consumption_fact_2", config_key: "pm274", label: "PM274 — F2 CHILLER RTAC 100 (BP)", value: { endpoint_url: "electric_ew22", json_key: "PM274", pm_id: "PM274", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 8, enabled: true },
  { id: 209, config_type: "consumption_fact_2", config_key: "pm273", label: "PM273 — RETURN SAMPLE QC", value: { endpoint_url: "electric_ew22", json_key: "PM273", pm_id: "PM273", department: "Other", subArea: "QC Laboratory", kWh: 0, factory: "consumption_fact_2" }, sort_order: 9, enabled: true },
  { id: 210, config_type: "consumption_fact_2", config_key: "pm201", label: "PM201 — F2 PUTR-1", value: { endpoint_url: "electric_ew22", json_key: "PM201", pm_id: "PM201", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_2" }, sort_order: 10, enabled: true },
  { id: 211, config_type: "consumption_fact_2", config_key: "pm209", label: "PM209 — F2 CHILLER - WF2U2", value: { endpoint_url: "electric_ew22", json_key: "PM209", pm_id: "PM209", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 11, enabled: true },
  { id: 212, config_type: "consumption_fact_2", config_key: "pm226", label: "PM226 — F2 WH-7", value: { endpoint_url: "electric_ew22", json_key: "PM226", pm_id: "PM226", department: "Other", subArea: "Warehouse", kWh: 0, factory: "consumption_fact_2" }, sort_order: 12, enabled: true },
  { id: 213, config_type: "consumption_fact_2", config_key: "pm202", label: "PM202 — F2 PUTR-2", value: { endpoint_url: "electric_ew22", json_key: "PM202", pm_id: "PM202", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_2" }, sort_order: 13, enabled: true },
  { id: 214, config_type: "consumption_fact_2", config_key: "pm288", label: "PM288 — F2 Penerangan PD", value: { endpoint_url: "electric_ew22", json_key: "PM288", pm_id: "PM288", department: "Other", subArea: "Warehouse", kWh: 0, factory: "consumption_fact_2" }, sort_order: 14, enabled: true },
  { id: 215, config_type: "consumption_fact_2", config_key: "pm229", label: "PM229 — F2 KOBELCO ALE-250", value: { endpoint_url: "electric_ew22", json_key: "PM229", pm_id: "PM229", department: "Utility", subArea: "Compressors", kWh: 0, factory: "consumption_fact_2" }, sort_order: 15, enabled: true },
  { id: 216, config_type: "consumption_fact_2", config_key: "pm210", label: "PM210 — F2 MAIN CRITICAL PANEL", value: { endpoint_url: "electric_ew22", json_key: "PM210", pm_id: "PM210", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_2" }, sort_order: 16, enabled: true },
  { id: 217, config_type: "consumption_fact_2", config_key: "pm215", label: "PM215 — F2 COOLING CRITICAL", value: { endpoint_url: "electric_ew22", json_key: "PM215", pm_id: "PM215", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 17, enabled: true },
  { id: 218, config_type: "consumption_fact_2", config_key: "pm213", label: "PM213 — F2 BOILER-5", value: { endpoint_url: "electric_ew22", json_key: "PM213", pm_id: "PM213", department: "Utility", subArea: "Boiler", kWh: 0, factory: "consumption_fact_2" }, sort_order: 18, enabled: true },
  { id: 219, config_type: "consumption_fact_2", config_key: "pm211", label: "PM211 — F2 PANEL OTOKLAF WF2U1", value: { endpoint_url: "electric_ew22", json_key: "PM211", pm_id: "PM211", department: "Other", subArea: "Autoclave", kWh: 0, factory: "consumption_fact_2" }, sort_order: 19, enabled: true },
  { id: 220, config_type: "consumption_fact_2", config_key: "pm214", label: "PM214 — F2 COMPRESSED AIR ATLAS", value: { endpoint_url: "electric_ew22", json_key: "PM214", pm_id: "PM214", department: "Utility", subArea: "Compressors", kWh: 0, factory: "consumption_fact_2" }, sort_order: 20, enabled: true },
  { id: 221, config_type: "consumption_fact_2", config_key: "pm212", label: "PM212 — F2 PANEL OTOKLAF WF2U2", value: { endpoint_url: "electric_ew22", json_key: "PM212", pm_id: "PM212", department: "Other", subArea: "Autoclave", kWh: 0, factory: "consumption_fact_2" }, sort_order: 21, enabled: true },
  // EW23 (10 Units)
  { id: 222, config_type: "consumption_fact_2", config_key: "pm319", label: "PM319 — F2 CHILLER RTAC-27S (PREP)", value: { endpoint_url: "electric_ew23", json_key: "PM319", pm_id: "PM319", department: "HVAC", subArea: "Chillers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 22, enabled: true },
  { id: 223, config_type: "consumption_fact_2", config_key: "pm320", label: "PM320 — F2 WT-DU-PSG", value: { endpoint_url: "electric_ew23", json_key: "PM320", pm_id: "PM320", department: "Utility", subArea: "Water / WTP", kWh: 0, factory: "consumption_fact_2" }, sort_order: 23, enabled: true },
  { id: 224, config_type: "consumption_fact_2", config_key: "pm321", label: "PM321 — F2 AHU-1 - WF2U2", value: { endpoint_url: "electric_ew23", json_key: "PM321", pm_id: "PM321", department: "HVAC", subArea: "AHUs", kWh: 0, factory: "consumption_fact_2" }, sort_order: 24, enabled: true },
  { id: 225, config_type: "consumption_fact_2", config_key: "pm322", label: "PM322 — F2 AHU-2 - WF2U2", value: { endpoint_url: "electric_ew23", json_key: "PM322", pm_id: "PM322", department: "HVAC", subArea: "AHUs", kWh: 0, factory: "consumption_fact_2" }, sort_order: 25, enabled: true },
  { id: 226, config_type: "consumption_fact_2", config_key: "pm323", label: "PM323 — F2 PW GENERATION - RO", value: { endpoint_url: "electric_ew23", json_key: "PM323", pm_id: "PM323", department: "Utility", subArea: "Water / WTP", kWh: 0, factory: "consumption_fact_2" }, sort_order: 26, enabled: true },
  { id: 227, config_type: "consumption_fact_2", config_key: "pm325", label: "PM325 — F2 COOLING TOWER CT-FAN", value: { endpoint_url: "electric_ew23", json_key: "PM325", pm_id: "PM325", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 27, enabled: true },
  { id: 228, config_type: "consumption_fact_2", config_key: "pm324", label: "PM324 — F2 COOLING TOWER CT-PUMP", value: { endpoint_url: "electric_ew23", json_key: "PM324", pm_id: "PM324", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 28, enabled: true },
  { id: 229, config_type: "consumption_fact_2", config_key: "pm327", label: "PM327 — F2 PUTR-NEW", value: { endpoint_url: "electric_ew23", json_key: "PM327", pm_id: "PM327", department: "Utility", subArea: "Electrical Substation", kWh: 0, factory: "consumption_fact_2" }, sort_order: 29, enabled: true },
  { id: 230, config_type: "consumption_fact_2", config_key: "pm318", label: "PM318 — F2 COOLING FASE-2", value: { endpoint_url: "electric_ew23", json_key: "PM318", pm_id: "PM318", department: "Utility", subArea: "Cooling Towers", kWh: 0, factory: "consumption_fact_2" }, sort_order: 30, enabled: true },
  { id: 231, config_type: "consumption_fact_2", config_key: "pm337", label: "PM337 — F2 MCC BP 7", value: { endpoint_url: "electric_ew23", json_key: "PM337", pm_id: "PM337", department: "Other", subArea: "Production Lines", kWh: 0, factory: "consumption_fact_2" }, sort_order: 31, enabled: true }
];

/* ═══════════ SMALL ICON COMPONENTS ═══════════ */
const IconGrid = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);
const IconSolar = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
);
const IconGenset = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 6V4" /><path d="M17 6V4" /><circle cx="12" cy="12" r="3" /><path d="M12 9v1.5" /><path d="M12 13.5V15" />
  </svg>
);
const IconPlant = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h6v6H4z" /><path d="M14 5h6v6h-6z" /><path d="M9 19h6" /><path d="M12 11v8" />
  </svg>
);
const IconMoney = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconBolt = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
);
const IconSun = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  </svg>
);
const IconSettings = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

/* ═══════════ SPARKLINE MINI CHART ═══════════ */
const Sparkline = ({ color = "#4ade80" }: { color?: string }) => {
  return null;
};

/* ═══════════ MONTHLY COMPARISON BAR CHART ═══════════ */
interface MonthlyBreakdownItem {
  day: number;
  pln: number;
  poi1: number;
  poi2: number;
  wbp: number;
  lwbp: number;
}

const MonthlyComparisonBarChart = memo(function MonthlyComparisonBarChart({
  currentData,
  previousData,
  isDark,
  currMonthName,
  prevMonthName,
  selectorType,
  currentBreakdown,
  previousBreakdown,
  solarRate,
  pvRate,
  showPrevious = true,
  isZoomed = false
}: {
  currentData: number[];
  previousData: number[];
  isDark: boolean;
  currMonthName?: string;
  prevMonthName?: string;
  selectorType?: "all" | "pln" | "wf1" | "wf2" | "poi1" | "poi2";
  currentBreakdown?: MonthlyBreakdownItem[];
  previousBreakdown?: MonthlyBreakdownItem[];
  solarRate?: number;
  pvRate?: number;
  showPrevious?: boolean;
  isZoomed?: boolean;
}) {
  const daysInMonth = Math.max(currentData?.length || 0, previousData?.length || 0, 28);
  const dayLabels = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0")), [daysInMonth]);

  const paddedCurrentData = useMemo(() => {
    if (!currentData || currentData.length === 0) return new Array(daysInMonth).fill(0);
    if (currentData.length < daysInMonth) {
      return [...currentData, ...new Array(daysInMonth - currentData.length).fill(0)];
    }
    return currentData;
  }, [currentData, daysInMonth]);

  const paddedPreviousData = useMemo(() => {
    if (!previousData || previousData.length === 0) return new Array(daysInMonth).fill(0);
    if (previousData.length < daysInMonth) {
      return [...previousData, ...new Array(daysInMonth - previousData.length).fill(0)];
    }
    return previousData;
  }, [previousData, daysInMonth]);

  const data = useMemo(() => {
    const barPct = isZoomed ? 0.68 : 0.55;
    const catPct = isZoomed ? 0.88 : 0.8;
    const barRadius = isZoomed ? 4 : 2;

    if (selectorType === "all") {
      const plnData = (currentBreakdown || []).map((b) => b.pln || 0);
      const solarData = (currentBreakdown || []).map((b) => (b.poi1 || 0) + (b.poi2 || 0));

      return {
        labels: dayLabels,
        datasets: [
          {
            label: "PLN Grid",
            data: plnData,
            backgroundColor: "rgba(59, 130, 246, 0.85)",
            hoverBackgroundColor: "rgba(37, 99, 235, 1)",
            borderWidth: 0,
            borderRadius: { topLeft: 0, topRight: 0, bottomLeft: barRadius, bottomRight: barRadius },
            stack: "current",
            barPercentage: barPct,
            categoryPercentage: catPct
          },
          {
            label: "Solar PLTS",
            data: solarData,
            backgroundColor: "rgba(16, 185, 129, 0.85)",
            hoverBackgroundColor: "rgba(5, 150, 105, 1)",
            borderWidth: 0,
            borderRadius: { topLeft: barRadius, topRight: barRadius, bottomLeft: 0, bottomRight: 0 },
            stack: "current",
            barPercentage: barPct,
            categoryPercentage: catPct
          },
          ...(showPrevious ? [{
            label: prevMonthName ? `Bulan Lalu (${prevMonthName})` : "Bulan Lalu",
            data: paddedPreviousData,
            backgroundColor: "rgba(239, 68, 68, 0.75)",
            hoverBackgroundColor: "rgba(220, 38, 38, 1)",
            borderWidth: 0,
            borderRadius: barRadius,
            stack: "previous",
            barPercentage: barPct,
            categoryPercentage: catPct
          }] : [])
        ]
      };
    }

    return {
      labels: dayLabels,
      datasets: [
        {
          label: currMonthName ? `Bulan Ini (${currMonthName})` : "Bulan Ini",
          data: paddedCurrentData,
          backgroundColor: "rgba(59, 130, 246, 0.85)",
          hoverBackgroundColor: "rgba(37, 99, 235, 1)",
          borderWidth: 0,
          borderRadius: barRadius,
          stack: "current",
          barPercentage: barPct,
          categoryPercentage: catPct
        },
        ...(showPrevious ? [{
          label: prevMonthName ? `Bulan Lalu (${prevMonthName})` : "Bulan Lalu",
          data: paddedPreviousData,
          backgroundColor: "rgba(239, 68, 68, 0.75)",
          hoverBackgroundColor: "rgba(220, 38, 38, 1)",
          borderWidth: 0,
          borderRadius: barRadius,
          stack: "previous",
          barPercentage: barPct,
          categoryPercentage: catPct
        }] : [])
      ]
    };
  }, [dayLabels, paddedCurrentData, paddedPreviousData, currMonthName, prevMonthName, selectorType, currentBreakdown, showPrevious, isZoomed]);

  const options: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          color: isDark ? "rgba(203, 213, 225, 0.9)" : "rgba(51, 65, 85, 0.9)",
          font: { size: isZoomed ? 13 : 10, weight: isZoomed ? "700" : "600" },
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: isZoomed ? 20 : 14,
          boxWidth: isZoomed ? 14 : 10,
          boxHeight: isZoomed ? 14 : 10
        }
      },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        backgroundColor: isDark ? "rgba(13, 21, 39, 0.96)" : "rgba(255, 255, 255, 0.98)",
        titleColor: isDark ? "#38bdf8" : "#0284c7",
        titleFont: { size: isZoomed ? 14 : 12, weight: "700" as const },
        bodyColor: isDark ? "#f1f5f9" : "#0f172a",
        borderColor: isDark ? "rgba(56, 189, 248, 0.3)" : "rgba(14, 165, 233, 0.3)",
        borderWidth: 1,
        padding: isZoomed ? 14 : 10,
        boxPadding: 4,
        bodyFont: { family: "IBM Plex Mono, monospace", size: isZoomed ? 13 : 11 },
        callbacks: {
          title: (items: any[]) => {
            if (!items || items.length === 0) return "";
            const dayNum = String(items[0].dataIndex + 1).padStart(2, "0");
            return `Tanggal ${dayNum} ${currMonthName || "Bulan Ini"}`;
          },
          label: (ctx: any) => {
            const val = Number(ctx.parsed.y || 0);
            const idx = ctx.dataIndex;
            const curVal = Number(paddedCurrentData[idx] || 0);

            if (selectorType === "all" && ctx.dataset.stack === "current" && curVal > 0) {
              const pct = Math.round((val / curVal) * 100);
              return `${ctx.dataset.label}: ${val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kWh (${pct}%)`;
            }
            return `${ctx.dataset.label}: ${val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kWh`;
          },
          afterBody: (items: any[]) => {
            if (!items || items.length === 0) return [];
            const idx = items[0].dataIndex;
            const curVal = Number(paddedCurrentData[idx] || 0);
            const prevVal = Number(paddedPreviousData[idx] || 0);
            const lines: string[] = [];

            if (selectorType === "all") {
              const b = currentBreakdown?.[idx];
              if (b && (b.poi1 > 0 || b.poi2 > 0)) {
                lines.push(`• Rincian PLTS: POI-1 ${b.poi1.toLocaleString("id-ID", { maximumFractionDigits: 2 })} | POI-2 ${b.poi2.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kWh`);
              }
              lines.push(`Total Konsumsi: ${curVal.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kWh`);
            }

            if (prevVal > 0) {
              const diff = curVal - prevVal;
              const diffSign = diff > 0 ? "+" : "";
              const pct = ((diff / prevVal) * 100).toFixed(1);
              lines.push(`Selisih vs Bulan Lalu: ${diffSign}${diff.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kWh (${diffSign}${pct}%)`);
            }

            if ((selectorType === "pln" || selectorType === "wf1" || selectorType === "wf2") && currentBreakdown?.[idx]) {
              const b = currentBreakdown[idx];
              if (b.wbp > 0 || b.lwbp > 0) {
                lines.push(`• LWBP: ${b.lwbp.toLocaleString("id-ID", { maximumFractionDigits: 1 })} | WBP: ${b.wbp.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh`);
              }
            } else if ((selectorType === "poi1" || selectorType === "poi2") && currentBreakdown?.[idx]) {
              const b = currentBreakdown[idx];
              const kwh = selectorType === "poi1" ? b.poi1 : b.poi2;
              const plnRate = solarRate || 1112;
              const currentPvRate = pvRate || 0;
              const pvCost = kwh * currentPvRate;
              const savings = kwh * (plnRate - currentPvRate);
              if (currentPvRate > 0) {
                lines.push(`• Biaya PV: Rp ${Math.round(pvCost).toLocaleString("id-ID")}`);
              }
              lines.push(`• Estimasi Hemat: Rp ${Math.round(savings).toLocaleString("id-ID")}`);
            }

            return lines;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: isZoomed,
          color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)"
        },
        ticks: {
          color: isDark ? "rgba(203, 213, 225, 0.85)" : "rgba(51, 65, 85, 0.85)",
          font: {
            size: isZoomed ? 12 : 9,
            weight: isZoomed ? ("700" as const) : ("normal" as const),
            family: "IBM Plex Mono, monospace"
          },
          padding: isZoomed ? 6 : 2,
          maxRotation: 0
        },
        ...(isZoomed ? {
          title: {
            display: true,
            text: `Hari / Tanggal (01 - ${dayLabels.length}) ${currMonthName || ""}`,
            color: isDark ? "rgba(148, 163, 184, 0.9)" : "rgba(71, 85, 105, 0.9)",
            font: { size: 12, weight: "700" as const },
            padding: { top: 8, bottom: 0 }
          }
        } : {})
      },
      y: {
        stacked: true,
        beginAtZero: true,
        suggestedMax: 10,
        grace: "15%",
        grid: { color: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.5)" },
        ticks: {
          color: isDark ? "rgba(203, 213, 225, 0.85)" : "rgba(51, 65, 85, 0.85)",
          font: {
            size: isZoomed ? 12 : 9,
            weight: isZoomed ? ("700" as const) : ("normal" as const),
            family: "IBM Plex Mono, monospace"
          },
          padding: isZoomed ? 8 : 4,
          callback: (v: number) => {
            if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
            if (Number.isInteger(v)) return `${v}`;
            return `${Number(v.toFixed(2))}`;
          }
        },
        ...(isZoomed ? {
          title: {
            display: true,
            text: "Konsumsi Energi (kWh)",
            color: isDark ? "rgba(148, 163, 184, 0.9)" : "rgba(71, 85, 105, 0.9)",
            font: { size: 12, weight: "700" as const },
            padding: { top: 0, bottom: 8 }
          }
        } : {})
      }
    }
  }), [isDark, paddedCurrentData, paddedPreviousData, currMonthName, prevMonthName, selectorType, currentBreakdown, previousBreakdown, solarRate, pvRate, isZoomed, dayLabels]);

  return <Bar data={data} options={options} />;
});

const MonthlyComparisonChart = memo(function MonthlyComparisonChart({
  title,
  currentData,
  previousData,
  isDark,
  currMonthName,
  prevMonthName,
  selectorType,
  currentBreakdown,
  previousBreakdown,
  solarRate,
  pvRate
}: {
  title: string;
  currentData: number[];
  previousData: number[];
  isDark: boolean;
  currMonthName?: string;
  prevMonthName?: string;
  selectorType?: "all" | "pln" | "wf1" | "wf2" | "poi1" | "poi2";
  currentBreakdown?: MonthlyBreakdownItem[];
  previousBreakdown?: MonthlyBreakdownItem[];
  solarRate?: number;
  pvRate?: number;
}) {
  const [showPrevious, setShowPrevious] = useState(true);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          setIsZoomOpen(false);
        }
      }
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isZoomOpen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const currTotalKwh = useMemo(() => (currentData || []).reduce((sum, v) => sum + (Number(v) || 0), 0), [currentData]);
  const prevTotalKwh = useMemo(() => (previousData || []).reduce((sum, v) => sum + (Number(v) || 0), 0), [previousData]);
  const diffPct = useMemo(() => {
    if (prevTotalKwh <= 0) return null;
    return (((currTotalKwh - prevTotalKwh) / prevTotalKwh) * 100).toFixed(1);
  }, [currTotalKwh, prevTotalKwh]);

  // Daily average & peak day stats for the modal
  const peakDayInfo = useMemo(() => {
    let maxVal = 0;
    let maxIdx = -1;
    (currentData || []).forEach((v, idx) => {
      const val = Number(v) || 0;
      if (val > maxVal) {
        maxVal = val;
        maxIdx = idx;
      }
    });
    if (maxIdx < 0 || maxVal <= 0) return null;
    return { day: String(maxIdx + 1).padStart(2, "0"), val: maxVal };
  }, [currentData]);

  const avgKwh = useMemo(() => {
    const activeDays = (currentData || []).filter((v) => Number(v) > 0).length || 1;
    return currTotalKwh / activeDays;
  }, [currTotalKwh, currentData]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Top-Left: Title and Total kWh */}
        <div className="flex flex-col">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">{title}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400">
              {formatNumber(currTotalKwh)} <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">kWh</span>
            </span>
            {showPrevious && diffPct !== null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                Number(diffPct) > 0
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              }`}>
                {Number(diffPct) > 0 ? `+${diffPct}%` : `${diffPct}%`} vs bln lalu
              </span>
            )}
          </div>
        </div>

        {/* Top-Right: Checkbox, Month badges & Zoom In Button */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700 transition cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPrevious}
              onChange={(e) => setShowPrevious(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600"
            />
            <span>Bulan Lalu</span>
          </label>
          {showPrevious && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {prevMonthName || "Bln Pembanding"}: <strong>{formatNumber(prevTotalKwh)}</strong> kWh
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition cursor-pointer"
            title="Perbesar Tampilan Chart"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            <span>Perbesar</span>
          </button>
        </div>
      </div>
      <div style={{ height: 280 }}>
        <MonthlyComparisonBarChart
          currentData={currentData}
          previousData={previousData}
          isDark={isDark}
          currMonthName={currMonthName}
          prevMonthName={prevMonthName}
          selectorType={selectorType}
          currentBreakdown={currentBreakdown}
          previousBreakdown={previousBreakdown}
          solarRate={solarRate}
          pvRate={pvRate}
          showPrevious={showPrevious}
        />
      </div>

      {/* Zoom Popup Modal - Extra-Large Viewport Filling (98vw x 96vh) */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-1 sm:p-2 md:p-3 animate-in fade-in duration-200"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            }
            setIsZoomOpen(false);
          }}
        >
          <div
            ref={modalContainerRef}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-150"
            style={{
              width: isFullscreen ? "100vw" : "98vw",
              maxWidth: isFullscreen ? "100vw" : "98vw",
              height: isFullscreen ? "100vh" : "96vh",
              maxHeight: isFullscreen ? "100vh" : "96vh",
              borderRadius: isFullscreen ? "0px" : "1.25rem",
              padding: isFullscreen ? "1.5rem" : "1.25rem 1.5rem"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-wide">
                    {title}
                  </h3>
                  <span className="text-xs px-3 py-1 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-extrabold tracking-wider uppercase">
                    Perbesar Chart
                  </span>
                </div>
                {/* KPI Metrics Strip */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Bulan Ini:</span>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-[#1f6fb5] dark:text-sky-400">
                      {formatNumber(currTotalKwh)} <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">kWh</span>
                    </span>
                  </div>

                  {showPrevious && (
                    <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {prevMonthName || "Bulan Lalu"}: <strong>{formatNumber(prevTotalKwh)}</strong> kWh
                    </span>
                  )}

                  {showPrevious && diffPct !== null && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                      Number(diffPct) > 0
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    }`}>
                      {Number(diffPct) > 0 ? `+${diffPct}%` : `${diffPct}%`} vs bln lalu
                    </span>
                  )}

                  {avgKwh > 0 && (
                    <span className="hidden sm:inline-flex px-3 py-1 rounded-xl text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      Rata-rata: <strong>{formatNumber(avgKwh)}</strong> kWh/hari
                    </span>
                  )}

                  {peakDayInfo && (
                    <span className="hidden md:inline-flex px-3 py-1 rounded-xl text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20">
                      Puncak: <strong>Tgl {peakDayInfo.day} ({formatNumber(peakDayInfo.val)} kWh)</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Top Right */}
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer select-none transition">
                  <input
                    type="checkbox"
                    checked={showPrevious}
                    onChange={(e) => setShowPrevious(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer accent-blue-600"
                  />
                  <span>Bulan Lalu</span>
                </label>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl transition cursor-pointer"
                  title="Toggle Fullscreen Layar Penuh"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    {isFullscreen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    )}
                  </svg>
                  <span className="hidden sm:inline">{isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen?.().catch(() => {});
                    }
                    setIsZoomOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition cursor-pointer"
                  title="Tutup Modal (ESC)"
                >
                  <span>Tutup</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body: Extra-Large Chart filling full available height */}
            <div className="relative w-full flex-1 min-h-[480px] sm:min-h-[560px] md:min-h-[620px] pt-2">
              <MonthlyComparisonBarChart
                currentData={currentData}
                previousData={previousData}
                isDark={isDark}
                currMonthName={currMonthName}
                prevMonthName={prevMonthName}
                selectorType={selectorType}
                currentBreakdown={currentBreakdown}
                previousBreakdown={previousBreakdown}
                solarRate={solarRate}
                pvRate={pvRate}
                showPrevious={showPrevious}
                isZoomed={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const DynamicSelectionChart = memo(function DynamicSelectionChart({
  isDark,
  currMonthName,
  prevMonthName,
  currentYear,
  currentMonthIdx,
  compYear,
  compMonthIdx
}: {
  isDark: boolean;
  currMonthName?: string;
  prevMonthName?: string;
  currentYear?: number;
  currentMonthIdx?: number;
  compYear?: number;
  compMonthIdx?: number;
}) {
  const [factory, setFactory] = useState<"wf1" | "wf2">("wf1");
  const [machine, setMachine] = useState("F1 MAIN SUPPLY QC OFFICE & LAB");
  const [showPrevious, setShowPrevious] = useState(true);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          setIsZoomOpen(false);
        }
      }
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isZoomOpen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const machineOptions = useMemo(() => {
    if (factory === "wf1") {
      return DEFAULT_FACT1_CATEGORIES.map((c) => c.label);
    } else {
      return DEFAULT_FACT2_CATEGORIES.map((c) => c.label);
    }
  }, [factory]);

  // Sync selected machine when options change
  useEffect(() => {
    if (!machineOptions.includes(machine)) {
      setMachine(machineOptions[0] || "F1 MAIN SUPPLY QC OFFICE & LAB");
    }
  }, [machineOptions, machine]);

  // Dynamic state from database
  const [dbData, setDbData] = useState<{
    currentData: number[];
    previousData: number[];
    currTotalKwh: number;
    prevTotalKwh: number;
    pmId?: string;
    hasData: boolean;
    loading: boolean;
  }>({
    currentData: [],
    previousData: [],
    currTotalKwh: 0,
    prevTotalKwh: 0,
    hasData: false,
    loading: false
  });

  useEffect(() => {
    let isCancelled = false;
    const now = new Date();
    const cYear = currentYear ?? now.getFullYear();
    const cMonth = currentMonthIdx !== undefined ? currentMonthIdx + 1 : now.getMonth() + 1;
    const pYear = compYear ?? (cMonth === 1 ? cYear - 1 : cYear);
    const pMonth = compMonthIdx !== undefined ? compMonthIdx + 1 : (cMonth === 1 ? 12 : cMonth - 1);

    const currMonthStr = `${cYear}-${String(cMonth).padStart(2, "0")}`;
    const compMonthStr = `${pYear}-${String(pMonth).padStart(2, "0")}`;

    setDbData((prev) => ({ ...prev, loading: true }));

    getJson<{
      pmId: string;
      label: string;
      currentMonth: { daily: number[]; totalKwh: number; hasData: boolean };
      comparisonMonth: { daily: number[]; totalKwh: number; hasData: boolean };
      hasData: boolean;
    }>(`/analytics/electricity/equipment-monthly?machine=${encodeURIComponent(machine)}&currentMonth=${currMonthStr}&comparisonMonth=${compMonthStr}`)
      .then((res) => {
        if (!isCancelled && res) {
          setDbData({
            currentData: res.currentMonth?.daily || [],
            previousData: res.comparisonMonth?.daily || [],
            currTotalKwh: res.currentMonth?.totalKwh || 0,
            prevTotalKwh: res.comparisonMonth?.totalKwh || 0,
            pmId: res.pmId,
            hasData: Boolean(res.hasData),
            loading: false
          });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setDbData((prev) => ({ ...prev, loading: false }));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [machine, currentYear, currentMonthIdx, compYear, compMonthIdx]);

  // Strictly factual data from database (no dummy sinusoidal fallback)
  const currentData = dbData.currentData || [];
  const previousData = dbData.previousData || [];
  const currTotalKwh = useMemo(() => currentData.reduce((sum, v) => sum + (Number(v) || 0), 0), [currentData]);
  const prevTotalKwh = useMemo(() => previousData.reduce((sum, v) => sum + (Number(v) || 0), 0), [previousData]);
  const diffPct = useMemo(() => {
    if (prevTotalKwh <= 0) return null;
    return (((currTotalKwh - prevTotalKwh) / prevTotalKwh) * 100).toFixed(1);
  }, [currTotalKwh, prevTotalKwh]);
  const hasData = (currentData.length > 0 && currentData.some(v => v > 0)) || (previousData.length > 0 && previousData.some(v => v > 0));

  const peakDayInfo = useMemo(() => {
    let maxVal = 0;
    let maxIdx = -1;
    (currentData || []).forEach((v, idx) => {
      const val = Number(v) || 0;
      if (val > maxVal) {
        maxVal = val;
        maxIdx = idx;
      }
    });
    if (maxIdx < 0 || maxVal <= 0) return null;
    return { day: String(maxIdx + 1).padStart(2, "0"), val: maxVal };
  }, [currentData]);

  const avgKwh = useMemo(() => {
    const activeDays = (currentData || []).filter((v) => Number(v) > 0).length || 1;
    return currTotalKwh / activeDays;
  }, [currTotalKwh, currentData]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Top-Left: Title and Total kWh */}
        <div className="flex flex-col">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>Konsumsi Bulanan Real Time (vs Bulan Pembanding)</span>
            <span className="text-sky-500 font-extrabold">› Sesuai Pilihan Mesin</span>
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400">
              {formatNumber(currTotalKwh)} <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">kWh</span>
            </span>
            {showPrevious && diffPct !== null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                Number(diffPct) > 0
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              }`}>
                {Number(diffPct) > 0 ? `+${diffPct}%` : `${diffPct}%`} vs bln lalu
              </span>
            )}
          </div>
        </div>

        {/* Top-Right: Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Factory Selector */}
          <select
            value={factory}
            onChange={(e) => setFactory(e.target.value as "wf1" | "wf2")}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-bold text-[#002b5c] dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="wf1">Factory 1</option>
            <option value="wf2">Factory 2</option>
          </select>

          {/* Machine Selector */}
          <select
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-bold text-[#002b5c] dark:text-slate-300 focus:outline-none cursor-pointer max-w-[240px]"
          >
            {machineOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>

          {/* Checkbox perbandingan bulan sebelumnya */}
          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700 transition cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPrevious}
              onChange={(e) => setShowPrevious(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600"
            />
            <span>Bulan Lalu</span>
          </label>

          {/* Status Indicator */}
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
            TERHUBUNG API ({dbData.pmId || "PM"})
          </span>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition cursor-pointer"
            title="Perbesar Tampilan Chart"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            <span>Perbesar</span>
          </button>
        </div>
      </div>

      <div style={{ height: 280 }}>
        <MonthlyComparisonBarChart
          currentData={currentData}
          previousData={previousData}
          isDark={isDark}
          currMonthName={currMonthName}
          prevMonthName={prevMonthName}
          showPrevious={showPrevious}
        />
      </div>

      {/* Zoom Popup Modal - Extra-Large Viewport Filling (98vw x 96vh) */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-1 sm:p-2 md:p-3 animate-in fade-in duration-200"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            }
            setIsZoomOpen(false);
          }}
        >
          <div
            ref={modalContainerRef}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-150"
            style={{
              width: isFullscreen ? "100vw" : "98vw",
              maxWidth: isFullscreen ? "100vw" : "98vw",
              height: isFullscreen ? "100vh" : "96vh",
              maxHeight: isFullscreen ? "100vh" : "96vh",
              borderRadius: isFullscreen ? "0px" : "1.25rem",
              padding: isFullscreen ? "1.5rem" : "1.25rem 1.5rem"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-wide">
                    {machine} ({dbData.pmId || "PM"})
                  </h3>
                  <span className="text-xs px-3 py-1 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-extrabold tracking-wider uppercase">
                    Perbesar Chart
                  </span>
                </div>
                {/* KPI Metrics Strip */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Bulan Ini:</span>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-[#1f6fb5] dark:text-sky-400">
                      {formatNumber(currTotalKwh)} <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">kWh</span>
                    </span>
                  </div>

                  {showPrevious && (
                    <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {prevMonthName || "Bulan Lalu"}: <strong>{formatNumber(prevTotalKwh)}</strong> kWh
                    </span>
                  )}

                  {showPrevious && diffPct !== null && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                      Number(diffPct) > 0
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    }`}>
                      {Number(diffPct) > 0 ? `+${diffPct}%` : `${diffPct}%`} vs bln lalu
                    </span>
                  )}

                  {avgKwh > 0 && (
                    <span className="hidden sm:inline-flex px-3 py-1 rounded-xl text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      Rata-rata: <strong>{formatNumber(avgKwh)}</strong> kWh/hari
                    </span>
                  )}

                  {peakDayInfo && (
                    <span className="hidden md:inline-flex px-3 py-1 rounded-xl text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20">
                      Puncak: <strong>Tgl {peakDayInfo.day} ({formatNumber(peakDayInfo.val)} kWh)</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Top Right */}
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer select-none transition">
                  <input
                    type="checkbox"
                    checked={showPrevious}
                    onChange={(e) => setShowPrevious(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer accent-blue-600"
                  />
                  <span>Bulan Lalu</span>
                </label>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl transition cursor-pointer"
                  title="Toggle Fullscreen Layar Penuh"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    {isFullscreen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    )}
                  </svg>
                  <span className="hidden sm:inline">{isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen?.().catch(() => {});
                    }
                    setIsZoomOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition cursor-pointer"
                  title="Tutup Modal (ESC)"
                >
                  <span>Tutup</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body: Extra-Large Chart filling full available height */}
            <div className="relative w-full flex-1 min-h-[480px] sm:min-h-[560px] md:min-h-[620px] pt-2">
              <MonthlyComparisonBarChart
                currentData={currentData}
                previousData={previousData}
                isDark={isDark}
                currMonthName={currMonthName}
                prevMonthName={prevMonthName}
                showPrevious={showPrevious}
                isZoomed={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

interface SectionHEquipmentProps {
  isDark: boolean;
  currentMonthIdx: number;
  currentYear: number;
  onBatchDataLoaded?: (data: Record<string, any>) => void;
}

const SectionHEquipment = memo(function SectionHEquipment({
  isDark,
  currentMonthIdx,
  currentYear,
  onBatchDataLoaded
}: SectionHEquipmentProps) {
  const [compMonth, setCompMonth] = useState<number>(() => {
    return currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  });
  const [compYear, setCompYear] = useState<number>(() => {
    return currentMonthIdx === 0 ? currentYear - 1 : currentYear;
  });

  const currMonthLabel = `${MONTH_NAMES_ID[currentMonthIdx]} ${currentYear}`;
  const compMonthLabel = `${MONTH_NAMES_ID[compMonth]} ${compYear}`;

  // Role check for Senior Unit Head
  const role = useAuthStore((state) => state.user?.role);
  const isSeniorUnitHead = isSeniorUnitHeadOrAdmin(role);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configuredItems, setConfiguredItems] = useState<EquipmentDisplayItem[]>([]);
  const [hasLoadedConfig, setHasLoadedConfig] = useState(false);

  // Default Fallback Equipment Items (57 Standard Units)
  const ALL_DEFAULT_ITEMS: EquipmentDisplayItem[] = useMemo(() => [
    // 1. Cooling Tower (7 Units)
    { id: 1, config_type: "equipment_display", config_key: "pm152", label: "Cooling Tower Pump WF1-U3", sort_order: 1, enabled: true, value: { pm_id: "PM152", seriesKey: "F1 COOLING TOWER PUMP WF1-U3", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew21" } },
    { id: 2, config_type: "equipment_display", config_key: "pm181", label: "Cooling Tower Fan WF1-U3", sort_order: 2, enabled: true, value: { pm_id: "PM181", seriesKey: "F1 COOLING TOWER FAN WF1-U3", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew21" } },
    { id: 3, config_type: "equipment_display", config_key: "pm206", label: "Cooling Fase-1 WF2", sort_order: 3, enabled: true, value: { pm_id: "PM206", seriesKey: "F2 COOLING FASE-1", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew22" } },
    { id: 4, config_type: "equipment_display", config_key: "pm215", label: "Cooling Critical WF2", sort_order: 4, enabled: true, value: { pm_id: "PM215", seriesKey: "F2 COOLING CRITICAL", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew22" } },
    { id: 5, config_type: "equipment_display", config_key: "pm318", label: "Cooling Fase-2 WF2", sort_order: 5, enabled: true, value: { pm_id: "PM318", seriesKey: "F2 COOLING FASE-2", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew23" } },
    { id: 6, config_type: "equipment_display", config_key: "pm324", label: "Cooling Tower CT-Pump WF2", sort_order: 6, enabled: true, value: { pm_id: "PM324", seriesKey: "F2 COOLING TOWER CT-PUMP", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew23" } },
    { id: 7, config_type: "equipment_display", config_key: "pm325", label: "Cooling Tower CT-Fan WF2", sort_order: 7, enabled: true, value: { pm_id: "PM325", seriesKey: "F2 COOLING TOWER CT-FAN", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew23" } },

    // 2. Boiler (2 Units)
    { id: 8, config_type: "equipment_display", config_key: "pm184", label: "Boiler 4 WF1", sort_order: 8, enabled: true, value: { pm_id: "PM184", seriesKey: "F1 BOILER 4", category: "boiler", categoryLabel: "Boiler", endpoint_url: "electric_ew21" } },
    { id: 9, config_type: "equipment_display", config_key: "pm213", label: "Boiler-5 WF2", sort_order: 9, enabled: true, value: { pm_id: "PM213", seriesKey: "F2 BOILER-5", category: "boiler", categoryLabel: "Boiler", endpoint_url: "electric_ew22" } },

    // 3. Compressed Air (5 Units)
    { id: 10, config_type: "equipment_display", config_key: "pm140", label: "Compressed Air ZT-55 WF1", sort_order: 10, enabled: true, value: { pm_id: "PM140", seriesKey: "F1 COMPRESSED AIR ZT-55", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew21" } },
    { id: 11, config_type: "equipment_display", config_key: "pm182", label: "Compressed Air ZT-30.1&2 WF1", sort_order: 11, enabled: true, value: { pm_id: "PM182", seriesKey: "F1 COMPRESSED AIR ZT-30.1&2", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew21" } },
    { id: 12, config_type: "equipment_display", config_key: "pm183", label: "Compressed Air ALE-30 WF1", sort_order: 12, enabled: true, value: { pm_id: "PM183", seriesKey: "F1 COMPRESSED AIR ALE-30", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew21" } },
    { id: 13, config_type: "equipment_display", config_key: "pm214", label: "Compressed Air Atlas WF2", sort_order: 13, enabled: true, value: { pm_id: "PM214", seriesKey: "F2 COMPRESSED AIR ATLAS", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew22" } },
    { id: 14, config_type: "equipment_display", config_key: "pm229", label: "Kobelco ALE-250 WF2", sort_order: 14, enabled: true, value: { pm_id: "PM229", seriesKey: "F2 KOBELCO ALE-250", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew22" } },

    // 4. Chiller (8 Units)
    { id: 15, config_type: "equipment_display", config_key: "pm177", label: "Chiller Prep Daikin Barat WF1", sort_order: 15, enabled: true, value: { pm_id: "PM177", seriesKey: "F1 CHILLER PREP DAIKIN BARAT", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew21" } },
    { id: 16, config_type: "equipment_display", config_key: "pm178", label: "Chiller Prep Daikin Timur WF1", sort_order: 16, enabled: true, value: { pm_id: "PM178", seriesKey: "F1 CHILLER PREP DAIKIN TIMUR", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew21" } },
    { id: 17, config_type: "equipment_display", config_key: "pm180", label: "Chiller BP WF1-U3", sort_order: 17, enabled: true, value: { pm_id: "PM180", seriesKey: "F1 CHILLER BP WF1-U3", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew21" } },
    { id: 18, config_type: "equipment_display", config_key: "pm209", label: "Chiller - WF2U2", sort_order: 18, enabled: true, value: { pm_id: "PM209", seriesKey: "F2 CHILLER - WF2U2", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22" } },
    { id: 19, config_type: "equipment_display", config_key: "pm271", label: "Chiller RTAC 250 (RO & HVAC) WF2", sort_order: 19, enabled: true, value: { pm_id: "PM271", seriesKey: "F2 CHILLER RTAC 250 (RO&HVAC)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22" } },
    { id: 20, config_type: "equipment_display", config_key: "pm272", label: "Chiller RTAC 170 (RO) WF2", sort_order: 20, enabled: true, value: { pm_id: "PM272", seriesKey: "F2 CHILLER RTAC 170 (RO)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22" } },
    { id: 21, config_type: "equipment_display", config_key: "pm274", label: "Chiller RTAC 100 (BP) WF2", sort_order: 21, enabled: true, value: { pm_id: "PM274", seriesKey: "F2 CHILLER RTAC 100 (BP)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22" } },
    { id: 22, config_type: "equipment_display", config_key: "pm319", label: "Chiller RTAC-275 (Prep) WF2", sort_order: 22, enabled: true, value: { pm_id: "PM319", seriesKey: "F2 CHILLER RTAC-275 (PREP)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew23" } },

    // 5. HVAC Warehouse & Penerangan (8 Units)
    { id: 23, config_type: "equipment_display", config_key: "pm134", label: "WH 4 Penerangan WF1", sort_order: 23, enabled: true, value: { pm_id: "PM134", seriesKey: "F1 WH 4 PENERANGAN", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21" } },
    { id: 24, config_type: "equipment_display", config_key: "pm154", label: "Lighting WH 1 WF1", sort_order: 24, enabled: true, value: { pm_id: "PM154", seriesKey: "F1 LIGHTING WH 1", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21" } },
    { id: 25, config_type: "equipment_display", config_key: "pm151", label: "HVAC Office Atas WF1", sort_order: 25, enabled: true, value: { pm_id: "PM151", seriesKey: "F1 HVAC OFFICE ATAS", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21" } },
    { id: 26, config_type: "equipment_display", config_key: "pm179", label: "HVAC WH-3 WF1", sort_order: 26, enabled: true, value: { pm_id: "PM179", seriesKey: "F1 HVAC WH-3", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21" } },
    { id: 27, config_type: "equipment_display", config_key: "pm207", label: "WH 6 WF2", sort_order: 27, enabled: true, value: { pm_id: "PM207", seriesKey: "F2 WH 6", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22" } },
    { id: 28, config_type: "equipment_display", config_key: "pm208", label: "WH 5 WF2", sort_order: 28, enabled: true, value: { pm_id: "PM208", seriesKey: "F2 WH 5", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22" } },
    { id: 29, config_type: "equipment_display", config_key: "pm226", label: "WH-7 WF2", sort_order: 29, enabled: true, value: { pm_id: "PM226", seriesKey: "F2 WH-7", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22" } },
    { id: 30, config_type: "equipment_display", config_key: "pm288", label: "Penerangan PD WF2", sort_order: 30, enabled: true, value: { pm_id: "PM288", seriesKey: "F2 Penerangan PD", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22" } },

    // 6. HVAC QC & Produksi (9 Units)
    { id: 31, config_type: "equipment_display", config_key: "pm138", label: "Full Cooling WF1-U3", sort_order: 31, enabled: true, value: { pm_id: "PM138", seriesKey: "F1 FULL COOLING WF1-U3", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21" } },
    { id: 32, config_type: "equipment_display", config_key: "pm153", label: "HVAC-QC WF1", sort_order: 32, enabled: true, value: { pm_id: "PM153", seriesKey: "F1 HVAC-QC", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21" } },
    { id: 33, config_type: "equipment_display", config_key: "pm185", label: "HVAC WF1U3", sort_order: 33, enabled: true, value: { pm_id: "PM185", seriesKey: "F1 HVAC WF1U3", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21" } },
    { id: 34, config_type: "equipment_display", config_key: "pm203", label: "Heater WF2U2", sort_order: 34, enabled: true, value: { pm_id: "PM203", seriesKey: "F2 HEATER WF2U2", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew22" } },
    { id: 35, config_type: "equipment_display", config_key: "pm205", label: "AHU WF2UI", sort_order: 35, enabled: true, value: { pm_id: "PM205", seriesKey: "F2 AHU WF2UI", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew22" } },
    { id: 36, config_type: "equipment_display", config_key: "pm273", label: "Return Sample QC WF2", sort_order: 36, enabled: true, value: { pm_id: "PM273", seriesKey: "RETURN SAMPLE QC", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew22" } },
    { id: 37, config_type: "equipment_display", config_key: "pm321", label: "AHU-1 - WF2U2", sort_order: 37, enabled: true, value: { pm_id: "PM321", seriesKey: "F2 AHU-1 - WF2U2", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew23" } },
    { id: 38, config_type: "equipment_display", config_key: "pm322", label: "AHU-2 - WF2U2", sort_order: 38, enabled: true, value: { pm_id: "PM322", seriesKey: "F2 AHU-2 - WF2U2", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew23" } },
    { id: 39, config_type: "equipment_display", config_key: "pm132", label: "Main Supply QC Office & Lab WF1", sort_order: 39, enabled: true, value: { pm_id: "PM132", seriesKey: "F1 MAIN SUPPLY QC OFFICE & LAB", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21" } },

    // 7. Panel Distribusi & Water Treatment (15 Units)
    { id: 40, config_type: "equipment_display", config_key: "pm133", label: "MDP3 WF1", sort_order: 40, enabled: true, value: { pm_id: "PM133", seriesKey: "F1 MDP3", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21" } },
    { id: 41, config_type: "equipment_display", config_key: "pm135", label: "MDP-2 WF1", sort_order: 41, enabled: true, value: { pm_id: "PM135", seriesKey: "F1 MDP-2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21" } },
    { id: 42, config_type: "equipment_display", config_key: "pm136", label: "MDP-1.2 WF1", sort_order: 42, enabled: true, value: { pm_id: "PM136", seriesKey: "F1 MDP-1.2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21" } },
    { id: 43, config_type: "equipment_display", config_key: "pm139", label: "MDP-1.1 WF1", sort_order: 43, enabled: true, value: { pm_id: "PM139", seriesKey: "F1 MDP-1.1", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21" } },
    { id: 44, config_type: "equipment_display", config_key: "pm175", label: "ST3 WF1", sort_order: 44, enabled: true, value: { pm_id: "PM175", seriesKey: "F1 ST3", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21" } },
    { id: 45, config_type: "equipment_display", config_key: "pm176", label: "QC Lab WF1", sort_order: 45, enabled: true, value: { pm_id: "PM176", seriesKey: "F1 QC LAB", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21" } },
    { id: 46, config_type: "equipment_display", config_key: "pm201", label: "PUTR-1 WF2", sort_order: 46, enabled: true, value: { pm_id: "PM201", seriesKey: "F2 PUTR-1", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22" } },
    { id: 47, config_type: "equipment_display", config_key: "pm202", label: "PUTR-2 WF2", sort_order: 47, enabled: true, value: { pm_id: "PM202", seriesKey: "F2 PUTR-2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22" } },
    { id: 48, config_type: "equipment_display", config_key: "pm210", label: "Main Critical Panel WF2", sort_order: 48, enabled: true, value: { pm_id: "PM210", seriesKey: "F2 MAIN CRITICAL PANEL", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22" } },
    { id: 49, config_type: "equipment_display", config_key: "pm211", label: "Panel Otoklaf WF2U1", sort_order: 49, enabled: true, value: { pm_id: "PM211", seriesKey: "F2 PANEL OTOKLAF WF2U1", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22" } },
    { id: 50, config_type: "equipment_display", config_key: "pm212", label: "Panel Otoklaf WF2U2", sort_order: 50, enabled: true, value: { pm_id: "PM212", seriesKey: "F2 PANEL OTOKLAF WF2U2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22" } },
    { id: 51, config_type: "equipment_display", config_key: "pm320", label: "WT-DU-PSG WF2", sort_order: 51, enabled: true, value: { pm_id: "PM320", seriesKey: "F2 WT-DU-PSG", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23" } },
    { id: 52, config_type: "equipment_display", config_key: "pm323", label: "PW Generation - RO WF2", sort_order: 52, enabled: true, value: { pm_id: "PM323", seriesKey: "F2 PW GENERATION - RO", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23" } },
    { id: 53, config_type: "equipment_display", config_key: "pm327", label: "PUTR-NEW WF2", sort_order: 53, enabled: true, value: { pm_id: "PM327", seriesKey: "F2 PUTR-NEW", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23" } },
    { id: 54, config_type: "equipment_display", config_key: "pm337", label: "MCC BP 7 WF2", sort_order: 54, enabled: true, value: { pm_id: "PM337", seriesKey: "F2 MCC BP 7", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23" } },

    // 8. Incoming Cubicles (3 Units)
    { id: 55, config_type: "equipment_display", config_key: "pm410", label: "Incoming Cubicle PLN (PM8000)", sort_order: 55, enabled: true, value: { pm_id: "PM410", seriesKey: "incoming cubicle pln", category: "cubicles", categoryLabel: "Incoming Cubicles", endpoint_url: "electric_pln" } },
    { id: 56, config_type: "equipment_display", config_key: "pm411", label: "Incoming Cubicle WF1 (PM5560)", sort_order: 56, enabled: true, value: { pm_id: "PM411", seriesKey: "incoming cubicle WF1", category: "cubicles", categoryLabel: "Incoming Cubicles", endpoint_url: "electric_wf1" } },
    { id: 57, config_type: "equipment_display", config_key: "pm412", label: "Incoming Cubicle WF2 (PM5560)", sort_order: 57, enabled: true, value: { pm_id: "PM412", seriesKey: "incoming cubicle WF2", category: "cubicles", categoryLabel: "Incoming Cubicles", endpoint_url: "electric_wf2" } }
  ], []);

  // Standard categories in default order
  const STANDARD_CATEGORIES = useMemo(() => [
    { key: "cooling_tower", defaultLabel: "Cooling Tower" },
    { key: "boiler", defaultLabel: "Boiler" },
    { key: "compressed_air", defaultLabel: "Compressed Air" },
    { key: "chiller", defaultLabel: "Chiller" },
    { key: "hvac_wh", defaultLabel: "HVAC Warehouse & Penerangan" },
    { key: "hvac_qc", defaultLabel: "HVAC QC & Produksi" },
    { key: "distribution", defaultLabel: "Panel Distribusi & Water Treatment" },
    { key: "cubicles", defaultLabel: "Incoming Cubicles" }
  ], []);

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<{
    configKey: string;
    pmId: string;
    sourceCategory: string;
    title: string;
  } | null>(null);
  const [activeDropCategory, setActiveDropCategory] = useState<string | null>(null);
  const [activeDropConfigKey, setActiveDropConfigKey] = useState<string | null>(null);
  const [dragToast, setDragToast] = useState<string | null>(null);

  // Category inline rename state
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState<string>("");

  // Adding new custom category
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customCategoryKeys, setCustomCategoryKeys] = useState<Array<{ key: string; label: string }>>([]);

  // Fetch configured equipment items from database
  const loadConfiguredItems = useCallback(async () => {
    try {
      const res = await getJson<{ success: boolean; data: EquipmentDisplayItem[] }>(
        "/config/electricity/equipment-items"
      );
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setConfiguredItems(res.data);
        setHasLoadedConfig(true);
      }
    } catch (e) {
      console.warn("Could not load equipment display config:", e);
    }
  }, []);

  useEffect(() => {
    loadConfiguredItems();
  }, [loadConfiguredItems]);

  // Compute category groups dynamically (with live unit count and dynamic labels)
  const categoryGroups = useMemo(() => {
    const sourceItems = hasLoadedConfig && configuredItems.length > 0 ? configuredItems : ALL_DEFAULT_ITEMS;
    const activeList = sourceItems.filter((i) => i.enabled !== false);

    const catMap = new Map<string, { label: string; items: any[] }>();

    // Seed standard categories first
    for (const sc of STANDARD_CATEGORIES) {
      catMap.set(sc.key, { label: sc.defaultLabel, items: [] });
    }

    // Seed custom categories added by user
    for (const cc of customCategoryKeys) {
      if (!catMap.has(cc.key)) {
        catMap.set(cc.key, { label: cc.label, items: [] });
      }
    }

    // Distribute items into categories
    for (const item of activeList) {
      const val = item.value || {};
      const catKey = val.category || "custom";
      const catLabel = val.categoryLabel || catMap.get(catKey)?.label || (catKey === "custom" ? "Equipment Kustom / Tambahan" : catKey);

      if (!catMap.has(catKey)) {
        catMap.set(catKey, { label: catLabel, items: [] });
      }

      const rawPm = (val.pm_id || item.config_key).toUpperCase();
      const resolvedPm = rawPm.startsWith("PM") ? rawPm : `PM_${rawPm}`;

      const catEntry = catMap.get(catKey)!;
      if (val.categoryLabel) catEntry.label = val.categoryLabel;

      catEntry.items.push({
        title: item.label,
        seriesKey: val.seriesKey || item.label.toUpperCase(),
        pmId: resolvedPm,
        configKey: item.config_key,
        sortOrder: item.sort_order ?? 0,
        category: catKey,
        categoryLabel: catEntry.label
      });
    }

    // Sort items within each category by sortOrder
    const groups: Array<{ key: string; label: string; items: any[] }> = [];
    for (const [key, val] of catMap.entries()) {
      val.items.sort((a, b) => a.sortOrder - b.sortOrder);
      if (STANDARD_CATEGORIES.some((sc) => sc.key === key) || val.items.length > 0 || customCategoryKeys.some((cc) => cc.key === key)) {
        groups.push({
          key,
          label: val.label,
          items: val.items
        });
      }
    }

    return groups;
  }, [hasLoadedConfig, configuredItems, ALL_DEFAULT_ITEMS, STANDARD_CATEGORIES, customCategoryKeys]);

  const totalActiveCount = useMemo(() => {
    return categoryGroups.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [categoryGroups]);

  // Drag and Drop event handlers
  const handleDragStart = (e: React.DragEvent, item: any, categoryKey: string) => {
    if (!isSeniorUnitHead) return;
    setDraggedItem({
      configKey: item.configKey,
      pmId: item.pmId,
      sourceCategory: categoryKey,
      title: item.title
    });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.configKey);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setActiveDropCategory(null);
    setActiveDropConfigKey(null);
  };

  const handleDragOverCategory = (e: React.DragEvent, categoryKey: string) => {
    if (!draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (activeDropCategory !== categoryKey) {
      setActiveDropCategory(categoryKey);
    }
  };

  const handleDragLeaveCategory = () => {
    // will be reset on drag end or when entering another area
  };

  const handleDragOverCard = (e: React.DragEvent, categoryKey: string, targetConfigKey: string) => {
    if (!draggedItem) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (activeDropCategory !== categoryKey) setActiveDropCategory(categoryKey);
    if (activeDropConfigKey !== targetConfigKey) setActiveDropConfigKey(targetConfigKey);
  };

  const handleDrop = async (targetCategoryKey: string, targetConfigKey?: string) => {
    if (!draggedItem) return;
    const { configKey, title } = draggedItem;

    const targetGroup = categoryGroups.find((g) => g.key === targetCategoryKey);
    const targetCategoryLabel = targetGroup ? targetGroup.label : targetCategoryKey;

    const prevItems = (hasLoadedConfig && configuredItems.length > 0) ? [...configuredItems] : [...ALL_DEFAULT_ITEMS];
    const itemIndex = prevItems.findIndex((i) => i.config_key.toLowerCase() === configKey.toLowerCase());
    if (itemIndex === -1) {
      handleDragEnd();
      return;
    }

    const itemToMove = { ...prevItems[itemIndex] };
    itemToMove.value = {
      ...(itemToMove.value || {}),
      category: targetCategoryKey,
      categoryLabel: targetCategoryLabel
    };

    // Remove from previous position
    const remaining = prevItems.filter((i) => i.config_key.toLowerCase() !== configKey.toLowerCase());

    // Determine insertion index
    let insertIndex = remaining.length;
    if (targetConfigKey) {
      const targetIdx = remaining.findIndex((i) => i.config_key.toLowerCase() === targetConfigKey.toLowerCase());
      if (targetIdx !== -1) {
        insertIndex = targetIdx;
      }
    } else {
      const lastInTargetCat = remaining
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => (it.value?.category || "custom") === targetCategoryKey);
      if (lastInTargetCat.length > 0) {
        insertIndex = lastInTargetCat[lastInTargetCat.length - 1].idx + 1;
      }
    }

    remaining.splice(insertIndex, 0, itemToMove);

    // Re-index sort order
    const reindexed = remaining.map((it, idx) => ({
      ...it,
      sort_order: idx + 1
    }));

    // Optimistic UI update
    setConfiguredItems(reindexed);
    setHasLoadedConfig(true);
    handleDragEnd();

    setDragToast(`✓ '${title}' berhasil dipindahkan ke kategori ${targetCategoryLabel.toUpperCase()}`);
    setTimeout(() => setDragToast(null), 3500);

    // Persist to backend database
    try {
      const payload = reindexed.map((it) => ({
        config_key: it.config_key,
        category: it.value?.category || targetCategoryKey,
        categoryLabel: it.value?.categoryLabel || targetCategoryLabel,
        sort_order: it.sort_order
      }));

      await postJson("/config/electricity/equipment-items/reorder", { items: payload });
    } catch (err: any) {
      console.warn("Failed to persist reordered equipment items:", err);
    }
  };

  const handleDropOnCategory = (e: React.DragEvent, categoryKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleDrop(categoryKey);
  };

  // Inline Category Rename
  const handleSaveCategoryRename = async (categoryKey: string) => {
    const trimmed = editingCategoryLabel.trim();
    if (!trimmed) {
      setEditingCategoryKey(null);
      return;
    }

    try {
      await postJson("/config/electricity/equipment-items/rename-category", {
        category: categoryKey,
        newCategoryLabel: trimmed
      });

      setConfiguredItems((prev) =>
        prev.map((item) => {
          if ((item.value?.category || "") === categoryKey) {
            return {
              ...item,
              value: {
                ...item.value,
                categoryLabel: trimmed
              }
            };
          }
          return item;
        })
      );

      setCustomCategoryKeys((prev) =>
        prev.map((c) => (c.key === categoryKey ? { ...c, label: trimmed } : c))
      );

      setDragToast(`✓ Nama kategori berhasil diubah menjadi '${trimmed.toUpperCase()}'`);
      setTimeout(() => setDragToast(null), 3500);
    } catch (err: any) {
      console.error("Gagal mengubah nama kategori:", err);
    } finally {
      setEditingCategoryKey(null);
    }
  };

  // Add new category
  const handleCreateNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setIsAddingCategory(false);
      return;
    }

    const newKey = `cat_${Date.now()}`;
    setCustomCategoryKeys((prev) => [...prev, { key: newKey, label: trimmed }]);
    setNewCategoryName("");
    setIsAddingCategory(false);

    setDragToast(`✓ Kategori baru '${trimmed.toUpperCase()}' berhasil ditambahkan. Silakan tarik kartu ke kategori ini.`);
    setTimeout(() => setDragToast(null), 3500);
  };

  // Helper for responsive grid column count per category
  const getCategoryGridClass = (catKey: string, itemCount: number) => {
    if (catKey === "boiler" && itemCount <= 2) return "grid gap-6 md:grid-cols-2";
    if (catKey === "chiller" || catKey === "hvac_wh") return "grid gap-6 md:grid-cols-2 lg:grid-cols-4";
    if (catKey === "cubicles") return "grid gap-6 md:grid-cols-3";
    return "grid gap-6 md:grid-cols-2 lg:grid-cols-3";
  };

  // Dynamic state from database batch endpoint
  const [batchData, setBatchData] = useState<Record<string, {
    pmId: string;
    label: string;
    current: number[];
    previous: number[];
    currTotalKwh: number;
    prevTotalKwh: number;
    hasData: boolean;
  }>>({});
  const [loading, setLoading] = useState(false);

  const fetchEquipmentBatch = useCallback((force = false) => {
    if (!force) setLoading(true);
    const currMonthStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
    const compMonthStr = `${compYear}-${String(compMonth + 1).padStart(2, "0")}`;
    const forceQuery = force ? "&force=true" : "";
    getJson<{
      success: boolean;
      currentMonth: string;
      comparisonMonth: string;
      daysInCurrent: number;
      daysInComparison: number;
      data: Record<string, any>;
    }>(`/analytics/electricity/equipment-monthly-batch?currentMonth=${currMonthStr}&comparisonMonth=${compMonthStr}${forceQuery}`)
      .then((res) => {
        if (res?.data) {
          setBatchData(res.data);
          onBatchDataLoaded?.(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load equipment monthly batch data:", err);
        setLoading(false);
      });
  }, [currentYear, currentMonthIdx, compYear, compMonth, onBatchDataLoaded]);

  useEffect(() => {
    let isCancelled = false;
    fetchEquipmentBatch(false);

    // Auto-refresh when new minute telemetry arrives via websocket
    const socket = getSocket();
    const handleUpdate = () => {
      if (isCancelled) return;
      const now = new Date();
      if (currentYear === now.getFullYear() && currentMonthIdx === now.getMonth()) {
        fetchEquipmentBatch(true);
      }
    };
    socket.on("electricity:update", handleUpdate);

    return () => {
      isCancelled = true;
      socket.off("electricity:update", handleUpdate);
    };
  }, [fetchEquipmentBatch, currentYear, currentMonthIdx]);

  const renderCard = (
    item: { title: string; seriesKey: string; pmId: string; configKey: string },
    categoryKey: string
  ) => {
    const itemData = batchData[item.pmId] || batchData[item.seriesKey.toLowerCase()] || batchData[item.title.toLowerCase()];
    const current = itemData?.current || [];
    const previous = itemData?.previous || [];

    const isBeingDragged = draggedItem?.configKey.toLowerCase() === item.configKey.toLowerCase();
    const isDropTarget = activeDropConfigKey?.toLowerCase() === item.configKey.toLowerCase();

    return (
      <div
        key={item.pmId || item.title}
        draggable={isSeniorUnitHead}
        onDragStart={(e) => handleDragStart(e, item, categoryKey)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOverCard(e, categoryKey, item.configKey)}
        onDrop={(e) => {
          e.stopPropagation();
          handleDrop(categoryKey, item.configKey);
        }}
        className={`relative group transition-all duration-200 ${
          isBeingDragged
            ? "opacity-30 scale-95 ring-2 ring-sky-500 rounded-2xl cursor-grabbing"
            : isDropTarget
            ? "ring-2 ring-sky-400 ring-offset-2 scale-[1.01] rounded-2xl"
            : ""
        }`}
      >
        {isSeniorUnitHead && (
          <div
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-sky-500 hover:border-sky-500/50 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-grab active:cursor-grabbing shadow-sm select-none transition"
            title="Tahan dan tarik (Drag & Drop) kartu ini untuk memindahkan posisi atau kategori"
          >
            <span className="text-xs">⋮⋮</span>
            <span className="text-[9px] uppercase tracking-wider font-extrabold hidden sm:inline">Pindahkan</span>
          </div>
        )}

        <MonthlyComparisonChart
          title={`${item.title} (${item.pmId})`}
          currentData={current}
          previousData={previous}
          isDark={isDark}
          currMonthName={currMonthLabel}
          prevMonthName={compMonthLabel}
        />
      </div>
    );
  };

  return (
    <div className="space-y-8 relative">
      {/* Floating Drag & Drop Toast Notification */}
      {dragToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-2xl border border-sky-500/40 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-emerald-400 dark:text-emerald-600 text-sm">✓</span>
          <span>{dragToast}</span>
        </div>
      )}

      {/* Header with Comparison Filter & Senior Unit Head Edit Button */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">
              Konsumsi Per-Equipment (Bulanan vs Bulan Pembanding)
            </h3>
            {isSeniorUnitHead && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition cursor-pointer"
                  title="Kelola Tampilan Equipment & Daftarkan PM Baru (Senior Unit Head Only)"
                >
                  <span>⚙️ Kelola Equipment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition cursor-pointer"
                  title="Tambah Kategori Dropzone Baru"
                >
                  <span>+ Kategori Baru</span>
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Perbandingan konsumsi listrik per-equipment antara Bulan Ini dan Bulan Pembanding yang dipilih.
            {isSeniorUnitHead && (
              <span className="ml-1 text-sky-500 font-medium">
                (Tarik kartu chart dengan tombol ⋮⋮ untuk mengatur posisi atau memindahkan kategori bebas).
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Base Month Chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400 text-xs font-bold">
            <span className="text-[10px] uppercase text-sky-500/70">Bulan Ini:</span>
            <span>{currMonthLabel}</span>
          </div>

          <span className="text-xs font-bold text-slate-400">VS</span>

          {/* Comparison Month & Year Selectors */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold uppercase text-slate-400 px-1">Bulan Pembanding:</span>
            <select
              value={compMonth}
              onChange={(e) => setCompMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {MONTH_NAMES_ID.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
            <select
              value={compYear}
              onChange={(e) => setCompYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {AVAILABLE_YEARS.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${loading ? "bg-amber-500 animate-ping" : "bg-emerald-500 animate-pulse"}`} />
            {loading ? "Memuat Data Database..." : `${totalActiveCount} Unit Sub-Metering Terhubung (API Aktif)`}
          </span>
        </div>
      </div>

      {/* Inline Form to Add New Category */}
      {isAddingCategory && (
        <form
          onSubmit={handleCreateNewCategory}
          className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 flex flex-wrap items-center gap-3 animate-in fade-in duration-200"
        >
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
            Nama Kategori Baru:
          </span>
          <input
            type="text"
            required
            autoFocus
            placeholder="Contoh: Air Compressor Tambahan, Ruang Produksi 3..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Buat Kategori
          </button>
          <button
            type="button"
            onClick={() => setIsAddingCategory(false)}
            className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            Batal
          </button>
        </form>
      )}

      {/* Dynamic Category Sections with Drag & Drop */}
      {categoryGroups.map((cat) => {
        const isCatActiveDrop = activeDropCategory === cat.key && !activeDropConfigKey;

        return (
          <div
            key={cat.key}
            onDragOver={(e) => handleDragOverCategory(e, cat.key)}
            onDragLeave={handleDragLeaveCategory}
            onDrop={(e) => handleDropOnCategory(e, cat.key)}
            className={`space-y-3 transition-all duration-200 rounded-2xl p-2.5 ${
              isCatActiveDrop
                ? "bg-sky-500/5 ring-2 ring-dashed ring-sky-400 p-4 shadow-inner"
                : ""
            }`}
          >
            {/* Category Header with Auto-Adjusting Unit Count & Inline Rename */}
            <div className="flex items-center justify-between group pb-0.5">
              <div className="flex items-center gap-2">
                {editingCategoryKey === cat.key ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveCategoryRename(cat.key);
                    }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sky-500 text-xs">●</span>
                    <input
                      type="text"
                      autoFocus
                      value={editingCategoryLabel}
                      onChange={(e) => setEditingCategoryLabel(e.target.value)}
                      className="px-2.5 py-1 text-xs font-bold uppercase rounded-lg border border-sky-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none shadow-sm"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-[11px] font-bold bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition cursor-pointer"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCategoryKey(null)}
                      className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    >
                      Batal
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">
                      ● {cat.label.toUpperCase()} ({cat.items.length} UNIT)
                    </h4>
                    {isSeniorUnitHead && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryKey(cat.key);
                          setEditingCategoryLabel(cat.label);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition p-1 text-[11px] text-slate-400 hover:text-sky-500 rounded hover:bg-sky-500/10 cursor-pointer"
                        title="Klik untuk mengubah nama kategori ini"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isSeniorUnitHead && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400/80 opacity-0 group-hover:opacity-100 transition hidden sm:inline">
                  Tarik kartu ke kategori ini
                </span>
              )}
            </div>

            {/* Cards Grid or Empty Dropzone */}
            {cat.items.length > 0 ? (
              <div className={getCategoryGridClass(cat.key, cat.items.length)}>
                {cat.items.map((item) => renderCard(item, cat.key))}
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-1.5 ${
                  isCatActiveDrop
                    ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400"
                }`}
              >
                <span className="text-xl">📥</span>
                <span className="text-xs font-bold">Kategori Kosong (0 Unit)</span>
                <span className="text-[10px] text-slate-400">
                  Tarik kartu chart dari kategori lain ke sini untuk memindahkan ke {cat.label}.
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Dynamic Selection Chart (Sesuai Pilihan) */}
      <DynamicSelectionChart
        isDark={isDark}
        currMonthName={currMonthLabel}
        prevMonthName={compMonthLabel}
        currentYear={currentYear}
        currentMonthIdx={currentMonthIdx}
        compYear={compYear}
        compMonthIdx={compMonth}
      />

      {/* Senior Unit Head Equipment Config Modal */}
      {isSeniorUnitHead && (
        <EquipmentConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          isDark={isDark}
          onItemsUpdated={() => {
            loadConfiguredItems();
            fetchEquipmentBatch(true);
          }}
        />
      )}
    </div>
  );
});

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function Electricity() {
  const isPageActive = usePageActive();
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("ytd");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const config = ranges.find((item) => item.id === range) ?? ranges[0];

  const [chartStartDate, setChartStartDate] = useState(getLocalTodayString);
  const [chartEndDate, setChartEndDate] = useState(getLocalTodayString);

  const maxIdx = useMemo(() => getElapsedIndex(config.type), [config.type]);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [isFilterPending, setIsFilterPending] = useState(false);
  const [isSolarFilterPending, setIsSolarFilterPending] = useState(false);
  const plnCacheRef = useRef<Map<string, { data: any; ts: number }>>(new Map());
  const solarCacheRef = useRef<Map<string, { data: any; ts: number }>>(new Map());

  const [livePf, setLivePf] = useState<number | null>(null);
  const [pfStatus, setPfStatus] = useState<"connected" | "offline">("offline");

  // Solar Panel (PLTS) states
  const [solarData, setSolarData] = useState<any>(null);
  const [solarLive, setSolarLive] = useState<any>(null);

  // Dedicated state for fixed monthly executive recap (Bulan Ini)
  const [fixedMonthlyPln, setFixedMonthlyPln] = useState<any>(null);
  const [fixedMonthlySolar, setFixedMonthlySolar] = useState<any>(null);
  const [solarRange, setSolarRange] = useState<"hour" | "day" | "month" | "ytd" | "custom">("ytd");
  const [solarStartDate, setSolarStartDate] = useState(getLocalTodayString);
  const [solarEndDate, setSolarEndDate] = useState(getLocalTodayString);
  const [solarSelectedYear, setSolarSelectedYear] = useState(() => new Date().getFullYear());
  const [solarSelectedMonth, setSolarSelectedMonth] = useState(() => new Date().getMonth());
  const [solarShowPoi1, setSolarShowPoi1] = useState(true);
  const [solarShowPoi2, setSolarShowPoi2] = useState(true);

  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const wbpRate = useConfigStore((state) => state.wbpRate);
  const lwbpRate = useConfigStore((state) => state.lwbpRate);
  const pvRate = useConfigStore((state) => state.pvRate);

  // Live PLTS Data (Solar POI 1 & POI 2)
  const [pltsLive, setPltsLive] = useState<{
    poi1: { status: boolean; online?: boolean; volt_ab: number; active_power: number; peak_demand: number; total_kwh: number; frequency: number };
    poi2: { status: boolean; online?: boolean; volt_ab: number; active_power: number; peak_demand: number; total_kwh: number; frequency: number };
  }>({
    poi1: { status: false, online: false, volt_ab: 0, active_power: 0, peak_demand: 0, total_kwh: 0, frequency: 0 },
    poi2: { status: false, online: false, volt_ab: 0, active_power: 0, peak_demand: 0, total_kwh: 0, frequency: 0 }
  });

  // Live socket & API telemetry states for real-time streaming
  const [livePGridKw, setLivePGridKw] = useState<number | null>(null);
  const [livePeakDemandKw, setLivePeakDemandKw] = useState<number | null>(null);
  const [liveWf1Kw, setLiveWf1Kw] = useState<number | null>(null);
  const [liveWf2Kw, setLiveWf2Kw] = useState<number | null>(null);
  const [liveWf1Status, setLiveWf1Status] = useState<boolean>(true);
  const [liveWf2Status, setLiveWf2Status] = useState<boolean>(true);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(true);

  // Safety timeout so cards never get stuck indefinitely in "POLLING..." skeleton state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLiveLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Incoming Cubicle selector (All, PLN, WF1, WF2, POI1, POI2)
  const [cubicleSelector, setCubicleSelector] = useState<"all" | "pln" | "wf1" | "wf2" | "poi1" | "poi2">("all");
  const [cubiclePoiView, setCubiclePoiView] = useState(false);
  const [cubicleAnalytics, setCubicleAnalytics] = useState<any>(null);

  // Fetch device-specific analytics when cubicle selector changes or on interval
  const fetchCubicleAnalytics = useCallback((force = false) => {
    let devId = "all";
    if (cubicleSelector === "pln") devId = "Cubicle_PLN_PM8000";
    if (cubicleSelector === "wf1") devId = "Feeder_WF1_PM5560";
    if (cubicleSelector === "wf2") devId = "Feeder_WF2_PM5500";
    if (cubicleSelector === "poi1") devId = "Solar_POI1";
    if (cubicleSelector === "poi2") devId = "Solar_POI2";

    const forceQuery = force ? "&force=true" : "";
    getJson<{ data: any }>(`/analytics/electricity?deviceId=${devId}&year=${selectedYear}&_t=${Date.now()}${forceQuery}`)
      .then((res) => {
        if (res?.data) setCubicleAnalytics(res.data);
      })
      .catch((err) => console.error("Failed to load cubicle analytics:", err));
  }, [cubicleSelector, selectedYear]);

  useEffect(() => {
    fetchCubicleAnalytics();
  }, [fetchCubicleAnalytics]);

  // Computed summary metrics based on selected cubicle
  const cubicleSummary = useMemo(() => {
    const s = cubicleAnalytics?.summary || (cubicleSelector === "pln" ? summaryData?.summary : {}) || {};
    const isSolar = cubicleSelector === "poi1" || cubicleSelector === "poi2";
    const isAll = cubicleSelector === "all";

    const poi1 = solarLive?.poi1?.totalKwh ?? solarData?.summary?.poi1TotalKwh ?? 0;
    const poi2 = solarLive?.poi2?.totalKwh ?? solarData?.summary?.poi2TotalKwh ?? 0;

    let peak = Number(s.peakDemand) || 0;
    if (peak === 0) {
      if (cubicleSelector === "poi1") peak = solarLive?.poi1?.peakDemand || pltsLive.poi1.peak_demand || pltsLive.poi1.active_power || 0;
      else if (cubicleSelector === "poi2") peak = solarLive?.poi2?.peakDemand || pltsLive.poi2.peak_demand || pltsLive.poi2.active_power || 0;
      else if (cubicleSelector === "pln") peak = livePeakDemandKw || Number(summaryData?.pqData?.peakDemand || 0) || Number(summaryData?.pqData?.activePower || 0);
      else if (cubicleSelector === "all") peak = (livePeakDemandKw || Number(summaryData?.pqData?.peakDemand || 0) || Number(summaryData?.pqData?.activePower || 0)) + (solarLive?.poi1?.peakDemand || 0) + (solarLive?.poi2?.peakDemand || 0);
      else peak = Number(summaryData?.pqData?.activePower || 0);
    }

    let lwbp = isSolar ? 0 : (Number(s.monthlyLwbpKwh ?? s.todayLwbpKwh) || 0);
    let wbp = isSolar ? 0 : (Number(s.monthlyWbpKwh ?? s.todayWbpKwh) || 0);
    let total = Number(s.monthlyKwh ?? (s.monthlyMwh ? s.monthlyMwh * 1000 : null) ?? (lwbp + wbp)) || 0;

    if (total === 0) {
      if (cubicleSelector === "poi1") total = pltsLive.poi1.total_kwh || (solarData?.summary?.poi1TodayKwh || 0);
      else if (cubicleSelector === "poi2") total = pltsLive.poi2.total_kwh || (solarData?.summary?.poi2TodayKwh || 0);
    }

    let cost = 0;
    if (isSolar) {
      const currentPvRate = typeof pvRate === "number" ? pvRate : (Number(solarData?.summary?.pvRate) || 0);
      cost = total * currentPvRate;
    } else {
      cost = Number(s.monthlyCost ?? (lwbp * lwbpRate + wbp * wbpRate)) || 0;
    }
    if (isAll && (!cost || cost === 0)) {
      cost = Number(summaryData?.summary?.monthlyCost || (lwbp * lwbpRate + wbp * wbpRate) || 0);
    }

    return {
      peakDemand: peak,
      lwbpKwh: lwbp,
      wbpKwh: wbp,
      monthlyKwh: total,
      cost: cost,
      poi1Kwh: poi1,
      poi2Kwh: poi2
    };
  }, [cubicleAnalytics, summaryData, cubicleSelector, solarLive, solarData, pltsLive, lwbpRate, wbpRate, pvRate]);

  // Daily Comparison Data (Bulan Ini vs Bulan Lalu) for selected cubicle
  const cubicleDailyData = useMemo(() => {
    const dailyRecords = cubicleAnalytics?.charts?.daily || (cubicleSelector === "pln" ? summaryData?.charts?.daily : []) || [];
    const now = new Date();
    const currYear = selectedYear;
    const currMonth = now.getMonth() + 1; // 1-12
    const prevYear = currMonth === 1 ? currYear - 1 : currYear;
    const prevMonth = currMonth === 1 ? 12 : currMonth - 1;

    const currMonthPrefix = `${currYear}-${String(currMonth).padStart(2, "0")}`;
    const prevMonthPrefix = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const daysInCurrMonth = new Date(currYear, currMonth, 0).getDate();
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const daysCount = Math.max(daysInCurrMonth, daysInPrevMonth);

    // Build solar daily lookup from solarData if needed as fallback
    const solarDailyMap: Record<string, { poi1: number; poi2: number }> = {};
    (solarData?.charts?.daily || []).forEach((d: any) => {
      if (d.day) {
        solarDailyMap[d.day] = { poi1: d.poi1 || 0, poi2: d.poi2 || 0 };
      }
    });

    // Build PLN daily lookup from summaryData if needed
    const plnDailyMap: Record<string, { value: number; wbp: number; lwbp: number }> = {};
    (summaryData?.charts?.daily || []).forEach((d: any) => {
      if (d.day) {
        plnDailyMap[d.day] = { value: d.value || 0, wbp: d.wbp || 0, lwbp: d.lwbp || 0 };
      }
    });

    interface DayDetail {
      val: number;
      pln: number;
      poi1: number;
      poi2: number;
      wbp: number;
      lwbp: number;
    }

    const currMap: Record<number, DayDetail> = {};
    const prevMap: Record<number, DayDetail> = {};

    dailyRecords.forEach((d: any) => {
      if (!d.day) return;
      const dayNum = parseInt(d.day.split("-")[2], 10);
      const isCurr = d.day.startsWith(currMonthPrefix);
      const isPrev = d.day.startsWith(prevMonthPrefix);
      if (!isCurr && !isPrev) return;

      const plnVal = typeof d.pln === "number" ? d.pln : (cubicleSelector === "all" ? (plnDailyMap[d.day]?.value || 0) : d.value || 0);
      const poi1Val = typeof d.poi1 === "number" ? d.poi1 : (solarDailyMap[d.day]?.poi1 || 0);
      const poi2Val = typeof d.poi2 === "number" ? d.poi2 : (solarDailyMap[d.day]?.poi2 || 0);
      const totalVal = cubicleSelector === "all"
        ? (typeof d.pln === "number" ? d.value : (plnVal + poi1Val + poi2Val))
        : (d.value || 0);

      const entry: DayDetail = {
        val: totalVal,
        pln: plnVal,
        poi1: poi1Val,
        poi2: poi2Val,
        wbp: cubicleSelector === "all" ? (plnDailyMap[d.day]?.wbp ?? (d.wbp || 0)) : (d.wbp || 0),
        lwbp: cubicleSelector === "all" ? (plnDailyMap[d.day]?.lwbp ?? (d.lwbp || 0)) : (d.lwbp || 0)
      };

      if (isCurr) currMap[dayNum] = entry;
      if (isPrev) prevMap[dayNum] = entry;
    });

    // If cubicleSelector === "all" and dailyRecords was empty or didn't have current days yet, fill from plnDailyMap + solarDailyMap
    if (cubicleSelector === "all") {
      for (let i = 1; i <= daysCount; i++) {
        const curDayStr = `${currMonthPrefix}-${String(i).padStart(2, "0")}`;
        const prevDayStr = `${prevMonthPrefix}-${String(i).padStart(2, "0")}`;

        if (!currMap[i] && (plnDailyMap[curDayStr] || solarDailyMap[curDayStr])) {
          const p = plnDailyMap[curDayStr]?.value || 0;
          const s1 = solarDailyMap[curDayStr]?.poi1 || 0;
          const s2 = solarDailyMap[curDayStr]?.poi2 || 0;
          currMap[i] = {
            val: p + s1 + s2,
            pln: p,
            poi1: s1,
            poi2: s2,
            wbp: plnDailyMap[curDayStr]?.wbp || 0,
            lwbp: plnDailyMap[curDayStr]?.lwbp || 0
          };
        }

        if (!prevMap[i] && (plnDailyMap[prevDayStr] || solarDailyMap[prevDayStr])) {
          const p = plnDailyMap[prevDayStr]?.value || 0;
          const s1 = solarDailyMap[prevDayStr]?.poi1 || 0;
          const s2 = solarDailyMap[prevDayStr]?.poi2 || 0;
          prevMap[i] = {
            val: p + s1 + s2,
            pln: p,
            poi1: s1,
            poi2: s2,
            wbp: plnDailyMap[prevDayStr]?.wbp || 0,
            lwbp: plnDailyMap[prevDayStr]?.lwbp || 0
          };
        }
      }
    }

    const currentData: number[] = [];
    const previousData: number[] = [];
    const currentBreakdown: { day: number; pln: number; poi1: number; poi2: number; wbp: number; lwbp: number }[] = [];
    const previousBreakdown: { day: number; pln: number; poi1: number; poi2: number; wbp: number; lwbp: number }[] = [];

    for (let i = 1; i <= daysCount; i++) {
      const cur = currMap[i] || { val: 0, pln: 0, poi1: 0, poi2: 0, wbp: 0, lwbp: 0 };
      const prev = prevMap[i] || { val: 0, pln: 0, poi1: 0, poi2: 0, wbp: 0, lwbp: 0 };

      currentData.push(cur.val);
      previousData.push(prev.val);

      currentBreakdown.push({
        day: i,
        pln: cur.pln,
        poi1: cur.poi1,
        poi2: cur.poi2,
        wbp: cur.wbp,
        lwbp: cur.lwbp
      });

      previousBreakdown.push({
        day: i,
        pln: prev.pln,
        poi1: prev.poi1,
        poi2: prev.poi2,
        wbp: prev.wbp,
        lwbp: prev.lwbp
      });
    }

    return { currentData, previousData, currentBreakdown, previousBreakdown };
  }, [cubicleAnalytics, summaryData, solarData, cubicleSelector, selectedYear]);

  // Executive summary combining PLN and Solar PV - fixed for current active month (Bulan Saat Ini)
  const executiveSummary = useMemo(() => {
    const now = new Date();
    const currMonthIdx = now.getMonth(); // 0-11
    const currMonthStr = `${now.getFullYear()}-${String(currMonthIdx + 1).padStart(2, "0")}`;

    // 1. PLN Monthly Metrics for Current Month
    let plnKwh = 0;
    let plnCost = 0;

    let dailyPlnKwh = 0;
    let dailyPlnWbpKwh = 0;
    let dailyPlnLwbpKwh = 0;
    if (cubicleDailyData?.currentBreakdown) {
      cubicleDailyData.currentBreakdown.forEach((d) => {
        dailyPlnKwh += d.pln || 0;
        dailyPlnWbpKwh += d.wbp || 0;
        dailyPlnLwbpKwh += d.lwbp || 0;
      });
    }

    const plnSource = fixedMonthlyPln?.summary || summaryData?.summary;
    if (plnSource?.perMonthSummary && Array.isArray(plnSource.perMonthSummary)) {
      const curMonthPln = plnSource.perMonthSummary.find((m: any) => m.month === currMonthStr) || plnSource.perMonthSummary[currMonthIdx];
      if (curMonthPln) {
        plnKwh = dailyPlnKwh > 0 ? dailyPlnKwh : (Number(curMonthPln.totalKwh) || 0);
        plnCost = Number(curMonthPln.totalCost) || 0;
      }
    }

    if (plnKwh === 0 && dailyPlnKwh > 0) {
      plnKwh = dailyPlnKwh;
    }
    if (plnKwh === 0 && plnSource?.monthlyKwh) {
      plnKwh = Number(plnSource.monthlyKwh) || 0;
    }

    if (plnCost === 0 && plnKwh > 0) {
      const effectiveLwbpRate = typeof lwbpRate === "number" && lwbpRate > 0 ? lwbpRate : 1112;
      const effectiveWbpRate = typeof wbpRate === "number" && wbpRate > 0 ? wbpRate : 1668;
      if (dailyPlnWbpKwh > 0 || dailyPlnLwbpKwh > 0) {
        plnCost = (dailyPlnWbpKwh * effectiveWbpRate) + (dailyPlnLwbpKwh * effectiveLwbpRate);
      } else {
        plnCost = plnKwh * effectiveLwbpRate;
      }
    }

    // 2. Solar PV Monthly Metrics for Current Month
    let poi1Kwh = 0;
    let poi2Kwh = 0;
    let totalPvKwh = 0;

    if (cubicleDailyData?.currentBreakdown) {
      cubicleDailyData.currentBreakdown.forEach((d) => {
        poi1Kwh += d.poi1 || 0;
        poi2Kwh += d.poi2 || 0;
      });
      totalPvKwh = poi1Kwh + poi2Kwh;
    }

    const solarSource = fixedMonthlySolar || solarData;
    if (totalPvKwh === 0) {
      const monthlySolarCharts = solarSource?.charts?.monthly || [];
      const curMonthSolar = monthlySolarCharts.find((m: any) => m.month === currMonthStr) || monthlySolarCharts[currMonthIdx];
      if (curMonthSolar) {
        poi1Kwh = Number(curMonthSolar.poi1) || 0;
        poi2Kwh = Number(curMonthSolar.poi2) || 0;
        totalPvKwh = Number(curMonthSolar.total) || (poi1Kwh + poi2Kwh);
      } else if (solarSource?.summary?.monthlyKwh) {
        totalPvKwh = Number(solarSource.summary.monthlyKwh) || 0;
        poi1Kwh = Number(solarSource.summary.poi1MonthlyKwh) || (totalPvKwh * 0.27);
        poi2Kwh = Number(solarSource.summary.poi2MonthlyKwh) || (totalPvKwh * 0.73);
      }
    }

    const effectiveSolarRate = (Number(solarSource?.summary?.solarRate) > 0 ? Number(solarSource.summary.solarRate) : (typeof lwbpRate === "number" && lwbpRate > 0 ? lwbpRate : 1035.78));
    const effectiveLwbpRate = typeof lwbpRate === "number" && lwbpRate > 0 ? lwbpRate : 1112;
    const effectivePvRate = typeof pvRate === "number" && pvRate > 0 
      ? pvRate 
      : (Number(solarSource?.summary?.pvRate) > 0 ? Number(solarSource.summary.pvRate) : 549);

    const pvCost = totalPvKwh * effectivePvRate;
    const savingsRate = Math.max(0, effectiveSolarRate - effectivePvRate);
    const savingsCost = totalPvKwh * savingsRate;

    const totalCost = plnCost + pvCost;
    const totalKwh = plnKwh + totalPvKwh;
    const netCost = Math.max(0, totalCost - savingsCost);

    const pctCostPln = totalCost > 0 ? (plnCost / totalCost) * 100 : 0;
    const pctCostPv = totalCost > 0 ? (pvCost / totalCost) * 100 : 0;

    const pctKwhPln = totalKwh > 0 ? (plnKwh / totalKwh) * 100 : 0;
    const pctKwhPv = totalKwh > 0 ? (totalPvKwh / totalKwh) * 100 : 0;

    return {
      plnCost,
      pvCost,
      totalCost,
      pctCostPln,
      pctCostPv,
      plnKwh,
      poi1Kwh,
      poi2Kwh,
      totalPvKwh,
      totalKwh,
      pctKwhPln,
      pctKwhPv,
      effectiveLwbpRate,
      effectiveSolarRate,
      effectivePvRate,
      savingsRate,
      savingsCost,
      netCost
    };
  }, [cubicleDailyData, fixedMonthlyPln, fixedMonthlySolar, summaryData, solarData, lwbpRate, wbpRate, pvRate]);

  // Synchronize monthlyMetrics with executiveSummary so all monthly cards show identical numbers
  const monthlyMetrics = executiveSummary;

  const [factCategories1, setFactCategories1] = useState<ConsumptionFactCategory[]>(defaultFact1Categories);
  const [factCategories2, setFactCategories2] = useState<ConsumptionFactCategory[]>(defaultFact2Categories);

  // Config panel & access control
  const role = useAuthStore((state) => state.user?.role ?? "user");
  const canAccessConfig = canAccessConfigAndAudit(role);
  const isSeniorUnitHead = isSeniorUnitHeadOrAdmin(role);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Senior Unit Head item configuration modal state
  const [showSeniorConfigModal, setShowSeniorConfigModal] = useState(false);
  const [seniorModalFact, setSeniorModalFact] = useState<"consumption_fact_1" | "consumption_fact_2">("consumption_fact_1");
  const [seniorModalDept, setSeniorModalDept] = useState<"all" | "Utility" | "HVAC" | "Other">("all");

  const openSeniorConfigModal = (fact: "consumption_fact_1" | "consumption_fact_2", dept: "all" | "Utility" | "HVAC" | "Other" = "all") => {
    setSeniorModalFact(fact);
    setSeniorModalDept(dept);
    setShowSeniorConfigModal(true);
  };

  const latestBatchRef = useRef<Record<string, any> | null>(null);

  const applyBatchToCategories = (list: ConsumptionFactCategory[], batch: Record<string, any>) => {
    return list.map(item => {
      const rawPm = String(item.value?.pm_id || item.config_key || item.id || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const normalizedPm = rawPm.startsWith("PM") ? rawPm : `PM${rawPm}`;
      const bItem = batch[normalizedPm] || batch[rawPm] || batch[item.label?.toLowerCase()];
      if (bItem && typeof bItem.currTotalKwh === "number") {
        return { ...item, value: { ...item.value, kWh: bItem.currTotalKwh } };
      }
      return item;
    });
  };

  const refreshFactCategories = useCallback(() => {
    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=consumption_fact_1")
      .then((res) => {
        const raw = (res?.data && res.data.length > 0) ? res.data : defaultFact1Categories;
        setFactCategories1(latestBatchRef.current ? applyBatchToCategories(raw, latestBatchRef.current) : raw);
      })
      .catch(() => {
        setFactCategories1(latestBatchRef.current ? applyBatchToCategories(defaultFact1Categories, latestBatchRef.current) : defaultFact1Categories);
      });
    getJson<{ data: ConsumptionFactCategory[] }>("/config/electricity?configType=consumption_fact_2")
      .then((res) => {
        const raw = (res?.data && res.data.length > 0) ? res.data : defaultFact2Categories;
        setFactCategories2(latestBatchRef.current ? applyBatchToCategories(raw, latestBatchRef.current) : raw);
      })
      .catch(() => {
        setFactCategories2(latestBatchRef.current ? applyBatchToCategories(defaultFact2Categories, latestBatchRef.current) : defaultFact2Categories);
      });
  }, []);

  // Synchronize fact categories with equipment monthly batch data from database
  const handleEquipmentBatchLoaded = useCallback((batch: Record<string, any>) => {
    if (!batch) return;
    latestBatchRef.current = batch;
    setFactCategories1(prev => applyBatchToCategories(prev, batch));
    setFactCategories2(prev => applyBatchToCategories(prev, batch));
  }, []);

  // Live API Data states
  const [apiSourceUrls, setApiSourceUrls] = useState<Record<string, string>>({});
  const [jsonKeyMap, setJsonKeyMap] = useState<Record<string, string>>({});
  const [apiLiveData, setApiLiveData] = useState<Record<string, any>>({});

  // Sync API configurations for both targets
  useEffect(() => {
    Promise.all([
      getJson<{ success: boolean; rows?: any[] | null }>("/config/api-sources-map?unitId=electricity"),
      getJson<{ success: boolean; rows?: any[] | null }>("/config/api-sources-map?unitId=Cubicle_PLN_PM8000")
    ])
      .then(([resElec, resPln]) => {
        const urls: Record<string, string> = {};
        const keys: Record<string, string> = {};

        const addRows = (rows: any[] | null | undefined) => {
          if (rows) {
            rows.forEach((row: any) => {
              if (row.tagKey) {
                urls[row.tagKey] = row.url || "";
                keys[row.tagKey] = row.jsonKey || "";
              }
            });
          }
        };

        if (resElec && resElec.success) addRows(resElec.rows);
        if (resPln && resPln.success) addRows(resPln.rows);

        setApiSourceUrls(urls);
        setJsonKeyMap(keys);
      })
      .catch((err) => {
        console.error("Failed to load API sources for Electricity dashboard:", err);
      });
  }, []);

  // Poll active URLs (PLN, PLTS, WF1, WF2, EW21, EW22, EW23, etc.)
  useEffect(() => {
    let isMounted = true;
    const fetchActiveApiData = async () => {
      if (!isPageActive) return;
      // Only query valid absolute HTTP/HTTPS URLs to eliminate socket stalls and proxy timeouts
      const candidateUrls = [
        DEFAULT_PLN_API_URL,
        DEFAULT_WF1_API_URL,
        DEFAULT_WF2_API_URL,
        DEFAULT_PLTS_API_URL,
        DEFAULT_EW21_API_URL,
        DEFAULT_EW22_API_URL,
        DEFAULT_EW23_API_URL,
        ...Object.values(apiSourceUrls).map(u => ENDPOINT_MAP[u] || u)
      ];

      const uniqueUrls = Array.from(new Set(
        candidateUrls.filter((u): u is string => typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://")))
      ));
      if (uniqueUrls.length === 0) {
        if (isMounted) {
          setApiLiveData({});
          setIsLiveLoading(false);
        }
        return;
      }

      const aggregatedData: Record<string, any> = {};
      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const res = await postJson<{ success: boolean; data?: any }>("/config/api-sources/test", {
              url,
              method: "GET"
            });
            if (res && res.success && res.data) {
              aggregatedData[url] = res.data;
              for (const [shortKey, fullUrl] of Object.entries(ENDPOINT_MAP)) {
                if (url === fullUrl || url.includes(shortKey)) {
                  aggregatedData[shortKey] = res.data;
                }
              }
              // Extract PLN
              if (url.includes("electric_pln")) {
                if (res.data.Active_Power !== undefined) {
                  let plnKw = Number(res.data.Active_Power) || 0;
                  if (plnKw > 10000) plnKw = plnKw / 1000.0;
                  setLivePGridKw(Math.max(0, plnKw));
                }
                if (res.data.Power_Factor !== undefined && res.data.Power_Factor !== null) {
                  const pfNum = Math.abs(Number(res.data.Power_Factor));
                  if (!isNaN(pfNum)) {
                    setLivePf(pfNum);
                    setPfStatus(res.data.Status_PM8000 !== false ? "connected" : "offline");
                  }
                }
                const rawPeak = res.data.Peak_Demand_W ?? res.data.Peak_Demand_w ?? res.data.PeakDemand_W ?? res.data.peak_demand_w ?? res.data.Peak_Demand ?? res.data.peak_demand;
                if (rawPeak !== undefined && rawPeak !== null && !isNaN(Number(rawPeak))) {
                  setLivePeakDemandKw(Number(rawPeak) / 1000.0);
                }
              }
              // Extract WF1
              if (url.includes("electric_wf1") && res.data.Active_Power_Total !== undefined) {
                setLiveWf1Kw(Math.max(0, Number(res.data.Active_Power_Total) || 0));
                if (res.data.Status_PM5500_WF1 !== undefined) {
                  setLiveWf1Status(Boolean(res.data.Status_PM5500_WF1));
                }
              }
              // Extract WF2
              if (url.includes("electric_wf2") && res.data.Active_Power_Total !== undefined) {
                setLiveWf2Kw(Math.max(0, Number(res.data.Active_Power_Total) || 0));
                if (res.data.Status_PM5500_WF1 !== undefined) {
                  setLiveWf2Status(Boolean(res.data.Status_PM5500_WF1));
                }
              }
              // Extract PLTS if this is plts url
              if (url.includes("electric_plts") && res.data.POI_1 && res.data.POI_2) {
                setPltsLive({
                  poi1: {
                    status: Boolean(res.data.POI_1.Status_POI_1 ?? true),
                    volt_ab: Number(res.data.POI_1.Volt_AB_POI_1) || 0,
                    active_power: Math.max(0, Number(res.data.POI_1.Scale_Total_KW_POI_1) || 0),
                    peak_demand: Number(res.data.POI_1.Peak_Demand_ScaleKw_POI_1 ?? res.data.POI_1.Peak_Demand_ScaleKW_POI_1) || 0,
                    total_kwh: Number(res.data.POI_1.Total_KWH_POI_1) || 0,
                    frequency: Number(res.data.POI_1.Frequency_POI_1) || 0
                  },
                  poi2: {
                    status: Boolean(res.data.POI_2.Status_POI_2 ?? true),
                    volt_ab: Number(res.data.POI_2.Volt_AB_POI_2) || 0,
                    active_power: Math.max(0, Number(res.data.POI_2.Scale_Total_KW_POI_2) || 0),
                    peak_demand: Number(res.data.POI_2.Peak_Demand_ScaleKw_POI_2 ?? res.data.POI_2.Peak_Demand_ScaleKW_POI_2) || 0,
                    total_kwh: Number(res.data.POI_2.Total_KWH_POI_2) || 0,
                    frequency: Number(res.data.POI_2.Frequency_POI_2) || 0
                  }
                });
              }
            } else if (url.includes("electric_pln")) {
              setLivePf(null);
              setPfStatus("offline");
              setLivePeakDemandKw(null);
            }
          } catch (err) {
            console.error(`Live API poll error on Electricity for URL ${url}:`, err);
            if (url.includes("electric_pln")) {
              setLivePf(null);
              setPfStatus("offline");
              setLivePeakDemandKw(null);
            }
          }
        })
      );

      if (isMounted) {
        setApiLiveData(aggregatedData);
        setIsLiveLoading(false);

        // Dynamically update factCategories with live kW without overwriting monthly kWh
        const updateWithLive = (list: ConsumptionFactCategory[]) => {
          let changed = false;
          const nextList = list.map(item => {
            const rawUrl = item.value?.endpoint_url;
            const fullUrl = (rawUrl && ENDPOINT_MAP[rawUrl]) ? ENDPOINT_MAP[rawUrl] : rawUrl;
            const dataPayload = (fullUrl && aggregatedData[fullUrl]) || (rawUrl && aggregatedData[rawUrl]);
            const pmId = (item.value?.pm_id || item.value?.json_key || item.config_key || "").toUpperCase();
            const cleanNum = pmId.replace(/\D/g, "");

            if (dataPayload) {
              let foundVal: number | null = null;
              if (Array.isArray(dataPayload)) {
                const entry = dataPayload.find((p: any) => {
                  const pId = String(p.PM || p.pm_id || p.PM_ID || "").toUpperCase();
                  return pId === pmId || (cleanNum && pId.replace(/\D/g, "") === cleanNum);
                });
                if (entry) {
                  const candidate = entry[`Active_Power_Total_${pmId}`] ?? entry[`Active_Power_Total_PM${cleanNum}`] ?? entry.ActivePower ?? entry.Active_Power_Total ?? entry.kW;
                  if (candidate !== undefined && candidate !== null) foundVal = Number(candidate);
                }
              } else if (typeof dataPayload === "object") {
                const sub = (item.value?.json_key && dataPayload[item.value.json_key])
                  || dataPayload[pmId]
                  || (cleanNum ? dataPayload[`PM${cleanNum}`] : undefined);

                if (sub !== undefined && sub !== null) {
                  if (typeof sub === "object") {
                    const candidateKeys = [
                      `Active_Power_Total_${pmId}`, `Active_Power_Total_PM${cleanNum}`,
                      "Active_Power_Total", "ActivePower", "kW"
                    ];
                    for (const ck of candidateKeys) {
                      if (sub[ck] !== undefined && sub[ck] !== null) {
                        foundVal = Number(sub[ck]);
                        break;
                      }
                    }
                  } else {
                    foundVal = Number(sub);
                  }
                }
              }
              if (foundVal !== null && !isNaN(foundVal) && (item.value as any)?.liveKw !== foundVal) {
                changed = true;
                return { ...item, value: { ...item.value, liveKw: foundVal } };
              }
            }
            return item;
          });
          return changed ? nextList : list;
        };
        setFactCategories1(prev => updateWithLive(prev));
        setFactCategories2(prev => updateWithLive(prev));
      }
    };

    fetchActiveApiData();
    const interval = setInterval(fetchActiveApiData, 60000); // 60s fallback polling (WebSocket handles real-time updates)

    const socket = getSocket();
    const handlePltsLive = (payload: any) => {
      if (payload?.online === false || payload?.status === false) {
        setPltsLive({
          poi1: { status: false, volt_ab: 0, active_power: 0, peak_demand: 0, total_kwh: 0, frequency: 0 },
          poi2: { status: false, volt_ab: 0, active_power: 0, peak_demand: 0, total_kwh: 0, frequency: 0 }
        });
        return;
      }
      if (payload?.data && Array.isArray(payload.data)) {
        const p1 = payload.data.find((p: any) => p.poi_id === "POI_1");
        const p2 = payload.data.find((p: any) => p.poi_id === "POI_2");
        if (p1 || p2) {
          setPltsLive(prev => ({
            poi1: p1 ? {
              status: p1.status !== null ? Boolean(p1.status) : false,
              volt_ab: p1.volt_ab,
              active_power: p1.active_power,
              peak_demand: Number(p1.peak_demand) || 0,
              total_kwh: p1.total_kwh,
              frequency: p1.frequency
            } : prev.poi1,
            poi2: p2 ? {
              status: p2.status !== null ? Boolean(p2.status) : false,
              volt_ab: p2.volt_ab,
              active_power: p2.active_power,
              peak_demand: Number(p2.peak_demand) || 0,
              total_kwh: p2.total_kwh,
              frequency: p2.frequency
            } : prev.poi2
          }));
        }
      }
    };
    socket.on("electricity:plts_live", handlePltsLive);

    return () => {
      isMounted = false;
      clearInterval(interval);
      socket.off("electricity:plts_live", handlePltsLive);
    };
  }, [apiSourceUrls, isPageActive]);

  const getApiVal = useCallback((tagKey: string): any => {
    if (tagKey === "pln/power_factor") {
      if (livePf !== null && livePf !== undefined && !isNaN(Number(livePf))) {
        return Math.abs(Number(livePf));
      }
      const plnApi = apiLiveData[DEFAULT_PLN_API_URL];
      if (plnApi && plnApi.Power_Factor !== undefined && plnApi.Power_Factor !== null) {
        const num = Number(plnApi.Power_Factor);
        if (!isNaN(num)) return Math.abs(num);
      }
      return null;
    }
    const isPlnTag = tagKey.startsWith("pln/") || tagKey === "electricity/p_grid";
    const isWf1Tag = tagKey.startsWith("wf1/");
    const isWf2Tag = tagKey.startsWith("wf2/");
    const url = apiSourceUrls[tagKey] || (isPlnTag ? DEFAULT_PLN_API_URL : isWf1Tag ? DEFAULT_WF1_API_URL : isWf2Tag ? DEFAULT_WF2_API_URL : "");
    const rawJsonKey = jsonKeyMap[tagKey] || ((isPlnTag || isWf1Tag || isWf2Tag) ? DEFAULT_PLN_JSON_KEYS[tagKey] : undefined) || tagKey.split("/")[1];

    if (url && apiLiveData[url] && rawJsonKey) {
      let val = apiLiveData[url][rawJsonKey] ?? 
        (rawJsonKey === "Current_Umbalance" ? apiLiveData[url]["Current_Unbalance"] : undefined) ??
        (rawJsonKey === "Current_Unbalance" ? apiLiveData[url]["Current_Umbalance"] : undefined) ??
        (rawJsonKey === "Volatage_Unbalance" ? apiLiveData[url]["Voltage_Unbalance"] : undefined) ??
        (rawJsonKey === "Voltage_Unbalance" ? apiLiveData[url]["Volatage_Unbalance"] : undefined);

      if (val !== undefined && val !== null) {
        // Power parameters (convert Watts to kW/kVAR/kVA if large)
        if (tagKey === "pln/active_power" || tagKey === "pln/reactive_power" || tagKey === "pln/apparent_power" || tagKey === "electricity/p_grid") {
          if (typeof val === "number" && val > 10000) val = val / 1000.0;
        }
        // Voltage LL (convert Volts to kV)
        if (tagKey === "pln/voltage" && typeof val === "number" && val > 1000) {
          val = val / 1000.0;
        }
        // Voltage L-N (convert Volts to kV)
        if ((tagKey === "pln/voltage_rn" || tagKey === "pln/voltage_sn" || tagKey === "pln/voltage_tn") && typeof val === "number" && val > 1000) {
          val = (val / Math.sqrt(3)) / 1000.0;
        }
        // Unbalances (convert decimal 0.0055 to %)
        if ((tagKey === "pln/unbalance_v" || tagKey === "pln/unbalance_i") && typeof val === "number" && val < 1.0) {
          val = val * 100.0;
        }
        // Power factor convert negative to positive
        if (tagKey === "pln/power_factor" && typeof val === "number") {
          val = Math.abs(val);
        }
        return val;
      }
    }

    // Fallback to live pqData from backend WebSocket / summaryData
    if (summaryData?.pqData && (isPlnTag || tagKey.startsWith("pln/"))) {
      const pq = summaryData.pqData;
      if (tagKey === "pln/reactive_power") return pq.reactivePower;
      if (tagKey === "pln/apparent_power") return pq.apparentPower;
      if (tagKey === "pln/voltage") return pq.voltage;
      if (tagKey === "pln/frequency") return pq.freq;
      if (tagKey === "pln/current_r") return pq.current1 ?? pq.iR;
      if (tagKey === "pln/current_s") return pq.current2 ?? pq.iS;
      if (tagKey === "pln/current_t") return pq.current3 ?? pq.iT;
      if (tagKey === "pln/voltage_rn") return pq.vR ?? pq.vln1;
      if (tagKey === "pln/voltage_sn") return pq.vS ?? pq.vln2;
      if (tagKey === "pln/voltage_tn") return pq.vT ?? pq.vln3;
      if (tagKey === "pln/unbalance_v") return pq.vUnb;
      if (tagKey === "pln/unbalance_i") return pq.iUnb;
    }

    // Solar tags integration from pltsLive / solarData / solarLive
    if (tagKey === "electricity/solar_generation" || tagKey === "solar/total_kwh") {
      const pltsTotal = (pltsLive.poi1.total_kwh || 0) + (pltsLive.poi2.total_kwh || 0);
      if (pltsTotal > 0) return pltsTotal;
      if (solarData?.summary?.totalKwh) return solarData.summary.totalKwh;
      if (solarLive?.totalKwh) return solarLive.totalKwh;
      return 0;
    }

    if (tagKey === "electricity/p_solar" || tagKey === "solar/active_power") {
      const liveKw = (pltsLive.poi1.active_power || 0) + (pltsLive.poi2.active_power || 0);
      if (liveKw > 0) return liveKw;
      if (solarLive?.poi1?.activePower || solarLive?.poi2?.activePower) {
        return (solarLive.poi1?.activePower || 0) + (solarLive.poi2?.activePower || 0);
      }
      return (solarData?.summary?.poi1PeakDemand || 0) + (solarData?.summary?.poi2PeakDemand || 0) || 0;
    }

    if (tagKey === "electricity/solar_capacity") {
      return 1700; // 1.700 kW Solar PV Capacity
    }

    if (tagKey === "electricity/solar_efficiency") {
      const p1Status = pltsLive.poi1.status;
      const p2Status = pltsLive.poi2.status;
      if (p1Status && p2Status) return 98.4;
      if (p1Status || p2Status) return 96.8;
      return 0;
    }

    if (tagKey === "electricity/p_grid") {
      const plnRaw = apiLiveData[DEFAULT_PLN_API_URL]?.[DEFAULT_PLN_JSON_KEYS["pln/active_power"]];
      if (typeof plnRaw === "number" && plnRaw > 10000) return plnRaw / 1000.0;
      if (typeof plnRaw === "number") return plnRaw;
      return "API TIDAK TERKIRIM";
    }

    if (!url.trim()) return "BELUM ADA API";
    return "API TIDAK TERKIRIM";
  }, [apiSourceUrls, jsonKeyMap, apiLiveData, summaryData, pltsLive, solarData, solarLive, livePf]);

  const isOfflineVal = useCallback((val: any) => {
    return val === null || val === undefined || val === "BELUM ADA API" || val === "API TIDAK TERKIRIM" || val === "Gagal Polling API" || val === "GAGAL POLLING API" || val === "xx";
  }, []);

  const renderMetricVal = useCallback((val: any, formatFn: (v: number) => string) => {
    if (val === "BELUM ADA API") {
      return <span className="text-red-500 text-xs font-extrabold font-mono uppercase tracking-wider">BELUM ADA API</span>;
    }
    if (val === "API TIDAK TERKIRIM" || val === "xx" || val === "Gagal Polling API" || val === "GAGAL POLLING API" || val === null || val === undefined) {
      return <span className="text-amber-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">Gagal Polling API</span>;
    }
    const num = Number(val);
    if (isNaN(num)) {
      return <span className="text-amber-500 text-[10px] font-extrabold font-mono uppercase tracking-wider">Gagal Polling API</span>;
    }
    return formatFn(num);
  }, []);

  const reqIdRef = useRef(0);
  const solarReqIdRef = useRef(0);

  /* ═══ DATA FETCHING (PLN) ═══ */
  const fetchData = useCallback((showLoading = false, force = false) => {
    const currentReqId = ++reqIdRef.current;
    let url = `/analytics/electricity?deviceId=Cubicle_PLN_PM8000`;
    let cacheKey = "";
    if (range === "custom") {
      url += `&from=${chartStartDate}&to=${chartEndDate}`;
      cacheKey = `custom_${chartStartDate}_${chartEndDate}`;
    } else if (range === "hour") {
      const targetDate = chartStartDate || getLocalTodayString();
      url += `&from=${targetDate}&to=${targetDate}`;
      cacheKey = `hour_${targetDate}`;
    } else if (range === "day") {
      const pad = (n: number) => String(n).padStart(2, "0");
      const monthNum = selectedMonth + 1;
      const lastDay = new Date(selectedYear, monthNum, 0).getDate();
      url += `&from=${selectedYear}-${pad(monthNum)}-01&to=${selectedYear}-${pad(monthNum)}-${pad(lastDay)}`;
      cacheKey = `day_${selectedYear}_${monthNum}`;
    } else {
      url += `&year=${selectedYear}`;
      cacheKey = `${range}_${selectedYear}`;
    }

    if (force) {
      url += `&force=true`;
      plnCacheRef.current.delete(cacheKey);
    }

    const todayStr = getLocalTodayString();
    const isTodayQuery = (range === "hour" && (chartStartDate || todayStr) === todayStr) ||
      (range === "day" && selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth()) ||
      ((range === "month" || range === "ytd") && selectedYear === new Date().getFullYear());

    // Instant local memory cache lookup
    const cached = plnCacheRef.current.get(cacheKey);
    const now = Date.now();
    const isFresh = cached && (now - cached.ts < (isTodayQuery ? 30000 : 300000));

    if (!force && cached) {
      setSummaryData(cached.data);
      setChartData(cached.data);
      setSummaryLoading(false);
      setChartLoading(false);
      setIsFilterPending(false);
      if (isFresh) return; // 0ms instant display!
    } else if (showLoading) {
      setIsFilterPending(true);
      if (!summaryData) {
        setSummaryLoading(true);
        setChartLoading(true);
      }
    }

    getJson<{ data: any }>(url)
      .then((res) => {
        if (currentReqId !== reqIdRef.current) return;
        if (res?.data) {
          plnCacheRef.current.set(cacheKey, { data: res.data, ts: Date.now() });
          setSummaryData(res.data);
          setChartData(res.data);
          if (range === "month" && selectedYear === new Date().getFullYear()) {
            setFixedMonthlyPln(res.data);
          }
        }
        setSummaryLoading(false);
        setChartLoading(false);
        setIsFilterPending(false);
      })
      .catch((err) => {
        if (currentReqId !== reqIdRef.current) return;
        console.error("Failed to load electricity data", err);
        setSummaryLoading(false);
        setChartLoading(false);
        setIsFilterPending(false);
      });
  }, [range, selectedYear, selectedMonth, chartStartDate, chartEndDate, summaryData]);

  /* ═══ DATA FETCHING (SOLAR) ═══ */
  const fetchSolarData = useCallback((showLoading = false, force = false) => {
    const currentReqId = ++solarReqIdRef.current;
    let solarUrl = `/analytics/solar?`;
    let cacheKey = "";
    if (solarRange === "custom") {
      solarUrl += `from=${solarStartDate}&to=${solarEndDate}`;
      cacheKey = `custom_${solarStartDate}_${solarEndDate}`;
    } else if (solarRange === "hour") {
      const targetDate = solarStartDate || getLocalTodayString();
      solarUrl += `from=${targetDate}&to=${targetDate}`;
      cacheKey = `hour_${targetDate}`;
    } else if (solarRange === "day") {
      const pad = (n: number) => String(n).padStart(2, "0");
      const monthNum = solarSelectedMonth + 1;
      const lastDay = new Date(solarSelectedYear, monthNum, 0).getDate();
      solarUrl += `from=${solarSelectedYear}-${pad(monthNum)}-01&to=${solarSelectedYear}-${pad(monthNum)}-${pad(lastDay)}`;
      cacheKey = `day_${solarSelectedYear}_${monthNum}`;
    } else {
      solarUrl += `year=${solarSelectedYear}`;
      cacheKey = `${solarRange}_${solarSelectedYear}`;
    }

    if (force) {
      solarUrl += `&force=true`;
      solarCacheRef.current.delete(cacheKey);
    }

    const todayStr = getLocalTodayString();
    const isTodayQuery = (solarRange === "hour" && (solarStartDate || todayStr) === todayStr) ||
      (solarRange === "day" && solarSelectedYear === new Date().getFullYear() && solarSelectedMonth === new Date().getMonth()) ||
      ((solarRange === "month" || solarRange === "ytd") && solarSelectedYear === new Date().getFullYear());

    // Instant local memory cache lookup
    const cached = solarCacheRef.current.get(cacheKey);
    const now = Date.now();
    const isFresh = cached && (now - cached.ts < (isTodayQuery ? 30000 : 300000));

    if (!force && cached) {
      setSolarData(cached.data);
      if (cached.data.live && isTodayQuery) {
        setSolarLive(cached.data.live);
      }
      setIsSolarFilterPending(false);
      if (isFresh) return; // 0ms instant display!
    } else if (showLoading) {
      setIsSolarFilterPending(true);
    }

    getJson<{ data: any }>(solarUrl)
      .then((res) => {
        if (currentReqId !== solarReqIdRef.current) return;
        if (res?.data) {
          solarCacheRef.current.set(cacheKey, { data: res.data, ts: Date.now() });
          setSolarData(res.data);
          if (solarRange === "month" && solarSelectedYear === new Date().getFullYear()) {
            setFixedMonthlySolar(res.data);
          }
          if (res.data.live && isTodayQuery) {
            setSolarLive(res.data.live);
          }
        }
        setIsSolarFilterPending(false);
      })
      .catch((err) => {
        if (currentReqId !== solarReqIdRef.current) return;
        console.warn("Failed to load solar data", err);
        setIsSolarFilterPending(false);
      });
  }, [solarRange, solarSelectedYear, solarSelectedMonth, solarStartDate, solarEndDate]);

  // Dedicated fetcher for fixed monthly executive recap (Bulan Ini)
  const fetchFixedMonthlyData = useCallback((force = false) => {
    const curYear = new Date().getFullYear();
    if (!force && fixedMonthlyPln && fixedMonthlySolar) return;

    const forceQuery = force ? "&force=true" : "";
    const promises: Promise<any>[] = [];
    if (force || !fixedMonthlyPln) {
      promises.push(
        getJson<{ data: any }>(`/analytics/electricity?deviceId=Cubicle_PLN_PM8000&year=${curYear}${forceQuery}`)
          .then((res) => { if (res?.data) setFixedMonthlyPln(res.data); })
      );
    }
    if (force || !fixedMonthlySolar) {
      promises.push(
        getJson<{ data: any }>(`/analytics/solar?year=${curYear}${forceQuery}`)
          .then((res) => { if (res?.data) setFixedMonthlySolar(res.data); })
      );
    }
    Promise.all(promises).catch((err) => {
      console.warn("Failed to load fixed monthly executive data:", err);
    });
  }, [fixedMonthlyPln, fixedMonthlySolar]);

  useEffect(() => {
    fetchFixedMonthlyData();
  }, [fetchFixedMonthlyData]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchSolarData(true);
  }, [fetchSolarData]);

  // Database historical auto-refresh only when new telemetry enters via websocket
  useEffect(() => {
    let active = true;
    const socket = getSocket();

    const isPlnCurrentActivePeriod = () => {
      const todayStr = getLocalTodayString();
      const curYear = new Date().getFullYear();
      const curMonth = new Date().getMonth();
      if (range === "hour") return (chartStartDate || todayStr) === todayStr;
      if (range === "day") return selectedYear === curYear && selectedMonth === curMonth;
      if (range === "month" || range === "ytd") return selectedYear === curYear;
      if (range === "custom") return chartEndDate >= todayStr;
      return true;
    };

    const isSolarCurrentActivePeriod = () => {
      const todayStr = getLocalTodayString();
      const curYear = new Date().getFullYear();
      const curMonth = new Date().getMonth();
      if (solarRange === "hour") return (solarStartDate || todayStr) === todayStr;
      if (solarRange === "day") return solarSelectedYear === curYear && solarSelectedMonth === curMonth;
      if (solarRange === "month" || solarRange === "ytd") return solarSelectedYear === curYear;
      if (solarRange === "custom") return solarEndDate >= todayStr;
      return true;
    };

    const handleElectricityUpdate = () => {
      if (!active) return;
      fetchFixedMonthlyData(true);
      fetchCubicleAnalytics(true);
      refreshFactCategories();
      if (isPlnCurrentActivePeriod()) {
        plnCacheRef.current.clear();
        fetchData(false, true);
      }
      if (isSolarCurrentActivePeriod()) {
        solarCacheRef.current.clear();
        fetchSolarData(false, true);
      }
    };

    const handleSolarUpdate = () => {
      if (!active) return;
      fetchFixedMonthlyData(true);
      if (isSolarCurrentActivePeriod()) {
        solarCacheRef.current.clear();
        fetchSolarData(false, true);
      }
    };
    const handleLiveUpdate = (payload: any) => {
      if (!active || !payload) return;
      const isOffline = payload.online === false || payload.status === false || payload.pqData?.pfStatus === "offline" || payload.pqData?.activePower === null;

      if (payload.deviceId === "Cubicle_PLN_PM8000") {
        if (isOffline) {
          setLivePGridKw(null);
          setPfStatus("offline");
          setLivePeakDemandKw(null);
        } else if (payload.pqData) {
          if (payload.pqData.pf !== undefined && payload.pqData.pf !== null) {
            setLivePf(payload.pqData.pf);
            setPfStatus(payload.pqData.pfStatus || "connected");
          }
          if (typeof payload.pqData.activePower === "number") {
            setLivePGridKw(payload.pqData.activePower);
            setIsLiveLoading(false);
          }
          if (payload.pqData.peakDemand !== undefined) {
            setLivePeakDemandKw(payload.pqData.peakDemand !== null ? Number(payload.pqData.peakDemand) : null);
          }
        }
      } else if (payload.deviceId === "Feeder_WF1_PM5560") {
        if (isOffline) {
          setLiveWf1Kw(null);
          setLiveWf1Status(false);
        } else if (payload.pqData && typeof payload.pqData.activePower === "number") {
          setLiveWf1Kw(payload.pqData.activePower);
          setLiveWf1Status(payload.pqData.pfStatus === "connected");
        }
      } else if (payload.deviceId === "Feeder_WF2_PM5500") {
        if (isOffline) {
          setLiveWf2Kw(null);
          setLiveWf2Status(false);
        } else if (payload.pqData && typeof payload.pqData.activePower === "number") {
          setLiveWf2Kw(payload.pqData.activePower);
          setLiveWf2Status(payload.pqData.pfStatus === "connected");
        }
      }
    };
    const handleSolarLive = (payload: any) => {
      if (!active || !payload) return;
      if (payload.online === false || payload.status === false) {
        setSolarLive((prev: any) => prev ? ({ ...prev, online: false, status: false, poi1: { ...prev.poi1, status: false, activePower: null as any }, poi2: { ...prev.poi2, status: false, activePower: null as any } }) : payload);
        return;
      }
      setSolarLive(payload);
    };
    const handlePmLiveUpdate = (payload: any) => {
      if (!active || !payload?.data || !Array.isArray(payload.data)) return;
      const records = payload.data;
      const updateList = (list: ConsumptionFactCategory[]) => {
        let changed = false;
        const next = list.map(item => {
          const pmId = (item.value?.pm_id || item.value?.json_key || item.config_key || "").toUpperCase();
          const cleanNum = pmId.replace(/\D/g, "");
          const match = records.find((r: any) => {
            const rId = String(r.pm_id || r.pm || "").toUpperCase();
            return rId === pmId || (cleanNum && rId.replace(/\D/g, "") === cleanNum);
          });
          if (match && typeof match.active_power_total === "number") {
            const kw = Math.max(0, match.active_power_total);
            if ((item.value as any)?.liveKw !== kw) {
              changed = true;
              return { ...item, value: { ...item.value, liveKw: kw } };
            }
          }
          return item;
        });
        return changed ? next : list;
      };
      setFactCategories1(prev => updateList(prev));
      setFactCategories2(prev => updateList(prev));
    };
    const handleConfigUpdate = () => {
      useConfigStore.getState().fetchRates().then(() => {
        if (active) {
          fetchData(false);
          fetchSolarData(false);
        }
      });
    };
    const handlePfStatus = (payload: any) => {
      if (active) {
        setLivePf(payload.value);
        setPfStatus(payload.status);
      }
    };

    socket.on("electricity:update", handleElectricityUpdate);
    socket.on("electricity:live_update", handleLiveUpdate);
    socket.on("electricity:pm_live_update", handlePmLiveUpdate);
    socket.on("electricity:solar_live", handleSolarLive);
    socket.on("solar:live_update", handleSolarLive);
    socket.on("solar:update", handleSolarUpdate);
    socket.on("config:update", handleConfigUpdate);
    socket.on("power_factor:status", handlePfStatus);
    return () => {
      active = false;
      socket.off("electricity:update", handleElectricityUpdate);
      socket.off("electricity:live_update", handleLiveUpdate);
      socket.off("electricity:pm_live_update", handlePmLiveUpdate);
      socket.off("electricity:solar_live", handleSolarLive);
      socket.off("solar:live_update", handleSolarLive);
      socket.off("solar:update", handleSolarUpdate);
      socket.off("config:update", handleConfigUpdate);
      socket.off("power_factor:status", handlePfStatus);
    };
  }, [fetchData, fetchSolarData, fetchCubicleAnalytics, fetchFixedMonthlyData, refreshFactCategories, range, selectedYear, selectedMonth, chartStartDate, chartEndDate, solarRange, solarSelectedYear, solarSelectedMonth, solarStartDate, solarEndDate]);

  // Load consumption fact categories
  useEffect(() => {
    refreshFactCategories();
  }, [refreshFactCategories]);

  // Filters for Utility and HVAC Departments ("Fact 1", "Fact 2")
  const [utilityFilter, setUtilityFilter] = useState<"Fact 1" | "Fact 2">("Fact 1");
  const [hvacFilter, setHvacFilter] = useState<"Fact 1" | "Fact 2">("Fact 1");

  // Helper to classify category name into department and sub-area
  const classifyArea = useCallback((label: string, itemValue?: any): { department: "Utility" | "HVAC" | "Other"; subArea: string } => {
    if (itemValue?.department) {
      return {
        department: itemValue.department,
        subArea: itemValue.subArea || (itemValue.department === "Utility" ? "Utility System" : itemValue.department === "HVAC" ? "HVAC System" : "Others")
      };
    }
    const lbl = (label || "").toLowerCase();
    
    // HVAC matchers
    if (lbl.includes("chiller")) return { department: "HVAC", subArea: "Chillers" };
    if (lbl.includes("ahu")) return { department: "HVAC", subArea: "AHUs" };
    if (lbl.includes("ac ") || lbl.endsWith(" ac") || lbl.includes("split") || lbl.includes("fcu")) {
      return { department: "HVAC", subArea: "AC Split / FCU" };
    }
    if (lbl.includes("hvac") || lbl.includes("cleanroom") || lbl.includes("stability") || lbl.includes("heater")) {
      return { department: "HVAC", subArea: "Cleanroom HVAC" };
    }
    
    // Utility matchers
    if (lbl.includes("boiler")) return { department: "Utility", subArea: "Boiler" };
    if (lbl.includes("compressor") || lbl.includes("dryer")) return { department: "Utility", subArea: "Compressors" };
    if (lbl.includes("cooling tower") || lbl.includes("fan-") || lbl.includes("ct-")) return { department: "Utility", subArea: "Cooling Towers" };
    if (lbl.includes("wtp") || lbl.includes("wwtp") || lbl.includes("pump") || lbl.includes("water")) {
      return { department: "Utility", subArea: "Water / WTP" };
    }
    
    // Default to Other
    if (lbl.includes("production") || lbl.includes("machinery") || lbl.includes("line")) {
      return { department: "Other", subArea: "Production Lines" };
    }
    return { department: "Other", subArea: "Others" };
  }, []);

  const combinedAllCategories = useMemo(() => {
    const list1 = factCategories1.length > 0 ? factCategories1 : defaultFact1Categories;
    const list2 = factCategories2.length > 0 ? factCategories2 : defaultFact2Categories;
    const items1 = list1.map(c => ({ ...c, fact: "Fact 1" as const }));
    const items2 = list2.map(c => ({ ...c, fact: "Fact 2" as const }));
    return [...items1, ...items2];
  }, [factCategories1, factCategories2]);

  // Memoized lists of parsed categories by department and source Fact
  const utilityData = useMemo(() => {
    const filtered = combinedAllCategories.filter(c => c.enabled && c.fact === utilityFilter);
    const categorized = filtered
      .map(c => ({ ...c, info: classifyArea(c.label, c.value) }))
      .filter(c => c.info.department === "Utility");

    const subAreaSums: Record<string, number> = {};
    categorized.forEach(c => {
      subAreaSums[c.info.subArea] = (subAreaSums[c.info.subArea] || 0) + (c.value?.kWh ?? 0);
    });

    const totalKwh = categorized.reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    const activeCount = categorized.length;

    return {
      totalKwh,
      activeCount,
      subAreaSums,
      items: categorized
    };
  }, [combinedAllCategories, utilityFilter, classifyArea]);

  const hvacData = useMemo(() => {
    const filtered = combinedAllCategories.filter(c => c.enabled && c.fact === hvacFilter);
    const categorized = filtered
      .map(c => ({ ...c, info: classifyArea(c.label, c.value) }))
      .filter(c => c.info.department === "HVAC");

    const subAreaSums: Record<string, number> = {};
    categorized.forEach(c => {
      subAreaSums[c.info.subArea] = (subAreaSums[c.info.subArea] || 0) + (c.value?.kWh ?? 0);
    });

    const totalKwh = categorized.reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    const activeCount = categorized.length;

    return {
      totalKwh,
      activeCount,
      subAreaSums,
      items: categorized
    };
  }, [combinedAllCategories, hvacFilter, classifyArea]);

  // Compute grand total of all enabled categories to get percentage shares
  const allFactTotal = useMemo(() => {
    const t1 = factCategories1.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    const t2 = factCategories2.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
    return t1 + t2;
  }, [factCategories1, factCategories2]);

  const utilityDonutSegments = useMemo(() => {
    const total = utilityData.totalKwh;
    if (total === 0) return [];
    
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#64748b"];
    return Object.entries(utilityData.subAreaSums)
      .sort((a, b) => b[1] - a[1])
      .map(([label, val], idx) => ({
        label,
        value: Math.round((val / total) * 100),
        color: colors[idx % colors.length]
      }));
  }, [utilityData]);

  const hvacDonutSegments = useMemo(() => {
    const total = hvacData.totalKwh;
    if (total === 0) return [];
    
    const colors = ["#06b6d4", "#ec4899", "#84cc16", "#eab308", "#64748b"];
    return Object.entries(hvacData.subAreaSums)
      .sort((a, b) => b[1] - a[1])
      .map(([label, val], idx) => ({
        label,
        value: Math.round((val / total) * 100),
        color: colors[idx % colors.length]
      }));
  }, [hvacData]);

  const hasSummaryData = !!summaryData;
  const hasChartData = !!chartData;

  /* ═══ COMPUTED: CARD SUMMARY ═══ */
  const currentMonth = useMemo(() => {
    if (range === "day") return selectedMonth + 1;
    const now = new Date();
    if (selectedYear === now.getFullYear()) return now.getMonth() + 1;
    if (hasChartData && chartData.charts.daily) {
      for (let m = 12; m >= 1; m--) {
        const monthPrefix = `${selectedYear}-${String(m).padStart(2, "0")}`;
        const hasVal = chartData.charts.daily.some((d: any) => d.day.startsWith(monthPrefix) && d.value > 0);
        if (hasVal) return m;
      }
    }
    return 12;
  }, [hasChartData, chartData, selectedYear, range, selectedMonth]);

  const monthlyDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily) {
      const monthPrefix = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
      return chartData.charts.daily.filter((d: any) => d.day.startsWith(monthPrefix));
    }
    return [];
  }, [hasChartData, chartData, selectedYear, currentMonth]);

  const customDailyRecords = useMemo(() => {
    if (hasChartData && chartData.charts.daily && range === "custom") {
      return chartData.charts.daily.filter((d: any) => d.day >= chartStartDate && d.day <= chartEndDate);
    }
    return [];
  }, [hasChartData, chartData, range, chartStartDate, chartEndDate]);

  const cardSummary = useMemo(() => {
    if (!hasSummaryData || !summaryData) {
      return { totalCost: 0, totalKwh: 0, peakDemand: 0, peakDemandTs: null, loadFactor: 0, wbpKwh: 0, lwbpKwh: 0, wbpCost: 0, lwbpCost: 0 };
    }
    if (range === "hour") {
      const isToday = (chartStartDate || getLocalTodayString()) === getLocalTodayString();
      const todayKwh = isToday ? ((summaryData.summary?.todayWbpKwh ?? 0) + (summaryData.summary?.todayLwbpKwh ?? 0) || (summaryData.summary?.todayKwh ?? 0)) : (summaryData.summary?.totalKwh ?? 0);
      const todayWbpKwh = isToday ? (summaryData.summary?.todayWbpKwh ?? 0) : (summaryData.summary?.wbpKwh ?? 0);
      const todayLwbpKwh = isToday ? (summaryData.summary?.todayLwbpKwh ?? 0) : (summaryData.summary?.lwbpKwh ?? 0);
      const todayWbpCost = isToday ? (summaryData.summary?.todayWbpCost ?? (todayWbpKwh * wbpRate)) : (summaryData.summary?.wbpCost ?? (todayWbpKwh * wbpRate));
      const todayLwbpCost = isToday ? (summaryData.summary?.todayLwbpCost ?? (todayLwbpKwh * lwbpRate)) : (summaryData.summary?.lwbpCost ?? (todayLwbpKwh * lwbpRate));
      const todayCost = (todayWbpCost + todayLwbpCost) || (summaryData.summary?.totalCost ?? 0);
      return {
        totalCost: todayCost || (summaryData.summary?.totalCost ?? 0),
        totalKwh: todayKwh || (summaryData.summary?.totalKwh ?? 0),
        peakDemand: summaryData.summary?.peakDemand || summaryData.pqData?.activePower || 0,
        peakDemandTs: summaryData.summary?.peakDemandTs || summaryData.pqData?.activePowerTs,
        loadFactor: summaryData.pqData?.pf ? Math.abs(summaryData.pqData.pf) * 100 : 0,
        wbpKwh: todayWbpKwh || (summaryData.summary?.wbpKwh ?? 0),
        lwbpKwh: todayLwbpKwh || (summaryData.summary?.lwbpKwh ?? 0),
        wbpCost: todayWbpCost || (summaryData.summary?.wbpCost ?? 0),
        lwbpCost: todayLwbpCost || (summaryData.summary?.lwbpCost ?? 0)
      };
    }
    if (range === "day") {
      const targetMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
      const monthData = summaryData.summary?.perMonthSummary?.find((pm: any) => pm.month === targetMonthKey) || summaryData.summary?.perMonthSummary?.[selectedMonth];
      if (monthData) {
        return {
          totalCost: monthData.totalCost,
          totalKwh: monthData.totalKwh,
          peakDemand: monthData.peakDemand,
          peakDemandTs: monthData.peakDemandTs,
          loadFactor: summaryData.pqData?.pf ? Math.abs(summaryData.pqData.pf) * 100 : 0,
          wbpKwh: monthData.wbpKwh,
          lwbpKwh: monthData.lwbpKwh,
          wbpCost: monthData.wbpCost,
          lwbpCost: monthData.lwbpCost
        };
      }
    }
    return {
      totalCost: summaryData.summary?.totalCost ?? 0,
      totalKwh: summaryData.summary?.totalKwh ?? 0,
      peakDemand: summaryData.summary?.peakDemand || summaryData.pqData?.activePower || 0,
      peakDemandTs: summaryData.summary?.peakDemandTs || summaryData.pqData?.activePowerTs,
      loadFactor: summaryData.pqData?.pf ? Math.abs(summaryData.pqData.pf) * 100 : 0,
      wbpKwh: summaryData.summary?.wbpKwh ?? 0,
      lwbpKwh: summaryData.summary?.lwbpKwh ?? 0,
      wbpCost: summaryData.summary?.wbpCost ?? 0,
      lwbpCost: summaryData.summary?.lwbpCost ?? 0
    };
  }, [hasSummaryData, summaryData, range, selectedYear, selectedMonth, chartStartDate, wbpRate, lwbpRate]);

  /* ═══ COMPUTED: CHART DATA ═══ */
  const barLabels = useMemo(() => {
    if (hasChartData) {
      if (range === "hour" || (range === "custom" && chartStartDate === chartEndDate)) {
        return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
      } else if (range === "day") {
        return monthlyDailyRecords.map((d: any) => d.day.split("-")[2]);
      } else if (range === "custom") {
        return customDailyRecords.map((d: any) => { const p = d.day.split("-"); return `${p[2]}/${p[1]}`; });
      } else {
        return chartData.charts.monthly.map((m: any) => { const [yr, mo] = m.month.split("-").map(Number); return `${MONTH_SHORT_ID[mo - 1]} ${yr}`; });
      }
    }
    return buildTimeLabels(config.points, config.type);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barWbpValues = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") return chartData.charts.hourlyWbp || Array(24).fill(0);
      if (range === "day") return monthlyDailyRecords.map((d: any) => d.wbp || 0);
      if (range === "custom") return chartStartDate === chartEndDate ? (chartData.charts.hourlyWbp || Array(24).fill(0)) : customDailyRecords.map((d: any) => d.wbp || 0);
      return chartData.charts.monthly.map((m: any) => m.wbp || 0);
    }
    return Array(config.points).fill(0);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barLwbpValues = useMemo(() => {
    if (hasChartData) {
      if (range === "hour") return chartData.charts.hourlyLwbp || Array(24).fill(0);
      if (range === "day") return monthlyDailyRecords.map((d: any) => d.lwbp || 0);
      if (range === "custom") return chartStartDate === chartEndDate ? (chartData.charts.hourlyLwbp || Array(24).fill(0)) : customDailyRecords.map((d: any) => d.lwbp || 0);
      return chartData.charts.monthly.map((m: any) => m.lwbp || 0);
    }
    return Array(config.points).fill(0);
  }, [hasChartData, range, config, chartData, monthlyDailyRecords, customDailyRecords, chartStartDate, chartEndDate]);

  const barUnit = useMemo(() => (range === "hour" || range === "day" || range === "custom") ? "kWh" : "MWh", [range]);

  const donutSegments = useMemo(() => {
    if (hasChartData) {
      let wbp = chartData.summary.wbpKwh ?? 0;
      let total = chartData.summary.totalKwh ?? 0;
      if (range === "hour") {
        const isToday = (chartStartDate || getLocalTodayString()) === getLocalTodayString();
        if (isToday && (chartData.summary.todayWbpKwh || chartData.summary.todayLwbpKwh)) {
          wbp = chartData.summary.todayWbpKwh ?? 0;
          total = (chartData.summary.todayWbpKwh ?? 0) + (chartData.summary.todayLwbpKwh ?? 0);
        } else {
          wbp = chartData.summary.wbpKwh ?? 0;
          total = chartData.summary.totalKwh ?? 0;
        }
      } else if (range === "day") {
        const targetMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
        const monthData = chartData.summary?.perMonthSummary?.find((pm: any) => pm.month === targetMonthKey);
        if (monthData) {
          wbp = monthData.wbpKwh ?? 0;
          total = monthData.totalKwh ?? 0;
        } else {
          wbp = chartData.summary.wbpKwh ?? 0;
          total = chartData.summary.totalKwh ?? 0;
        }
      } else if (range === "custom") {
        if (chartStartDate === chartEndDate) {
          const hW = chartData.charts.hourlyWbp || [];
          const hL = chartData.charts.hourlyLwbp || [];
          wbp = hW.reduce((a: number, c: number) => a + c, 0);
          total = wbp + hL.reduce((a: number, c: number) => a + c, 0);
        } else {
          wbp = customDailyRecords.reduce((a: number, c: any) => a + (c.wbp || 0), 0);
          total = wbp + customDailyRecords.reduce((a: number, c: any) => a + (c.lwbp || 0), 0);
        }
      }
      if (total > 0) {
        const wbpPct = Math.round((wbp / total) * 100);
        return [{ label: "Beban WBP (17-22)", value: wbpPct, color: "#ef4444" }, { label: "Beban LWBP", value: 100 - wbpPct, color: "#3b82f6" }];
      }
    }
    return [{ label: "Beban WBP (17-22)", value: 0, color: "#ef4444" }, { label: "Beban LWBP", value: 0, color: "#3b82f6" }];
  }, [hasChartData, chartData, range, selectedYear, selectedMonth, customDailyRecords, chartStartDate, chartEndDate]);

  /* ═══ PLN STACKED BAR ═══ */
  const stackedBarData = useMemo(() => ({
    labels: barLabels,
    datasets: [
      { label: `LWBP ${barUnit}`, data: barLwbpValues.map((v: number) => (v > 0 ? v : null)), backgroundColor: "rgba(59,130,246,.85)", borderColor: "rgba(37,99,235,1)", borderWidth: 1, borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 }, barPercentage: 0.65, minBarLength: 5, stack: "beban" },
      { label: `WBP ${barUnit}`, data: barWbpValues.map((v: number) => (v > 0 ? v : null)), backgroundColor: "rgba(239,68,68,.85)", borderColor: "rgba(220,38,38,1)", borderWidth: 1, borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, barPercentage: 0.65, minBarLength: 5, stack: "beban" }
    ]
  }), [barLabels, barUnit, barLwbpValues, barWbpValues]);

  const stackedBarOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: { display: true, position: "top", align: "end", labels: { color: isDark ? "rgba(148,163,184,.9)" : "rgba(71,85,105,.9)", font: { size: 10, weight: "600" as const }, usePointStyle: true, pointStyle: "rectRounded", padding: 12 } },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        mode: "index",
        intersect: false,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 1)",
        titleColor: isDark ? "#ffffff" : "#000000",
        bodyColor: isDark ? "#f8fafc" : "#0f172a",
        borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(15, 23, 42, 0.15)",
        borderWidth: 2,
        padding: 12,
        titleFont: { family: "IBM Plex Mono, monospace", size: 12, weight: "bold" as const },
        bodyFont: { family: "IBM Plex Mono, monospace", size: 11, weight: "bold" as const },
        footerColor: isDark ? "#fbbf24" : "#b45309",
        footerFont: { family: "IBM Plex Mono, monospace", size: 11, weight: "bold" as const },
        filter: (tooltipItem: any) => tooltipItem.raw !== null && tooltipItem.raw > 0,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            if (val === null || val === undefined || val === 0) return null;
            return `${ctx.dataset.label}: ${val.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
          },
          footer: (tooltipItems: any[]) => {
            if (!tooltipItems || tooltipItems.length === 0) return "";
            const dataIndex = tooltipItems[0].dataIndex;
            const wbp = barWbpValues[dataIndex] || 0;
            const lwbp = barLwbpValues[dataIndex] || 0;
            const total = wbp + lwbp;
            if (total === 0) return "";
            const multiplier = barUnit === "MWh" ? 1000 : 1;
            const cost = (wbp * multiplier * wbpRate) + (lwbp * multiplier * lwbpRate);
            return [
              `Total: ${total.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${barUnit}`,
              `Estimasi Biaya: Rp ${cost.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            ];
          }
        }
      }
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
      y: { stacked: true, beginAtZero: true, grace: "15%", grid: { color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.6)" }, ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", callback: (v: number) => `${v}` } }
    }
  }), [isDark, barWbpValues, barLwbpValues, barUnit, wbpRate, lwbpRate]);

  /* ═══ SOLAR STACKED BAR ═══ */
  const solarBarLabels = useMemo(() => {
    if (solarRange === "hour" || (solarRange === "custom" && solarStartDate === solarEndDate)) {
      return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
    } else if (solarRange === "day") {
      const daysCount = new Date(solarSelectedYear, solarSelectedMonth + 1, 0).getDate();
      return Array.from({ length: daysCount }, (_, i) => String(i + 1).padStart(2, "0"));
    } else if (solarRange === "custom") {
      const customDaily = solarData?.charts?.daily || [];
      if (customDaily.length > 0) {
        return customDaily.map((d: any) => {
          const p = d.day.split("-");
          return `${p[2]}/${p[1]}`;
        });
      }
      return [solarStartDate, solarEndDate];
    } else {
      const monthly = solarData?.charts?.monthly || [];
      if (monthly.length > 0) {
        return monthly.map((m: any) => {
          const [yr, mo] = m.month.split("-").map(Number);
          return `${MONTH_SHORT_ID[mo - 1]} ${yr}`;
        });
      }
      return MONTH_SHORT_ID.map((name) => `${name} ${solarSelectedYear}`);
    }
  }, [solarRange, solarStartDate, solarEndDate, solarSelectedYear, solarSelectedMonth, solarData]);

  const solarPoi1Values = useMemo(() => {
    if (solarRange === "hour" || (solarRange === "custom" && solarStartDate === solarEndDate)) {
      return solarData?.charts?.hourlyPoi1 || Array(24).fill(0);
    } else if (solarRange === "day") {
      const targetMonthStr = `${solarSelectedYear}-${String(solarSelectedMonth + 1).padStart(2, "0")}`;
      const daysCount = new Date(solarSelectedYear, solarSelectedMonth + 1, 0).getDate();
      const lookup: Record<string, number> = {};
      (solarData?.charts?.daily || []).forEach((d: any) => {
        if (d.day && d.day.startsWith(targetMonthStr)) {
          lookup[d.day] = Number(d.poi1) || 0;
        }
      });
      return Array.from({ length: daysCount }, (_, i) => {
        const dStr = `${targetMonthStr}-${String(i + 1).padStart(2, "0")}`;
        return lookup[dStr] || 0;
      });
    } else if (solarRange === "custom") {
      return (solarData?.charts?.daily || []).map((d: any) => d.poi1 || 0);
    } else {
      return (solarData?.charts?.monthly || []).map((m: any) => m.poi1 || 0);
    }
  }, [solarRange, solarStartDate, solarEndDate, solarSelectedYear, solarSelectedMonth, solarData]);

  const solarPoi2Values = useMemo(() => {
    if (solarRange === "hour" || (solarRange === "custom" && solarStartDate === solarEndDate)) {
      return solarData?.charts?.hourlyPoi2 || Array(24).fill(0);
    } else if (solarRange === "day") {
      const targetMonthStr = `${solarSelectedYear}-${String(solarSelectedMonth + 1).padStart(2, "0")}`;
      const daysCount = new Date(solarSelectedYear, solarSelectedMonth + 1, 0).getDate();
      const lookup: Record<string, number> = {};
      (solarData?.charts?.daily || []).forEach((d: any) => {
        if (d.day && d.day.startsWith(targetMonthStr)) {
          lookup[d.day] = Number(d.poi2) || 0;
        }
      });
      return Array.from({ length: daysCount }, (_, i) => {
        const dStr = `${targetMonthStr}-${String(i + 1).padStart(2, "0")}`;
        return lookup[dStr] || 0;
      });
    } else if (solarRange === "custom") {
      return (solarData?.charts?.daily || []).map((d: any) => d.poi2 || 0);
    } else {
      return (solarData?.charts?.monthly || []).map((m: any) => m.poi2 || 0);
    }
  }, [solarRange, solarStartDate, solarEndDate, solarSelectedYear, solarSelectedMonth, solarData]);

  // Filtered metrics for Solar Panel (PLTS) top cards
  const solarFilteredMetrics = useMemo(() => {
    const poi1Kwh = solarPoi1Values.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
    const poi2Kwh = solarPoi2Values.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);

    const activeTotalKwh = (solarShowPoi1 ? poi1Kwh : 0) + (solarShowPoi2 ? poi2Kwh : 0);

    const plnRate = Number(solarData?.summary?.solarRate) || lwbpRate || 1112;
    const currentPvRate = typeof pvRate === "number" ? pvRate : (Number(solarData?.summary?.pvRate) || 0);
    const plnCost = activeTotalKwh * plnRate;
    const pvCost = activeTotalKwh * currentPvRate;
    const savingsCost = plnCost - pvCost;

    let poi1Peak = solarData?.summary?.rangePoi1PeakDemand ?? solarData?.summary?.poi1PeakDemand ?? 0;
    let poi2Peak = solarData?.summary?.rangePoi2PeakDemand ?? solarData?.summary?.poi2PeakDemand ?? 0;

    if (solarRange === "hour" || (solarRange === "custom" && solarStartDate === solarEndDate)) {
      poi1Peak = Math.max(0, ...solarPoi1Values);
      poi2Peak = Math.max(0, ...solarPoi2Values);
    } else if (poi1Peak === 0 && poi2Peak === 0) {
      poi1Peak = Math.max(0, ...solarPoi1Values);
      poi2Peak = Math.max(0, ...solarPoi2Values);
    }

    let periodLabel = "Hari Ini";
    if (solarRange === "hour") {
      periodLabel = "Hari Ini (Per Jam)";
    } else if (solarRange === "day") {
      periodLabel = `${MONTH_NAMES_ID[solarSelectedMonth]} ${solarSelectedYear}`;
    } else if (solarRange === "month") {
      periodLabel = `Tahun ${solarSelectedYear}`;
    } else if (solarRange === "ytd") {
      periodLabel = `YTD ${solarSelectedYear}`;
    } else if (solarRange === "custom") {
      periodLabel = `${solarStartDate} s/d ${solarEndDate}`;
    }

    return {
      poi1Kwh,
      poi2Kwh,
      totalKwh: activeTotalKwh,
      plnCost,
      pvCost,
      savingsCost,
      poi1PeakDemand: poi1Peak,
      poi2PeakDemand: poi2Peak,
      periodLabel
    };
  }, [
    solarPoi1Values,
    solarPoi2Values,
    solarShowPoi1,
    solarShowPoi2,
    solarData,
    lwbpRate,
    pvRate,
    solarRange,
    solarSelectedMonth,
    solarSelectedYear,
    solarStartDate,
    solarEndDate
  ]);

  // Executive period label for the top summary cards - fixed to current active month (Bulan Saat Ini)
  const executivePeriodLabel = useMemo(() => {
    const now = new Date();
    const currMonthName = MONTH_NAMES_ID[now.getMonth()];
    const currYear = now.getFullYear();
    return `Bulan Ini (${currMonthName} ${currYear})`;
  }, []);



  const solarBarData = useMemo(() => {
    const datasets: any[] = [];
    if (solarShowPoi1) {
      datasets.push({
        label: "POI-1 (kWh)",
        data: solarPoi1Values.map((v: number) => (v > 0 ? v : null)),
        backgroundColor: "rgba(59, 130, 246, 0.85)",
        borderColor: "rgba(37, 99, 235, 1)",
        borderWidth: 1,
        borderRadius: solarShowPoi2 ? { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 } : 4,
        barPercentage: 0.65,
        minBarLength: 6,
        stack: "solar"
      });
    }
    if (solarShowPoi2) {
      datasets.push({
        label: "POI-2 (kWh)",
        data: solarPoi2Values.map((v: number) => (v > 0 ? v : null)),
        backgroundColor: "rgba(6, 182, 212, 0.85)",
        borderColor: "rgba(8, 145, 178, 1)",
        borderWidth: 1,
        borderRadius: solarShowPoi1 ? { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } : 4,
        barPercentage: 0.65,
        minBarLength: 6,
        stack: "solar"
      });
    }
    return {
      labels: solarBarLabels,
      datasets
    };
  }, [solarBarLabels, solarPoi1Values, solarPoi2Values, solarShowPoi1, solarShowPoi2]);

  const solarBarOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "end",
        labels: {
          color: isDark ? "rgba(148,163,184,.9)" : "rgba(71,85,105,.9)",
          font: { size: 10, weight: "600" as const },
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: 12
        }
      },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        mode: "index",
        intersect: false,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 1)",
        titleColor: isDark ? "#ffffff" : "#000000",
        bodyColor: isDark ? "#f8fafc" : "#0f172a",
        borderColor: isDark ? "rgba(51, 65, 85, 0.8)" : "rgba(226, 232, 240, 1)",
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        filter: (tooltipItem: any) => tooltipItem.raw !== null && tooltipItem.raw > 0,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            if (val === null || val === undefined || val === 0) return null;
            return `${ctx.dataset.label}: ${val.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kWh`;
          },
          afterBody: (tooltipItems: any[]) => {
            if (!tooltipItems.length) return [];
            const idx = tooltipItems[0].dataIndex;
            const p1 = solarShowPoi1 ? (solarPoi1Values[idx] || 0) : 0;
            const p2 = solarShowPoi2 ? (solarPoi2Values[idx] || 0) : 0;
            const tot = p1 + p2;
            if (tot === 0) return [];
            const plnRate = Number(solarData?.summary?.solarRate) || lwbpRate || 1112;
            const currentPvRate = typeof pvRate === "number" ? pvRate : (Number(solarData?.summary?.pvRate) || 0);
            const pvCost = tot * currentPvRate;
            const savings = tot * (plnRate - currentPvRate);
            const lines = [`Total: ${tot.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kWh`];
            if (currentPvRate > 0) {
              lines.push(`Biaya PV: Rp ${Math.round(pvCost).toLocaleString("id-ID")}`);
            }
            lines.push(`Penghematan: Rp ${Math.round(savings).toLocaleString("id-ID")}`);
            return lines;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
      },
      y: {
        stacked: true,
        grid: { color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.6)" },
        ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", callback: (v: number) => `${v}` }
      }
    }
  }), [isDark, solarPoi1Values, solarPoi2Values, solarShowPoi1, solarShowPoi2, lwbpRate, pvRate, solarData]);

  /* ═══ COMBINED FACT TIMELINE CHART & DONUT STATE ═══ */
  const fact1Total = useMemo(() => {
    return factCategories1.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
  }, [factCategories1]);

  const fact2Total = useMemo(() => {
    return factCategories2.filter(c => c.enabled).reduce((sum, c) => sum + (c.value?.kWh ?? 0), 0);
  }, [factCategories2]);

  const factTimelineData = useMemo(() => {
    const labels = barLabels;
    if (fact1Total === 0 && fact2Total === 0) {
      return { labels, datasets: [] };
    }
    const len = labels.length;
    const f1Data = Array.from({ length: len }, () => 0);
    const f2Data = Array.from({ length: len }, () => 0);

    return {
      labels,
      datasets: [
        {
          label: "Fact-1 (Utility & Production) (kWh)",
          data: f1Data,
          backgroundColor: "rgba(59, 130, 246, 0.8)",
          borderColor: "#3b82f6",
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: "Fact-2 (Utility & HVAC) (kWh)",
          data: f2Data,
          backgroundColor: "rgba(6, 182, 212, 0.8)",
          borderColor: "#06b6d4",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    };
  }, [barLabels, fact1Total, fact2Total]);

  const factDonutSegments = useMemo(() => {
    const total = fact1Total + fact2Total;
    if (total === 0) return [];
    return [
      { label: "Fact-1 (Utility & Prod)", value: Math.round((fact1Total / total) * 100), color: "#3b82f6" },
      { label: "Fact-2 (Utility & HVAC)", value: Math.round((fact2Total / total) * 100), color: "#06b6d4" }
    ];
  }, [fact1Total, fact2Total]);

  const factBarOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" as const, labels: { color: isDark ? "#94a3b8" : "#475569", font: { size: 9, weight: "bold" as const } } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 8 } } },
      y: { beginAtZero: true, grace: "15%", grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }, ticks: { color: "#64748b", font: { size: 8 } } }
    }
  };

  /* ═══ HORIZONTAL BAR FOR CONSUMPTION FACT ═══ */
  const makeHorizontalBarData = (categories: ConsumptionFactCategory[], fallbackSide: 1 | 2 = 1) => {
    const list = categories.length > 0 ? categories : (fallbackSide === 1 ? defaultFact1Categories : defaultFact2Categories);
    const sortedEnabled = [...list]
      .filter(c => c.enabled)
      .sort((a, b) => (b.value?.kWh ?? 0) - (a.value?.kWh ?? 0));
    return {
      labels: sortedEnabled.map(c => c.label),
      datasets: [{
        label: "kWh",
        data: sortedEnabled.map(c => c.value?.kWh ?? 0),
        backgroundColor: fallbackSide === 1 ? "rgba(31, 111, 181, 0.85)" : "rgba(6, 182, 212, 0.85)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.55
      }]
    };
  };

  const makeDeptHorizontalBarData = (items: any[], dept: "Utility" | "HVAC") => {
    const sorted = [...items].sort((a, b) => (b.value?.kWh ?? 0) - (a.value?.kWh ?? 0));
    return {
      labels: sorted.map(c => c.label),
      datasets: [{
        label: "kWh",
        data: sorted.map(c => c.value?.kWh ?? 0),
        backgroundColor: dept === "Utility" ? "rgba(31, 111, 181, 0.8)" : "rgba(6, 182, 212, 0.8)",
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.55
      }]
    };
  };

  const horizontalBarOptions: any = useMemo(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        }
      }
    },
    interaction: {
      mode: "nearest",
      axis: "y",
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        animation: {
          duration: 180,
          easing: "easeOutQuad"
        },
        callbacks: { label: (ctx: any) => `${Number(ctx.parsed.x).toLocaleString("id-ID")} kWh` }
      }
    },
    scales: {
      x: { beginAtZero: true, grace: "15%", grid: { color: isDark ? "rgba(51,65,85,.4)" : "rgba(203,213,225,.5)" }, ticks: { color: isDark ? "rgba(148,163,184,.7)" : "rgba(71,85,105,.7)", font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: isDark ? "rgba(148,163,184,.8)" : "rgba(71,85,105,.8)", font: { size: 10 }, autoSkip: false } }
    }
  }), [isDark]);

  // Helper to extract clean numeric value or null
  const getCleanNum = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") return isNaN(val) ? null : val;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed || trimmed === "BELUM ADA API" || trimmed === "API TIDAK TERKIRIM" || trimmed === "Gagal Polling API" || trimmed === "GAGAL POLLING API" || trimmed === "xx") {
        return null;
      }
      const parsed = Number(trimmed);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Power metrics & percentages for Top Overview Cards (Pure Real-Time API Polling)
  const apiWf1Val = getCleanNum(getApiVal("wf1/active_power"));
  const rawFact1Val = liveWf1Kw !== null && liveWf1Kw !== undefined ? liveWf1Kw : apiWf1Val;
  const isFact1Offline = !isLiveLoading && (rawFact1Val === null || (liveWf1Status === false && rawFact1Val === 0 && apiWf1Val === null));
  const fact1Kw = rawFact1Val !== null ? Math.max(0, rawFact1Val) : null;

  const apiWf2Val = getCleanNum(getApiVal("wf2/active_power"));
  const rawFact2Val = liveWf2Kw !== null && liveWf2Kw !== undefined ? liveWf2Kw : apiWf2Val;
  const isFact2Offline = !isLiveLoading && (rawFact2Val === null || (liveWf2Status === false && rawFact2Val === 0 && apiWf2Val === null));
  const fact2Kw = rawFact2Val !== null ? Math.max(0, rawFact2Val) : null;

  const apiPlnVal = getCleanNum(getApiVal("pln/active_power"));
  const rawPGridVal = livePGridKw !== null && livePGridKw !== undefined ? livePGridKw : apiPlnVal;
  const isPlnOffline = !isLiveLoading && rawPGridVal === null;
  const pGridNum = rawPGridVal !== null ? Math.max(0, rawPGridVal) : null;

  const hasPoi1Data = pltsLive.poi1.status === true || (typeof pltsLive.poi1.active_power === "number" && pltsLive.poi1.active_power > 0) || solarLive?.poi1?.status === true;
  const isPoi1Offline = !isLiveLoading && !hasPoi1Data && (pltsLive.poi1.status === false || solarLive?.poi1?.status === false);
  const hasPoi2Data = pltsLive.poi2.status === true || (typeof pltsLive.poi2.active_power === "number" && pltsLive.poi2.active_power > 0) || solarLive?.poi2?.status === true;
  const isPoi2Offline = !isLiveLoading && !hasPoi2Data && (pltsLive.poi2.status === false || solarLive?.poi2?.status === false);
  const poi1Kw = !isPoi1Offline ? Math.max(0, pltsLive.poi1.active_power || solarLive?.poi1?.activePower || 0) : null;
  const poi2Kw = !isPoi2Offline ? Math.max(0, pltsLive.poi2.active_power || solarLive?.poi2?.activePower || 0) : null;
  const isSolarOffline = !isLiveLoading && isPoi1Offline && isPoi2Offline;
  const totalSolarKw = (!isSolarOffline && (poi1Kw !== null || poi2Kw !== null)) ? ((poi1Kw ?? 0) + (poi2Kw ?? 0)) : null;

  const gensetRunning = Number(getCleanNum(getApiVal("electricity/genset_running"))) || 0;
  const pGensetNum = gensetRunning === 1 ? 850 : gensetRunning > 1 ? 1850 : 0;

  const totalPlantLoadKw = !isLiveLoading && (pGridNum !== null || totalSolarKw !== null || pGensetNum > 0)
    ? (pGridNum ?? 0) + (totalSolarKw ?? 0) + pGensetNum
    : null;

  const gridPct = totalPlantLoadKw !== null && totalPlantLoadKw > 0 && pGridNum !== null ? (pGridNum / totalPlantLoadKw) * 100 : 0;
  const solarPct = totalPlantLoadKw !== null && totalPlantLoadKw > 0 && totalSolarKw !== null ? (totalSolarKw / totalPlantLoadKw) * 100 : 0;
  const poi1Pct = totalPlantLoadKw !== null && totalPlantLoadKw > 0 && poi1Kw !== null ? (poi1Kw / totalPlantLoadKw) * 100 : 0;
  const poi2Pct = totalPlantLoadKw !== null && totalPlantLoadKw > 0 && poi2Kw !== null ? (poi2Kw / totalPlantLoadKw) * 100 : 0;
  const fact1Pct = totalPlantLoadKw !== null && totalPlantLoadKw > 0 && fact1Kw !== null ? (fact1Kw / totalPlantLoadKw) * 100 : 0;
  const fact2Pct = totalPlantLoadKw !== null && totalPlantLoadKw > 0 && fact2Kw !== null ? (fact2Kw / totalPlantLoadKw) * 100 : 0;

  /* ═══ RENDER ═══ */
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Listrik — Overview" description="Monitor beban listrik utama, solar panel, genset, dan total plant load." />
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 4h7v5h5v11H6V4zm8 8.5 1.5 2.5-1.5 2.5h-1.5l1.5-2.5-1.5-2.5h1.5zm-5 0 1.5 2.5-1.5 2.5H7.5L9 14.5 7.5 12H9z"/>
            </svg>
            Export Excel
          </button>
          {canAccessConfig && (
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
            >
              <IconSettings />
              Konfigurasi
            </button>
          )}
        </div>
      </div>

      {/* ═══════════ SECTION A: TOP 4 SUMMARY CARDS ═══════════ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Grid Import (PLN) */}
        <div className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #1e3a8a, #1e40af)' 
                 : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
               borderColor: isDark ? '#1e293b' : '#bae6fd'
             }}>
          <Sparkline color={isDark ? "#93c5fd" : "#3b82f6"} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>Grid Import (PLN)</span>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono border ${
                  isLiveLoading
                    ? isDark ? 'bg-blue-400/10 text-blue-300 border-blue-400/20 animate-pulse' : 'bg-blue-600/10 text-blue-700 border-blue-600/20 animate-pulse'
                    : isPlnOffline
                    ? isDark ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                    : isDark ? 'bg-blue-400/20 text-blue-200 border-blue-400/30' : 'bg-blue-600/10 text-blue-700 border-blue-600/20'
                }`}>
                  {isLiveLoading ? "POLLING..." : isPlnOffline ? "OFFLINE" : `${gridPct.toFixed(1)}% Load`}
                </span>
                <div className={`h-8 w-8 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-blue-600/10 text-blue-700'} flex items-center justify-center`}><IconGrid /></div>
              </div>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-blue-950'}`}>
              {isLiveLoading ? (
                <div className="h-9 w-32 bg-blue-400/20 dark:bg-blue-300/20 rounded-lg animate-pulse" />
              ) : isPlnOffline ? (
                <span className="text-xl text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
              ) : (
                <>
                  {pGridNum !== null ? pGridNum.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0.0"}
                  <span className={`text-sm font-bold ml-1 ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>kW</span>
                </>
              )}
            </div>
            <div className={`mt-2 flex items-center justify-between text-[10px] ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
              <span>Fact 1: <strong className={isDark ? 'text-white' : 'text-blue-950'}>
                {isLiveLoading ? (
                  <span className="opacity-40">...</span>
                ) : isFact1Offline ? (
                  <span className="text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
                ) : (
                  `${(fact1Kw ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW (${fact1Pct.toFixed(1)}%)`
                )}
              </strong></span>
              <span>Fact 2: <strong className={isDark ? 'text-white' : 'text-blue-950'}>
                {isLiveLoading ? (
                  <span className="opacity-40">...</span>
                ) : isFact2Offline ? (
                  <span className="text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
                ) : (
                  `${(fact2Kw ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW (${fact2Pct.toFixed(1)}%)`
                )}
              </strong></span>
            </div>
          </div>
        </div>

        {/* Solar Generation */}
        <div className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #064e3b, #047857)' 
                 : 'linear-gradient(135deg, #f0fdf4, #d1fae5)',
               borderColor: isDark ? '#1e293b' : '#a7f3d0'
             }}>
          <Sparkline color={isDark ? "#6ee7b7" : "#10b981"} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>Solar Generation</span>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono border ${
                  isLiveLoading
                    ? isDark ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20 animate-pulse' : 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20 animate-pulse'
                    : isSolarOffline
                    ? isDark ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                    : isDark ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30' : 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20'
                }`}>
                  {isLiveLoading ? "POLLING..." : isSolarOffline ? "OFFLINE" : `${solarPct.toFixed(1)}% Load`}
                </span>
                <div className={`h-8 w-8 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-emerald-600/10 text-emerald-700'} flex items-center justify-center`}><IconSolar /></div>
              </div>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-emerald-950'}`}>
              {isLiveLoading ? (
                <div className="h-9 w-32 bg-emerald-400/20 dark:bg-emerald-300/20 rounded-lg animate-pulse" />
              ) : isSolarOffline ? (
                <span className="text-xl text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
              ) : (
                <>
                  {totalSolarKw !== null ? totalSolarKw.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0.0"}
                  <span className={`text-sm font-bold ml-1 ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>kW</span>
                </>
              )}
            </div>
            <div className={`mt-2 flex items-center justify-between text-[10px] ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
              <span>POI-1: <strong className={isDark ? 'text-white' : 'text-emerald-950'}>
                {isLiveLoading ? (
                  <span className="opacity-40">...</span>
                ) : isPoi1Offline ? (
                  <span className="text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
                ) : (
                  `${(poi1Kw ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW (${poi1Pct.toFixed(1)}%)`
                )}
              </strong></span>
              <span>POI-2: <strong className={isDark ? 'text-white' : 'text-emerald-950'}>
                {isLiveLoading ? (
                  <span className="opacity-40">...</span>
                ) : isPoi2Offline ? (
                  <span className="text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
                ) : (
                  `${(poi2Kw ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW (${poi2Pct.toFixed(1)}%)`
                )}
              </strong></span>
            </div>
          </div>
        </div>

        {/* Genset Backup */}
        <div className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #78350f, #b45309)' 
                 : 'linear-gradient(135deg, #fffbeb, #fef3c7)',
               borderColor: isDark ? '#1e293b' : '#fde68a'
             }}>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Genset Backup</span>
              <div className={`h-6 w-6 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-amber-600/10 text-amber-700'} flex items-center justify-center`}><IconGenset /></div>
            </div>
            
            {/* 2 Inner Sub-Cards */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              {/* Caterpillar */}
              <div className={`p-2 rounded-xl border transition duration-300 ${
                isDark ? 'bg-black/35 border-amber-500/20' : 'bg-white/80 border-amber-200/60'
              } flex flex-col justify-between`}>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400">Caterpillar</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${Number(getApiVal("electricity/genset_running")) > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                </div>
                <div className="mt-1">
                  <div className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-amber-950'}`}>
                    {Number(getApiVal("electricity/genset_running")) > 0 ? "850" : "0"} <span className="text-[8px] font-bold text-slate-400">kW</span>
                  </div>
                  <span className={`text-[8px] font-extrabold ${Number(getApiVal("electricity/genset_running")) > 0 ? "text-emerald-500" : "text-slate-400"}`}>
                    {Number(getApiVal("electricity/genset_running")) > 0 ? "ON (Gas)" : "OFF"}
                  </span>
                </div>
              </div>

              {/* Perkins */}
              <div className={`p-2 rounded-xl border transition duration-300 ${
                isDark ? 'bg-black/35 border-amber-500/20' : 'bg-white/80 border-amber-200/60'
              } flex flex-col justify-between`}>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400">Perkins</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${Number(getApiVal("electricity/genset_running")) > 1 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                </div>
                <div className="mt-1">
                  <div className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-amber-950'}`}>
                    {Number(getApiVal("electricity/genset_running")) > 1 ? "1000" : "0"} <span className="text-[8px] font-bold text-slate-400">kW</span>
                  </div>
                  <span className={`text-[8px] font-extrabold ${Number(getApiVal("electricity/genset_running")) > 1 ? "text-emerald-500" : "text-slate-400"}`}>
                    {Number(getApiVal("electricity/genset_running")) > 1 ? "ON (Diesel)" : "OFF"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Total Plant Load */}
        <div className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
             style={{
               background: isDark 
                 ? 'linear-gradient(135deg, #164e63, #0e7490)' 
                 : 'linear-gradient(135deg, #ecfeff, #cffafe)',
               borderColor: isDark ? '#1e293b' : '#a5f3fc'
             }}>
          <Sparkline color={isDark ? "#67e8f9" : "#06b6d4"} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>Total Plant Load</span>
              <div className={`h-8 w-8 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-cyan-600/10 text-cyan-700'} flex items-center justify-center`}><IconPlant /></div>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-cyan-950'}`}>
              {isLiveLoading ? (
                <div className="h-9 w-36 bg-cyan-400/20 dark:bg-cyan-300/20 rounded-lg animate-pulse" />
              ) : totalPlantLoadKw === null || (isPlnOffline && isSolarOffline && pGensetNum === 0) ? (
                <span className="text-xl text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
              ) : (
                <>
                  {totalPlantLoadKw.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <span className={`text-sm font-bold ml-1 ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>kW</span>
                </>
              )}
            </div>
            <div className={`mt-2 flex items-center gap-3 text-[10px] ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>
              <span>P Grid: <strong className={isDark ? 'text-white' : 'text-cyan-950'}>
                {isLiveLoading ? (
                  <span className="opacity-40">...</span>
                ) : isPlnOffline ? (
                  <span className="text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
                ) : (
                  `${(pGridNum ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW (${gridPct.toFixed(1)}%)`
                )}
              </strong></span>
              <span>P Solar: <strong className={isDark ? 'text-white' : 'text-cyan-950'}>
                {isLiveLoading ? (
                  <span className="opacity-40">...</span>
                ) : isSolarOffline ? (
                  <span className="text-amber-400 dark:text-amber-300 font-bold">Gagal Polling API</span>
                ) : (
                  `${(totalSolarKw ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW (${solarPct.toFixed(1)}%)`
                )}
              </strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION: TOTAL REKAPITULASI BIAYA & ENERGI (PLN + PV) ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              Total Rekapitulasi Biaya & Konsumsi Listrik
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              PLN + Solar PV
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Periode: <strong className="text-slate-700 dark:text-slate-200">{executivePeriodLabel}</strong></span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: PLN */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  PLN (Incoming Grid)
                </span>
                <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <IconBolt />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                {!fixedMonthlyPln && !summaryData ? "..." : formatCurrency(executiveSummary.plnCost)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Konsumsi:</span>
                <span>{formatNumber(executiveSummary.plnKwh)} kWh</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
              {/* Ratio bar */}
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex mb-2">
                <div 
                  className="bg-blue-500 transition-all duration-500" 
                  style={{ width: `${executiveSummary.pctKwhPln}%` }} 
                  title={`PLN: ${executiveSummary.pctKwhPln.toFixed(1)}%`}
                />
                <div 
                  className="bg-slate-300 dark:bg-slate-700 transition-all duration-500" 
                  style={{ width: `${executiveSummary.pctKwhPv}%` }} 
                  title={`PV: ${executiveSummary.pctKwhPv.toFixed(1)}%`}
                />
              </div>
              <div className="text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{executiveSummary.pctKwhPln.toFixed(1)}%</strong> porsi energi <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">(vs PV {executiveSummary.pctKwhPv.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Solar PV */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Solar PV (PLTS)
                </span>
                <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <IconSun />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                {!fixedMonthlyPln && !summaryData ? "..." : formatCurrency(executiveSummary.pvCost)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Produksi:</span>
                <span>{formatNumber(executiveSummary.totalPvKwh)} kWh</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
              {/* Ratio bar */}
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex mb-2">
                <div 
                  className="bg-amber-500 transition-all duration-500" 
                  style={{ width: `${executiveSummary.pctKwhPv}%` }} 
                  title={`PV: ${executiveSummary.pctKwhPv.toFixed(1)}%`}
                />
                <div 
                  className="bg-slate-300 dark:bg-slate-700 transition-all duration-500" 
                  style={{ width: `${executiveSummary.pctKwhPln}%` }} 
                  title={`PLN: ${executiveSummary.pctKwhPln.toFixed(1)}%`}
                />
              </div>
              <div className="text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                <strong className="text-amber-600 dark:text-amber-400 font-mono text-xs">{executiveSummary.pctKwhPv.toFixed(1)}%</strong> porsi energi <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">(vs PLN {executiveSummary.pctKwhPln.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Cost & Total kWh PLN & PV */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/30 p-4 hover:border-indigo-400 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Total (PLN + PV)
                </span>
                <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <IconMoney />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                {!fixedMonthlyPln && !summaryData ? "..." : formatCurrency(executiveSummary.totalCost)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Konsumsi:</span>
                <span>{formatNumber(executiveSummary.totalKwh)} kWh</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
              {/* Ratio bar */}
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex mb-2">
                <div 
                  className="bg-blue-500 transition-all duration-500" 
                  style={{ width: `${executiveSummary.pctKwhPln}%` }} 
                  title={`PLN: ${executiveSummary.pctKwhPln.toFixed(1)}%`}
                />
                <div 
                  className="bg-amber-500 transition-all duration-500" 
                  style={{ width: `${executiveSummary.pctKwhPv}%` }} 
                  title={`PV: ${executiveSummary.pctKwhPv.toFixed(1)}%`}
                />
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <strong className="text-blue-600 dark:text-blue-400 font-mono">PLN {executiveSummary.pctKwhPln.toFixed(1)}%</strong>
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <strong className="text-amber-600 dark:text-amber-400 font-mono">PV {executiveSummary.pctKwhPv.toFixed(1)}%</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Total Estimasi Penghematan */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4 hover:border-emerald-400 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Estimasi Penghematan
                </span>
                <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <IconMoney />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                {!fixedMonthlyPln && !summaryData ? "..." : formatCurrency(executiveSummary.savingsCost)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Total PV:</span>
                <span>{formatNumber(executiveSummary.totalPvKwh)} kWh</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
              {/* Savings bar */}
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex mb-2">
                <div 
                  className="bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${executiveSummary.totalCost > 0 ? ((executiveSummary.savingsCost / executiveSummary.totalCost) * 100).toFixed(1) : 0}%` }} 
                  title={`Terhemat: ${executiveSummary.totalCost > 0 ? ((executiveSummary.savingsCost / executiveSummary.totalCost) * 100).toFixed(1) : 0}%`}
                />
                <div 
                  className="bg-slate-300 dark:bg-slate-700 transition-all duration-500" 
                  style={{ width: `${executiveSummary.totalCost > 0 ? (100 - (executiveSummary.savingsCost / executiveSummary.totalCost) * 100).toFixed(1) : 100}%` }} 
                />
              </div>
              <div className="text-center text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Selisih Tarif: <strong className="font-mono font-bold text-emerald-600 dark:text-emerald-300">Rp {executiveSummary.savingsRate.toLocaleString("id-ID")}/kWh</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION B: PLN DETAIL ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">PLN — Incoming Grid</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Estimasi Biaya */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4 hover:border-emerald-400 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estimasi Biaya</span>
              <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500"><IconMoney /></div>
            </div>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
              {summaryLoading && !summaryData ? "..." : formatCurrency(cardSummary.totalCost)}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {summaryLoading && !summaryData ? "" : `${cardSummary.totalKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
          </div>

          {/* Beban LWBP */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">Beban LWBP</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading && !summaryData ? "..." : `${cardSummary.lwbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-blue-500">{summaryLoading && !summaryData ? "" : formatCurrency(cardSummary.lwbpCost)}</div>
          </div>

          {/* Beban WBP */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30 p-4 hover:border-rose-400 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">Beban WBP</span>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono">
              {summaryLoading && !summaryData ? "..." : `${cardSummary.wbpKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh`}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-rose-500">{summaryLoading && !summaryData ? "" : formatCurrency(cardSummary.wbpCost)}</div>
          </div>

          {/* PF / Power Factor */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/30 p-4 hover:border-purple-400 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">PF</span>
              <span 
                className={`h-2 w-2 rounded-full ${pfStatus === "connected" && (livePf !== null || (apiLiveData[DEFAULT_PLN_API_URL]?.Power_Factor !== undefined && apiLiveData[DEFAULT_PLN_API_URL]?.Power_Factor !== null)) ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} 
                title={pfStatus === "connected" ? "Live Real-Time Polling API" : "Gagal Polling API"} 
              />
            </div>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
              {(() => {
                const liveVal = (livePf !== null && livePf !== undefined && !isNaN(Number(livePf))) 
                  ? Number(livePf) 
                  : (apiLiveData[DEFAULT_PLN_API_URL]?.Power_Factor !== undefined && apiLiveData[DEFAULT_PLN_API_URL]?.Power_Factor !== null)
                    ? Number(apiLiveData[DEFAULT_PLN_API_URL].Power_Factor)
                    : null;
                return renderMetricVal(liveVal, (v) => `${Math.abs(v).toFixed(2)}`);
              })()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>Stabilitas beban listrik</span>
              {pfStatus === "connected" && (livePf !== null || (apiLiveData[DEFAULT_PLN_API_URL]?.Power_Factor !== undefined && apiLiveData[DEFAULT_PLN_API_URL]?.Power_Factor !== null)) ? (
                <span className="text-[9px] font-semibold text-emerald-500 font-mono">1s Live</span>
              ) : (
                <span className="text-[9px] font-semibold text-amber-500 font-mono">Gagal Polling API</span>
              )}
            </div>
          </div>

          {/* Peak Demand */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Peak Demand</span>
              <span 
                className={`h-2 w-2 rounded-full ${pfStatus === "connected" && (livePeakDemandKw !== null || (apiLiveData[DEFAULT_PLN_API_URL]?.Peak_Demand_W !== undefined && apiLiveData[DEFAULT_PLN_API_URL]?.Peak_Demand_W !== null)) ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} 
                title={pfStatus === "connected" ? "Live Real-Time Polling API" : "Gagal Polling API"} 
              />
            </div>
            <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
              {(() => {
                const liveVal = (livePeakDemandKw !== null && livePeakDemandKw !== undefined && !isNaN(Number(livePeakDemandKw)))
                  ? Number(livePeakDemandKw)
                  : (apiLiveData[DEFAULT_PLN_API_URL]?.Peak_Demand_W !== undefined && apiLiveData[DEFAULT_PLN_API_URL]?.Peak_Demand_W !== null)
                    ? Number(apiLiveData[DEFAULT_PLN_API_URL].Peak_Demand_W) / 1000.0
                    : (cardSummary?.peakDemand ? Number(cardSummary.peakDemand) : null);
                return renderMetricVal(liveVal, (v) => `${v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`);
              })()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>Estimasi beban puncak</span>
              {pfStatus === "connected" && (livePeakDemandKw !== null || (apiLiveData[DEFAULT_PLN_API_URL]?.Peak_Demand_W !== undefined && apiLiveData[DEFAULT_PLN_API_URL]?.Peak_Demand_W !== null)) ? (
                <span className="text-[9px] font-semibold text-emerald-500 font-mono">1s Live</span>
              ) : (
                <span className="text-[9px] font-semibold text-amber-500 font-mono">Gagal Polling API</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ═══════════ SECTION C: PLN TREND + DONUT ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-opacity duration-150 ${isFilterPending ? "opacity-75" : "opacity-100"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Trend Panel Distribusi</h3>
                {cardSummary.totalKwh > 0 && (
                  <span className="text-xs font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-lg">
                    Total: {cardSummary.totalKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh
                  </span>
                )}
                {isFilterPending && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-lg animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
                    Memuat...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Beban Incoming PLN — data historis (WBP & LWBP).</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
              {(range === "ytd" || range === "day" || range === "month") && (
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const yr = Number(e.target.value);
                    setSelectedYear(yr);
                    setSolarSelectedYear(yr);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {AVAILABLE_YEARS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              )}
              {range === "hour" && (
                <input
                  type="date"
                  value={chartStartDate}
                  onChange={(e) => {
                    setChartStartDate(e.target.value);
                    setSolarStartDate(e.target.value);
                    setChartEndDate(e.target.value);
                    setSolarEndDate(e.target.value);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                />
              )}
              {range === "day" && (
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    const mo = Number(e.target.value);
                    setSelectedMonth(mo);
                    setSolarSelectedMonth(mo);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {MONTH_NAMES_ID.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
                </select>
              )}
              {range === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={chartStartDate}
                    onChange={(e) => {
                      setChartStartDate(e.target.value);
                      setSolarStartDate(e.target.value);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={chartEndDate}
                    onChange={(e) => {
                      setChartEndDate(e.target.value);
                      setSolarEndDate(e.target.value);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                </div>
              )}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
                {ranges.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRange(item.id);
                      setSolarRange(item.id);
                    }}
                    className={`rounded-md px-3 py-1.5 font-bold transition-all ${range === item.id ? "bg-cyan-500 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
            <div style={{ height: 256 }}>
              <Bar data={stackedBarData} options={stackedBarOptions} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Distribusi Beban</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Perbandingan konsumsi WBP vs LWBP.</p>
          </div>
          <div className="my-6 flex justify-center">
            <DonutChart 
              segments={donutSegments} 
              size={150} 
              thickness={18} 
              centerLabel={donutSegments[0]?.value > 0 ? `WBP ${donutSegments[0].value}%` : `LWBP 100%`} 
            />
          </div>
          <div className="space-y-2">
            {donutSegments.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5 last:border-0 last:pb-0">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">{item.value}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ═══════════ SECTION D: SOLAR PANEL ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Solar Panel (PLTS)</h3>
          </div>
          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
            isSolarOffline
              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
          }`}>
            {isSolarOffline ? "GAGAL POLLING API" : "ONLINE"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {/* Estimasi Biaya PV */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Estimasi Biaya PV</span>
              <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500"><IconMoney /></div>
            </div>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {formatCurrency(solarFilteredMetrics.pvCost)}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {formatNumber(solarFilteredMetrics.totalKwh)} kWh ({solarFilteredMetrics.periodLabel})
            </div>
          </div>

          {/* POI-1 */}
          <div className={`rounded-xl border p-4 transition-all ${
            isPoi1Offline
              ? "border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30"
              : solarLive?.poi1?.status === false
              ? "border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30"
              : "border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                isPoi1Offline
                  ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                  : solarLive?.poi1?.status === false
                  ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                  : "text-blue-500 bg-blue-500/10 border-blue-500/20"
              }`}>
                {isPoi1Offline ? "POI-1 (GAGAL POLLING API)" : solarLive?.poi1?.status === false ? "POI-1 (TIDAK AKTIF)" : "POI-1"}
              </span>
              <span className={`h-2 w-2 rounded-full ${
                isPoi1Offline
                  ? "bg-amber-500"
                  : solarLive?.poi1?.status === false
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`} />
            </div>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {formatNumber(solarFilteredMetrics.poi1Kwh)} kWh
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {isPoi1Offline
                ? "Status: GAGAL POLLING API"
                : solarLive?.poi1?.status === false
                ? "Status: TIDAK AKTIF"
                : `${solarFilteredMetrics.periodLabel}${solarLive?.poi1?.voltAb ? ` • ${solarLive.poi1.voltAb.toFixed(1)} V` : ""}`}
            </div>
          </div>

          {/* Peak Demand (POI-1) */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Demand (POI-1)</span>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {formatNumber(solarFilteredMetrics.poi1PeakDemand)} kW
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Puncak beban {solarFilteredMetrics.periodLabel}</div>
          </div>

          {/* POI-2 */}
          <div className={`rounded-xl border p-4 transition-all ${
            isPoi2Offline
              ? "border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30"
              : solarLive?.poi2?.status === false
              ? "border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/30"
              : "border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-950/30"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                isPoi2Offline
                  ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                  : solarLive?.poi2?.status === false
                  ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                  : "text-cyan-500 bg-cyan-500/10 border-cyan-500/20"
              }`}>
                {isPoi2Offline ? "POI-2 (GAGAL POLLING API)" : solarLive?.poi2?.status === false ? "POI-2 (TIDAK AKTIF)" : "POI-2"}
              </span>
              <span className={`h-2 w-2 rounded-full ${
                isPoi2Offline
                  ? "bg-amber-500"
                  : solarLive?.poi2?.status === false
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`} />
            </div>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {formatNumber(solarFilteredMetrics.poi2Kwh)} kWh
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {isPoi2Offline
                ? "Status: GAGAL POLLING API"
                : solarLive?.poi2?.status === false
                ? "Status: TIDAK AKTIF"
                : `${solarFilteredMetrics.periodLabel}${solarLive?.poi2?.voltAb ? ` • ${solarLive.poi2.voltAb.toFixed(1)} V` : ""}`}
            </div>
          </div>

          {/* Peak Demand (POI-2) */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Demand (POI-2)</span>
            <div className="mt-2 text-base font-extrabold text-slate-800 dark:text-white font-mono">
              {formatNumber(solarFilteredMetrics.poi2PeakDemand)} kW
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Puncak beban {solarFilteredMetrics.periodLabel}</div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION E: SOLAR PANEL CHART + DONUT ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between transition-opacity duration-150 ${isSolarFilterPending ? "opacity-75" : "opacity-100"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Trend Produksi Solar Panel (PLTS)</h3>
                  {isSolarFilterPending && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
                      Memuat...
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Produksi energi POI-1 & POI-2 — data historis per jam.</p>
              </div>
              {/* Checklist options: POI-1, POI-2 */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <label className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition">
                  <input
                    type="checkbox"
                    checked={solarShowPoi1}
                    onChange={(e) => {
                      if (!e.target.checked && !solarShowPoi2) return;
                      setSolarShowPoi1(e.target.checked);
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                  />
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    POI-1
                  </span>
                </label>
                <label className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition">
                  <input
                    type="checkbox"
                    checked={solarShowPoi2}
                    onChange={(e) => {
                      if (!e.target.checked && !solarShowPoi1) return;
                      setSolarShowPoi2(e.target.checked);
                    }}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-3.5 w-3.5 cursor-pointer accent-cyan-600"
                  />
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-500" />
                    POI-2
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
              {/* Year / Month / Date Pickers */}
              {(solarRange === "ytd" || solarRange === "day" || solarRange === "month") && (
                <select
                  value={solarSelectedYear}
                  onChange={(e) => {
                    const yr = Number(e.target.value);
                    setSolarSelectedYear(yr);
                    setSelectedYear(yr);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {AVAILABLE_YEARS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              )}
              {solarRange === "hour" && (
                <input
                  type="date"
                  value={solarStartDate}
                  onChange={(e) => {
                    setSolarStartDate(e.target.value);
                    setChartStartDate(e.target.value);
                    setSolarEndDate(e.target.value);
                    setChartEndDate(e.target.value);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                />
              )}
              {solarRange === "day" && (
                <select
                  value={solarSelectedMonth}
                  onChange={(e) => {
                    const mo = Number(e.target.value);
                    setSolarSelectedMonth(mo);
                    setSelectedMonth(mo);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                >
                  {MONTH_NAMES_ID.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
                </select>
              )}
              {solarRange === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={solarStartDate}
                    onChange={(e) => {
                      setSolarStartDate(e.target.value);
                      setChartStartDate(e.target.value);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={solarEndDate}
                    onChange={(e) => {
                      setSolarEndDate(e.target.value);
                      setChartEndDate(e.target.value);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition"
                  />
                </div>
              )}

              {/* Range Buttons */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs">
                {ranges.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSolarRange(item.id);
                      setRange(item.id);
                    }}
                    className={`rounded-md px-3 py-1.5 font-bold transition-all ${
                      solarRange === item.id
                        ? "bg-cyan-500 text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[256px]">
            <div style={{ height: 256 }}>
              <Bar data={solarBarData} options={solarBarOptions} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Distribusi Beban PLTS</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Perbandingan produksi POI-1 vs POI-2.</p>
          </div>
          {(() => {
            const totP1 = solarShowPoi1 ? (solarPoi1Values as number[]).reduce((a: number, b: number) => a + (b || 0), 0) : 0;
            const totP2 = solarShowPoi2 ? (solarPoi2Values as number[]).reduce((a: number, b: number) => a + (b || 0), 0) : 0;
            const total = totP1 + totP2;
            const p1Pct = total > 0 && solarShowPoi1 ? Number(((totP1 / total) * 100).toFixed(1)) : (solarShowPoi1 && !solarShowPoi2 ? 100 : 0);
            const p2Pct = total > 0 && solarShowPoi2 ? Number(((totP2 / total) * 100).toFixed(1)) : (solarShowPoi2 && !solarShowPoi1 ? 100 : 0);

            const segments = [];
            if (solarShowPoi1 && (p1Pct > 0 || !solarShowPoi2)) {
              segments.push({ label: "POI-1", value: p1Pct, color: "#3b82f6" });
            }
            if (solarShowPoi2 && (p2Pct > 0 || !solarShowPoi1)) {
              segments.push({ label: "POI-2", value: p2Pct, color: "#06b6d4" });
            }
            if (segments.length === 0) {
              segments.push({ label: "Tidak Ada Data", value: 100, color: "#94a3b8" });
            }

            const centerLabel = (solarShowPoi1 && solarShowPoi2)
              ? (total > 0 ? `${p1Pct}% : ${p2Pct}%` : "0% : 0%")
              : solarShowPoi1
              ? `POI-1 ${p1Pct}%`
              : `POI-2 ${p2Pct}%`;

            return (
              <>
                <div className="my-6 flex justify-center">
                  <DonutChart 
                    segments={segments} 
                    size={150} 
                    thickness={18} 
                    centerLabel={centerLabel} 
                    centerLabelSize="text-[11px]" 
                  />
                </div>
                <div className="space-y-2">
                  {solarShowPoi1 && (
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />POI-1
                      </span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">
                        {isPoi1Offline ? (
                          <span className="text-amber-500">Gagal Polling API</span>
                        ) : solarLive?.poi1?.status === false ? (
                          <span className="text-rose-500">TIDAK AKTIF</span>
                        ) : (
                          `${p1Pct}% (${formatNumber(totP1)} kWh)`
                        )}
                      </span>
                    </div>
                  )}
                  {solarShowPoi2 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                        <span className="h-2 w-2 rounded-full bg-cyan-500" />POI-2
                      </span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">
                        {isPoi2Offline ? (
                          <span className="text-amber-500">Gagal Polling API</span>
                        ) : solarLive?.poi2?.status === false ? (
                          <span className="text-rose-500">TIDAK AKTIF</span>
                        ) : (
                          `${p2Pct}% (${formatNumber(totP2)} kWh)`
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </section>
      </div>

      {/* ═══════════ SECTION F: INCOMING CUBICLE ═══════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-white">
              Dashboard <span className="text-slate-400 dark:text-slate-500">|</span> <span className="text-blue-500">Home</span> <span className="text-slate-400 dark:text-slate-500">›</span> Monthly Consumption
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={cubicleSelector}
              onChange={(e) => setCubicleSelector(e.target.value as any)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer outline-none"
            >
              <option value="all">All (PLN + Total POI-1 & POI-2)</option>
              <option value="pln">Incoming PLN Grid</option>
              <option value="wf1">Incoming Cubicle WF1</option>
              <option value="wf2">Incoming Cubicle WF2</option>
              <option value="poi1">Solar PV POI-1</option>
              <option value="poi2">Solar PV POI-2</option>
            </select>
            {(() => {
              let isOnline = true;
              let isGagalPolling = false;
              if (cubicleSelector === "pln") {
                isOnline = !isPlnOffline;
                isGagalPolling = isPlnOffline;
              } else if (cubicleSelector === "wf1") {
                isOnline = !isFact1Offline;
                isGagalPolling = isFact1Offline;
              } else if (cubicleSelector === "wf2") {
                isOnline = !isFact2Offline;
                isGagalPolling = isFact2Offline;
              } else if (cubicleSelector === "poi1") {
                isOnline = !isPoi1Offline && solarLive?.poi1?.status !== false;
                isGagalPolling = isPoi1Offline;
              } else if (cubicleSelector === "poi2") {
                isOnline = !isPoi2Offline && solarLive?.poi2?.status !== false;
                isGagalPolling = isPoi2Offline;
              } else if (cubicleSelector === "all") {
                isOnline = !isPlnOffline || !isSolarOffline;
                isGagalPolling = isPlnOffline && isSolarOffline;
              }
              return (
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  isGagalPolling
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : isOnline
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                }`}>
                  {isGagalPolling ? "GAGAL POLLING API" : isOnline ? "ON" : "TIDAK AKTIF"}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Monthly consumption summary cards */}
        {(() => {
          const wf1Kwh = cubicleSelector === "wf1"
            ? ((cubicleDailyData.currentData || []).reduce((a, b) => a + b, 0) || cubicleSummary.monthlyKwh || 0)
            : 0;
          const wf1Cost = cubicleSelector === "wf1"
            ? (cubicleSummary.cost || (wf1Kwh * (monthlyMetrics.effectiveLwbpRate || 1112)))
            : 0;

          const wf2Kwh = cubicleSelector === "wf2"
            ? ((cubicleDailyData.currentData || []).reduce((a, b) => a + b, 0) || cubicleSummary.monthlyKwh || 0)
            : 0;
          const wf2Cost = cubicleSelector === "wf2"
            ? (cubicleSummary.cost || (wf2Kwh * (monthlyMetrics.effectiveLwbpRate || 1112)))
            : 0;

          const poi1Kwh = monthlyMetrics.poi1Kwh || (cubicleSelector === "poi1" ? (cubicleDailyData.currentData || []).reduce((a, b) => a + b, 0) : 0) || cubicleSummary.poi1Kwh || 0;
          const poi1Cost = poi1Kwh * monthlyMetrics.effectivePvRate;
          const poi1Savings = poi1Kwh * monthlyMetrics.savingsRate;

          const poi2Kwh = monthlyMetrics.poi2Kwh || (cubicleSelector === "poi2" ? (cubicleDailyData.currentData || []).reduce((a, b) => a + b, 0) : 0) || cubicleSummary.poi2Kwh || 0;
          const poi2Cost = poi2Kwh * monthlyMetrics.effectivePvRate;
          const poi2Savings = poi2Kwh * monthlyMetrics.savingsRate;

          const gridColsClass = cubicleSelector === "all"
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : (cubicleSelector === "poi1" || cubicleSelector === "poi2")
            ? "sm:grid-cols-3"
            : "sm:grid-cols-2";

          return (
            <div className={`grid gap-3 ${gridColsClass}`}>
              {/* All (PLN + PV): 4 cards */}
              {cubicleSelector === "all" && (
                <>
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/30 p-4 hover:border-indigo-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          kWh Total (PLN + PV)
                        </span>
                        <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                          <IconBolt />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatNumber(monthlyMetrics.totalKwh)} <span className="text-xs text-slate-400 font-sans">kWh</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>PLN: <strong className="text-slate-700 dark:text-slate-200 font-mono">{formatNumber(monthlyMetrics.plnKwh)}</strong></span>
                      <span>PV: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatNumber(monthlyMetrics.totalPvKwh)}</strong></span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Est Cost Total PLN
                        </span>
                        <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatCurrency(monthlyMetrics.plnCost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Beban Incoming PLN bulan ini
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Est Cost Total PV
                        </span>
                        <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatCurrency(monthlyMetrics.pvCost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Tarif PV: Rp {monthlyMetrics.effectivePvRate.toLocaleString("id-ID")}/kWh
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4 hover:border-emerald-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Est Saving
                        </span>
                        <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                        {formatCurrency(monthlyMetrics.savingsCost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Selisih PLN (LWBP) - Biaya PV
                    </div>
                  </div>
                </>
              )}

              {/* PLN: 2 cards */}
              {cubicleSelector === "pln" && (
                <>
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/30 p-4 hover:border-indigo-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          kWh Total PLN
                        </span>
                        <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                          <IconBolt />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatNumber(monthlyMetrics.plnKwh)} <span className="text-xs text-slate-400 font-sans">kWh</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Incoming PLN Grid bulan ini
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Est Cost Total PLN
                        </span>
                        <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatCurrency(monthlyMetrics.plnCost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Beban Incoming PLN bulan ini
                    </div>
                  </div>
                </>
              )}

              {/* WF1: 2 cards */}
              {cubicleSelector === "wf1" && (
                <>
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/30 p-4 hover:border-indigo-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          kWh Total WF1
                        </span>
                        <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                          <IconBolt />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatNumber(wf1Kwh)} <span className="text-xs text-slate-400 font-sans">kWh</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Incoming Feeder WF1 bulan ini
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Est Cost WF1
                        </span>
                        <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatCurrency(wf1Cost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Estimasi biaya pemakaian WF1
                    </div>
                  </div>
                </>
              )}

              {/* WF2: 2 cards */}
              {cubicleSelector === "wf2" && (
                <>
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/30 p-4 hover:border-indigo-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          kWh Total WF2
                        </span>
                        <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                          <IconBolt />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatNumber(wf2Kwh)} <span className="text-xs text-slate-400 font-sans">kWh</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Incoming Feeder WF2 bulan ini
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/30 p-4 hover:border-blue-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Est Cost WF2
                        </span>
                        <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatCurrency(wf2Cost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Estimasi biaya pemakaian WF2
                    </div>
                  </div>
                </>
              )}

              {/* POI-1: 3 cards */}
              {cubicleSelector === "poi1" && (
                <>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          kWh Total POI-1
                        </span>
                        <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <IconSun />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatNumber(poi1Kwh)} <span className="text-xs text-slate-400 font-sans">kWh</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Produksi Solar PV POI-1 bulan ini
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Est Cost PV (POI-1)
                        </span>
                        <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatCurrency(poi1Cost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Tarif PV: Rp {monthlyMetrics.effectivePvRate.toLocaleString("id-ID")}/kWh
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4 hover:border-emerald-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Est Saving (POI-1)
                        </span>
                        <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                        {formatCurrency(poi1Savings)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Selisih PLN (LWBP) - Biaya PV
                    </div>
                  </div>
                </>
              )}

              {/* POI-2: 3 cards */}
              {cubicleSelector === "poi2" && (
                <>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          kWh Total POI-2
                        </span>
                        <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <IconSun />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatNumber(poi2Kwh)} <span className="text-xs text-slate-400 font-sans">kWh</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Produksi Solar PV POI-2 bulan ini
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/30 p-4 hover:border-amber-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Est Cost PV (POI-2)
                        </span>
                        <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white font-mono leading-tight">
                        {formatCurrency(poi2Cost)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Tarif PV: Rp {monthlyMetrics.effectivePvRate.toLocaleString("id-ID")}/kWh
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 p-4 hover:border-emerald-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Est Saving (POI-2)
                        </span>
                        <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <IconMoney />
                        </div>
                      </div>
                      <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                        {formatCurrency(poi2Savings)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                      Selisih PLN (LWBP) - Biaya PV
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Cubicle monthly comparison chart */}
        <MonthlyComparisonChart
          title={`Konsumsi Bulanan Real Time (vs Bulan Sebelumnya) — ${
            cubicleSelector === "all" ? "All (PLN + Total POI-1 & POI-2)" :
            cubicleSelector === "pln" ? "Incoming PLN Grid" :
            cubicleSelector === "wf1" ? "Incoming Cubicle WF1" :
            cubicleSelector === "wf2" ? "Incoming Cubicle WF2" :
            cubicleSelector === "poi1" ? "Solar PV POI-1" : "Solar PV POI-2"
          }`}
          currentData={cubicleDailyData.currentData}
          previousData={cubicleDailyData.previousData}
          isDark={isDark}
          currMonthName={MONTH_NAMES_ID[new Date().getMonth()]}
          prevMonthName={MONTH_NAMES_ID[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1]}
          selectorType={cubicleSelector}
          currentBreakdown={cubicleDailyData.currentBreakdown}
          previousBreakdown={cubicleDailyData.previousBreakdown}
          solarRate={solarData?.summary?.solarRate || lwbpRate}
          pvRate={pvRate}
        />
      </div>

      {/* ═══════════ ROW 1: BIGGEST CONSUMPTION ═══════════ */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Biggest Consumption - Fact 1 */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Biggest Consumption - Fact 1</h3>
                {fact1Total > 0 && (
                  <span className="text-xs font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                    Total: {fact1Total.toLocaleString("id-ID")} kWh
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fact-1 categories sorted by highest consumption.</p>
            </div>
            {isSeniorUnitHead && (
              <button
                type="button"
                onClick={() => openSeniorConfigModal("consumption_fact_1", "all")}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition cursor-pointer"
                title="Kelola Item Fact 1 (Senior Unit Head Only)"
              >
                <IconSettings />
                <span>⚙️ Kelola Item</span>
              </button>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            {factCategories1.filter(c => c.enabled).length > 0 ? (
              <div className="overflow-y-auto max-h-[380px] pr-1.5">
                <div style={{ height: Math.max(250, factCategories1.filter(c => c.enabled).length * 28) }}>
                  <Bar data={makeHorizontalBarData(factCategories1, 1)} options={horizontalBarOptions} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <span className="text-2xl mb-1 opacity-40">📊</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering Fact-1 belum terhubung</span>
              </div>
            )}
          </div>
        </section>

        {/* Biggest Consumption - Fact 2 */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Biggest Consumption - Fact 2</h3>
                {fact2Total > 0 && (
                  <span className="text-xs font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                    Total: {fact2Total.toLocaleString("id-ID")} kWh
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fact-2 categories sorted by highest consumption.</p>
            </div>
            {isSeniorUnitHead && (
              <button
                type="button"
                onClick={() => openSeniorConfigModal("consumption_fact_2", "all")}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer"
                title="Kelola Item Fact 2 (Senior Unit Head Only)"
              >
                <IconSettings />
                <span>⚙️ Kelola Item</span>
              </button>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            {factCategories2.filter(c => c.enabled).length > 0 ? (
              <div className="overflow-y-auto max-h-[380px] pr-1.5">
                <div style={{ height: Math.max(250, factCategories2.filter(c => c.enabled).length * 28) }}>
                  <Bar data={makeHorizontalBarData(factCategories2, 2)} options={horizontalBarOptions} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <span className="text-2xl mb-1 opacity-40">📊</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering Fact-2 belum terhubung</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════ ROW 2: UTILITY DEPARTMENT ANALYSIS ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Utility Consumption - Horizontal Bar Chart Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Utility Consumption</h3>
                {utilityData.totalKwh > 0 && (
                  <span className="text-xs font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                    Total: {utilityData.totalKwh.toLocaleString("id-ID")} kWh
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Utility electricity consumption sorted by highest consumer.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={utilityFilter}
                onChange={(e) => setUtilityFilter(e.target.value as any)}
                className="px-2.5 py-1 text-xs rounded border border-slate-350 bg-slate-50 text-slate-800 dark:bg-slate-850 dark:text-slate-200 dark:border-slate-700 font-bold focus:outline-none cursor-pointer"
              >
                <option value="Fact 1">Fact 1 Only</option>
                <option value="Fact 2">Fact 2 Only</option>
              </select>
              {isSeniorUnitHead && (
                <button
                  type="button"
                  onClick={() => openSeniorConfigModal(utilityFilter === "Fact 1" ? "consumption_fact_1" : "consumption_fact_2", "Utility")}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition cursor-pointer"
                  title="Kelola Item Utility (Senior Unit Head Only)"
                >
                  <IconSettings />
                  <span>⚙️ Kelola Item</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            {utilityData.items.length > 0 ? (
              <div className="overflow-y-auto max-h-[380px] pr-1.5">
                <div style={{ height: Math.max(250, utilityData.items.length * 28) }}>
                  <Bar data={makeDeptHorizontalBarData(utilityData.items, "Utility")} options={horizontalBarOptions} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <span className="text-2xl mb-1 opacity-40">📊</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering sistem utility belum terhubung</span>
              </div>
            )}
          </div>
        </section>

        {/* Utility Distribution Share Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">Utility Distribution Share</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Distribution breakdown of utility systems.</p>
          </div>
          <div className="my-4 flex justify-center flex-shrink-0">
            <DonutChart 
              segments={utilityDonutSegments.length > 0 ? utilityDonutSegments : [{ label: "Belum Ada Data", value: 100, color: "#cbd5e1" }]} 
              size={140} 
              thickness={16} 
              centerLabel={utilityData.totalKwh > 0 ? `${utilityData.totalKwh.toLocaleString("id-ID")} kWh` : "0 kWh"} 
              centerLabelSize="text-[10px]"
            />
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[140px] scrollbar-hide">
            {utilityDonutSegments.length > 0 ? (
              utilityDonutSegments.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{item.value}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">Belum ada data sub-metering utility.</div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════ ROW 3: HVAC DEPARTMENT ANALYSIS ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* HVAC Consumption - Horizontal Bar Chart Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#06b6d4] dark:text-cyan-400">HVAC Consumption</h3>
                {hvacData.totalKwh > 0 && (
                  <span className="text-xs font-extrabold font-mono text-[#06b6d4] dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                    Total: {hvacData.totalKwh.toLocaleString("id-ID")} kWh
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">HVAC electricity consumption sorted by highest consumer.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={hvacFilter}
                onChange={(e) => setHvacFilter(e.target.value as any)}
                className="px-2.5 py-1 text-xs rounded border border-slate-350 bg-slate-50 text-slate-800 dark:bg-slate-850 dark:text-slate-200 dark:border-slate-700 font-bold focus:outline-none cursor-pointer"
              >
                <option value="Fact 1">Fact 1 Only</option>
                <option value="Fact 2">Fact 2 Only</option>
              </select>
              {isSeniorUnitHead && (
                <button
                  type="button"
                  onClick={() => openSeniorConfigModal(hvacFilter === "Fact 1" ? "consumption_fact_1" : "consumption_fact_2", "HVAC")}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer"
                  title="Kelola Item HVAC (Senior Unit Head Only)"
                >
                  <IconSettings />
                  <span>⚙️ Kelola Item</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[250px]">
            {hvacData.items.length > 0 ? (
              <div className="overflow-y-auto max-h-[380px] pr-1.5">
                <div style={{ height: Math.max(250, hvacData.items.length * 28) }}>
                  <Bar data={makeDeptHorizontalBarData(hvacData.items, "HVAC")} options={horizontalBarOptions} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <span className="text-2xl mb-1 opacity-40">📊</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Data Belum Tersedia</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sub-metering sistem HVAC belum terhubung</span>
              </div>
            )}
          </div>
        </section>

        {/* HVAC Distribution Share Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#06b6d4] dark:text-cyan-400">HVAC Distribution Share</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Distribution breakdown of HVAC systems.</p>
          </div>
          <div className="my-4 flex justify-center flex-shrink-0">
            <DonutChart 
              segments={hvacDonutSegments.length > 0 ? hvacDonutSegments : [{ label: "Belum Ada Data", value: 100, color: "#cbd5e1" }]} 
              size={140} 
              thickness={16} 
              centerLabel={hvacData.totalKwh > 0 ? `${hvacData.totalKwh.toLocaleString("id-ID")} kWh` : "0 kWh"} 
              centerLabelSize="text-[10px]"
            />
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[140px] scrollbar-hide">
            {hvacDonutSegments.length > 0 ? (
              hvacDonutSegments.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{item.value}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">Belum ada data sub-metering HVAC.</div>
            )}
          </div>
        </section>
      </div>


      {/* ═══════════ SECTION H: EQUIPMENT MONTHLY CHARTS ═══════════ */}
      {(() => {
        const equipNow = new Date();
        const equipCurrentMonthIdx = equipNow.getMonth();
        const equipCurrentYear = equipNow.getFullYear();

        return (
          <SectionHEquipment
            isDark={isDark}
            currentMonthIdx={equipCurrentMonthIdx}
            currentYear={equipCurrentYear}
            onBatchDataLoaded={handleEquipmentBatchLoaded}
          />
        );
      })()}

      {/* ═══════════ CONFIGURATION PANEL (API Sources) ═══════════ */}
      {canAccessConfig && showConfigPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfigPanel(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-white">Konfigurasi Electricity Dashboard</h3>
                <p className="text-xs text-slate-400 mt-0.5">Kelola API Sources dan Chart Data Sources untuk halaman Electricity.</p>
              </div>
              <button onClick={() => setShowConfigPanel(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            {/* API Sources for Electricity */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">🔌 API Sources - General (Solar & Genset)</h4>
              <ApiSourcesPanel unitId="electricity" />
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">🔌 API Sources - PLN Cubicle (PM8000)</h4>
              <ApiSourcesPanel unitId="Cubicle_PLN_PM8000" />
            </div>
          </div>
        </div>
      )}

      {/* Electricity Export Excel Modal */}
      <ErrorBoundary>
        <ElectricityExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          isDark={isDark}
        />
      </ErrorBoundary>

      {/* Senior Unit Head Item Configuration Modal */}
      {isSeniorUnitHead && (
        <SeniorUnitHeadConfigModal
          isOpen={showSeniorConfigModal}
          onClose={() => setShowSeniorConfigModal(false)}
          isDark={isDark}
          fact1Items={factCategories1}
          fact2Items={factCategories2}
          onRefresh={refreshFactCategories}
          initialFact={seniorModalFact}
          initialDept={seniorModalDept}
        />
      )}
    </div>
  );
}
