import React, { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { usePageActive } from "../../hooks/usePageActive";
import { PageHeader } from "../../components/ui/PageHeader";
import { Line, Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { useSystemStore } from "../../store/system.store";
import { getJson, postJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { useAuthStore } from "../../store/auth.store";
import { canAccessConfigAndAudit, isSeniorUnitHeadOrAdmin } from "../../utils/roles";
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

function mapPmToTransformer(
  initialTx: TransformerData,
  pm?: ElectricPmItem,
  incomingKv: number | null = null
): TransformerData {
  if (!pm) return initialTx;

  const rawActive = pm.active_power_total !== null && pm.active_power_total !== undefined && !isNaN(Number(pm.active_power_total))
    ? Number(Number(pm.active_power_total).toFixed(1))
    : null;
  const activePowerKw = (rawActive !== null && (rawActive > 0 || initialTx.activePowerKw === null))
    ? rawActive
    : initialTx.activePowerKw;

  const rawReactive = pm.reactive_power_total !== null && pm.reactive_power_total !== undefined && !isNaN(Number(pm.reactive_power_total))
    ? Number(Number(pm.reactive_power_total).toFixed(1))
    : null;
  const reactivePowerKvar = rawReactive !== null ? rawReactive : initialTx.reactivePowerKvar;

  const rawApparent = pm.apparent_power_total !== null && pm.apparent_power_total !== undefined && !isNaN(Number(pm.apparent_power_total))
    ? Number(Number(pm.apparent_power_total).toFixed(1))
    : null;
  const apparentPowerKva = rawApparent !== null ? rawApparent : initialTx.apparentPowerKva;

  const rawPf = pm.power_factor !== null && pm.power_factor !== undefined && !isNaN(Number(pm.power_factor))
    ? Number(pm.power_factor)
    : null;
  const powerFactor = rawPf !== null ? Math.min(1.0, Math.abs(rawPf)) : initialTx.powerFactor;

  const rawFreq = pm.frequency !== null && pm.frequency !== undefined && !isNaN(Number(pm.frequency))
    ? Number(Number(pm.frequency).toFixed(2))
    : null;
  const frequencyHz = (rawFreq !== null && rawFreq > 0) ? rawFreq : initialTx.frequencyHz;

  const vAb = pm.volt_ab !== null && pm.volt_ab !== undefined && !isNaN(Number(pm.volt_ab)) ? Number(pm.volt_ab) : null;
  const vBc = pm.volt_bc !== null && pm.volt_bc !== undefined && !isNaN(Number(pm.volt_bc)) ? Number(pm.volt_bc) : null;
  const vCa = pm.volt_ca !== null && pm.volt_ca !== undefined && !isNaN(Number(pm.volt_ca)) ? Number(pm.volt_ca) : null;

  let voltageOutL2L: number | null = null;
  if (vAb && vBc && vCa && vAb > 0 && vBc > 0 && vCa > 0) {
    voltageOutL2L = Number(((vAb + vBc + vCa) / 3).toFixed(1));
  } else if (pm.volt_ll !== null && pm.volt_ll !== undefined && Number(pm.volt_ll) > 0) {
    voltageOutL2L = Number(Number(pm.volt_ll).toFixed(1));
  } else if (vAb && vAb > 0) {
    voltageOutL2L = Number(vAb.toFixed(1));
  }
  if (voltageOutL2L === null || voltageOutL2L === 0) {
    voltageOutL2L = initialTx.voltageOutL2L;
  }

  const voltageOutL2N = voltageOutL2L ? Number((voltageOutL2L / Math.sqrt(3)).toFixed(1)) : initialTx.voltageOutL2N;

  const curA = pm.current_a !== null && pm.current_a !== undefined && !isNaN(Number(pm.current_a)) ? Number(Number(pm.current_a).toFixed(1)) : null;
  const curB = pm.current_b !== null && pm.current_b !== undefined && !isNaN(Number(pm.current_b)) ? Number(Number(pm.current_b).toFixed(1)) : null;
  const curC = pm.current_c !== null && pm.current_c !== undefined && !isNaN(Number(pm.current_c)) ? Number(Number(pm.current_c).toFixed(1)) : null;

  const currentR = curA !== null ? curA : initialTx.currentR;
  const currentS = curB !== null ? curB : initialTx.currentS;
  const currentT = curC !== null ? curC : initialTx.currentT;

  const thdVa = pm.thd_volt_a !== null && pm.thd_volt_a !== undefined && !isNaN(Number(pm.thd_volt_a)) ? Number(pm.thd_volt_a) : null;
  const thdVb = pm.thd_volt_b !== null && pm.thd_volt_b !== undefined && !isNaN(Number(pm.thd_volt_b)) ? Number(pm.thd_volt_b) : null;
  const thdVc = pm.thd_volt_c !== null && pm.thd_volt_c !== undefined && !isNaN(Number(pm.thd_volt_c)) ? Number(pm.thd_volt_c) : null;

  let thdVoltage: number | null = null;
  const validThdVs = [thdVa, thdVb, thdVc].filter((v): v is number => v !== null && v >= 0 && v < 50);
  if (validThdVs.length > 0) {
    thdVoltage = Number((validThdVs.reduce((a, b) => a + b, 0) / validThdVs.length).toFixed(2));
  } else {
    thdVoltage = initialTx.thdVoltage;
  }

  const thdIa = pm.thd_current_a !== null && pm.thd_current_a !== undefined && !isNaN(Number(pm.thd_current_a)) ? Number(pm.thd_current_a) : null;
  const thdIb = pm.thd_current_b !== null && pm.thd_current_b !== undefined && !isNaN(Number(pm.thd_current_b)) ? Number(pm.thd_current_b) : null;
  const thdIc = pm.thd_current_c !== null && pm.thd_current_c !== undefined && !isNaN(Number(pm.thd_current_c)) ? Number(pm.thd_current_c) : null;

  let thdCurrent: number | null = null;
  const validThdIs = [thdIa, thdIb, thdIc].filter((v): v is number => v !== null && v >= 0 && v < 50);
  if (validThdIs.length > 0) {
    thdCurrent = Number((validThdIs.reduce((a, b) => a + b, 0) / validThdIs.length).toFixed(2));
  } else {
    thdCurrent = initialTx.thdCurrent;
  }

  let vUnb = pm.voltage_unbalance !== null && pm.voltage_unbalance !== undefined && !isNaN(Number(pm.voltage_unbalance)) ? Number(pm.voltage_unbalance) : null;
  if (vUnb === null && vAb && vBc && vCa && voltageOutL2L) {
    const maxDev = Math.max(Math.abs(vAb - voltageOutL2L), Math.abs(vBc - voltageOutL2L), Math.abs(vCa - voltageOutL2L));
    vUnb = Number(((maxDev / voltageOutL2L) * 100).toFixed(2));
  }
  if (vUnb === null) vUnb = initialTx.voltageUnbalance ?? null;

  let iUnb = pm.current_unbalance !== null && pm.current_unbalance !== undefined && !isNaN(Number(pm.current_unbalance)) ? Number(pm.current_unbalance) : null;
  if (iUnb === null && currentR && currentS && currentT) {
    const avgI = (currentR + currentS + currentT) / 3;
    if (avgI > 0) {
      const maxDevI = Math.max(Math.abs(currentR - avgI), Math.abs(currentS - avgI), Math.abs(currentT - avgI));
      iUnb = Number(((maxDevI / avgI) * 100).toFixed(2));
    }
  }
  if (iUnb === null) iUnb = initialTx.currentUnbalance ?? null;

  const rawKwh = pm.active_energy !== null && pm.active_energy !== undefined && !isNaN(Number(pm.active_energy))
    ? Number(Number(pm.active_energy).toFixed(0))
    : null;
  const kwh = rawKwh !== null && rawKwh > 0 ? rawKwh : initialTx.kwh;

  const isOnline = pm.status !== null && pm.status !== undefined
    ? Boolean(pm.status)
    : ((activePowerKw !== null && activePowerKw !== undefined) || (voltageOutL2L !== null && voltageOutL2L > 100));

  const resolvedIncomingKv = incomingKv ?? initialTx.voltageInKv;

  return {
    ...initialTx,
    activePowerKw,
    reactivePowerKvar,
    apparentPowerKva,
    powerFactor,
    frequencyHz,
    voltageInKv: resolvedIncomingKv,
    voltageOutL2L,
    voltageOutL2N,
    voltAb: vAb ?? initialTx.voltAb,
    voltBc: vBc ?? initialTx.voltBc,
    voltCa: vCa ?? initialTx.voltCa,
    currentR,
    currentS,
    currentT,
    thdVoltage,
    thdCurrent,
    thdVoltA: thdVa && thdVa < 50 ? thdVa : (thdVoltage ?? initialTx.thdVoltA),
    thdVoltB: thdVb && thdVb < 50 ? thdVb : (thdVoltage ?? initialTx.thdVoltB),
    thdVoltC: thdVc && thdVc < 50 ? thdVc : (thdVoltage ?? initialTx.thdVoltC),
    thdCurrentA: thdIa && thdIa < 50 ? thdIa : (thdCurrent ?? initialTx.thdCurrentA),
    thdCurrentB: thdIb && thdIb < 50 ? thdIb : (thdCurrent ?? initialTx.thdCurrentB),
    thdCurrentC: thdIc && thdIc < 50 ? thdIc : (thdCurrent ?? initialTx.thdCurrentC),
    voltageUnbalance: vUnb,
    currentUnbalance: iUnb,
    tempCc: null, // No physical temperature sensors installed on transformers
    kwh,
    status: isOnline ? "online" : "offline",
  };
}

function isTransformerEqual(a: TransformerData, b: TransformerData): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.factory === b.factory &&
    a.capacityKva === b.capacityKva &&
    a.activePowerKw === b.activePowerKw &&
    a.reactivePowerKvar === b.reactivePowerKvar &&
    a.apparentPowerKva === b.apparentPowerKva &&
    a.powerFactor === b.powerFactor &&
    a.frequencyHz === b.frequencyHz &&
    a.voltageInKv === b.voltageInKv &&
    a.voltageOutL2L === b.voltageOutL2L &&
    a.voltageOutL2N === b.voltageOutL2N &&
    a.voltAb === b.voltAb &&
    a.voltBc === b.voltBc &&
    a.voltCa === b.voltCa &&
    a.currentR === b.currentR &&
    a.currentS === b.currentS &&
    a.currentT === b.currentT &&
    a.thdVoltage === b.thdVoltage &&
    a.thdCurrent === b.thdCurrent &&
    a.thdVoltA === b.thdVoltA &&
    a.thdVoltB === b.thdVoltB &&
    a.thdVoltC === b.thdVoltC &&
    a.thdCurrentA === b.thdCurrentA &&
    a.thdCurrentB === b.thdCurrentB &&
    a.thdCurrentC === b.thdCurrentC &&
    a.voltageUnbalance === b.voltageUnbalance &&
    a.currentUnbalance === b.currentUnbalance &&
    a.kwh === b.kwh &&
    a.status === b.status &&
    a.vectorGroup === b.vectorGroup &&
    a.impedance === b.impedance &&
    a.year === b.year &&
    a.manufacturer === b.manufacturer
  );
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
    { key: "ampere" as const, label: "Ampere Record (Total & 3 Fasa)" },
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
  const [modalTickMs, setModalTickMs] = useState<number>(() => Math.floor(Date.now() / 3000) * 3000);
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
        const tuples = res?.tuples;
        if (Array.isArray(tuples) && tuples.length > 0) {
          const n = tuples.length;
          const vAb = new Array(n);
          const vBc = new Array(n);
          const vCa = new Array(n);
          const vRn = new Array(n);
          const vSn = new Array(n);
          const vTn = new Array(n);
          const kw = new Array(n);
          const iTot = new Array(n);
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
            vRn[i] = { x, y: Number((v1 / 1.7320508).toFixed(1)) };
            vSn[i] = { x, y: Number((v2 / 1.7320508).toFixed(1)) };
            vTn[i] = { x, y: Number((v3 / 1.7320508).toFixed(1)) };
            kw[i] = { x, y: p };
            iR[i] = { x, y: c1 };
            iS[i] = { x, y: c2 };
            iT[i] = { x, y: c3 };
            iTot[i] = { x, y: Number((c1 + c2 + c3).toFixed(1)) };
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
            vRn: Number((lv1 / 1.7320508).toFixed(1)),
            vSn: Number((lv2 / 1.7320508).toFixed(1)),
            vTn: Number((lv3 / 1.7320508).toFixed(1)),
            kw: Number(last[4]) || 0,
            iR: lc1, iS: lc2, iT: lc3,
            iTot: Number((lc1 + lc2 + lc3).toFixed(1))
          };
          setModalPointCount(n);
          setModalTickMs(Number(last[0]) || Math.floor(Date.now() / 3000) * 3000);
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
      const p = pm.active_power_total !== undefined && pm.active_power_total !== null ? Math.abs(Number(Number(pm.active_power_total).toFixed(2))) : 0;
      if (v1 <= 0 && p <= 0 && c1 <= 0) return;

      const s = modalSeriesRef.current;
      const lastX = s.vAb.length > 0 ? s.vAb[s.vAb.length - 1].x : 0;
      const rawX = Number(pm.ts) || fallbackTs || Date.now();
      if (rawX - lastX < 2500) return;
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
      pushAndShift(s.vRn, Number((v1 / 1.7320508).toFixed(1)));
      pushAndShift(s.vSn, Number((v2 / 1.7320508).toFixed(1)));
      pushAndShift(s.vTn, Number((v3 / 1.7320508).toFixed(1)));
      pushAndShift(s.kw, p);
      pushAndShift(s.iTot, Number((c1 + c2 + c3).toFixed(1)));
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
            label: "Ampere Total (A)",
            data: s.iTot,
            borderColor: "#8b5cf6",
            backgroundColor: "transparent",
            borderWidth: 1.8,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
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
              {loadingModalHistory ? (
                <div className="flex-1 flex items-center justify-center text-xs text-sky-500 font-bold gap-2">
                  <span className="animate-spin">⏳</span> Memuat riwayat telemetri...
                </div>
              ) : modalPointCount > 0 ? (
                <div className="w-full h-full min-h-[240px]">
                  <Line data={chartData} options={modalChartOptions} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA HISTORIS BELUM TERSEDIA</span>
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
const TransformerDetailCard = React.memo(
  function TransformerDetailCard({
    tx,
    factoryLabel,
    loadConfig,
    isEditMode,
    onMoveLeft,
    onMoveRight,
    onDragStart,
    onDragOver,
    onDrop
  }: {
    tx: TransformerData;
    factoryLabel: string;
    loadConfig: { safeMax: number; cautionMax: number };
    isEditMode?: boolean;
    onMoveLeft?: () => void;
    onMoveRight?: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: () => void;
  }) {
    const hasData = tx.activePowerKw !== null && tx.activePowerKw !== undefined;
    const loadPct = hasData && tx.capacityKva && tx.activePowerKw !== null ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null;
    
    // Dynamic load colors based on Postgres threshold configs
    const loadColor = loadPct !== null 
      ? (loadPct <= loadConfig.safeMax ? "#10b981" : loadPct <= loadConfig.cautionMax ? "#eab308" : "#ef4444")
      : "#94a3b8";

    // Voltages per phase for display
    const vR_400 = tx.voltAb !== null && tx.voltAb !== undefined ? `${tx.voltAb.toFixed(1)}` : (tx.voltageOutL2L !== null ? `${tx.voltageOutL2L.toFixed(1)}` : "—");
    const vS_400 = tx.voltBc !== null && tx.voltBc !== undefined ? `${tx.voltBc.toFixed(1)}` : (tx.voltageOutL2L !== null ? `${tx.voltageOutL2L.toFixed(1)}` : "—");
    const vT_400 = tx.voltCa !== null && tx.voltCa !== undefined ? `${tx.voltCa.toFixed(1)}` : (tx.voltageOutL2L !== null ? `${tx.voltageOutL2L.toFixed(1)}` : "—");

    const vR_230 = tx.voltAb ? `${(tx.voltAb / Math.sqrt(3)).toFixed(1)}` : (tx.voltageOutL2N !== null ? `${tx.voltageOutL2N.toFixed(1)}` : "—");
    const vS_230 = tx.voltBc ? `${(tx.voltBc / Math.sqrt(3)).toFixed(1)}` : (tx.voltageOutL2N !== null ? `${tx.voltageOutL2N.toFixed(1)}` : "—");
    const vT_230 = tx.voltCa ? `${(tx.voltCa / Math.sqrt(3)).toFixed(1)}` : (tx.voltageOutL2N !== null ? `${tx.voltageOutL2N.toFixed(1)}` : "—");

    // THD per phase
    const thdv_R = tx.thdVoltA !== null && tx.thdVoltA !== undefined ? tx.thdVoltA.toFixed(2) : (tx.thdVoltage !== null ? tx.thdVoltage.toFixed(2) : "—");
    const thdv_S = tx.thdVoltB !== null && tx.thdVoltB !== undefined ? tx.thdVoltB.toFixed(2) : (tx.thdVoltage !== null ? tx.thdVoltage.toFixed(2) : "—");
    const thdv_T = tx.thdVoltC !== null && tx.thdVoltC !== undefined ? tx.thdVoltC.toFixed(2) : (tx.thdVoltage !== null ? tx.thdVoltage.toFixed(2) : "—");

    const thdi_R = tx.thdCurrentA !== null && tx.thdCurrentA !== undefined ? tx.thdCurrentA.toFixed(2) : (tx.thdCurrent !== null ? tx.thdCurrent.toFixed(2) : "—");
    const thdi_S = tx.thdCurrentB !== null && tx.thdCurrentB !== undefined ? tx.thdCurrentB.toFixed(2) : (tx.thdCurrent !== null ? tx.thdCurrent.toFixed(2) : "—");
    const thdi_T = tx.thdCurrentC !== null && tx.thdCurrentC !== undefined ? tx.thdCurrentC.toFixed(2) : (tx.thdCurrent !== null ? tx.thdCurrent.toFixed(2) : "—");

    return (
      <div
        draggable={isEditMode}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`rounded-2xl border transition-shadow duration-150 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative ${
          isEditMode
            ? "ring-2 ring-sky-500/50 border-sky-400 shadow-lg cursor-grab active:cursor-grabbing hover:scale-[1.01]"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        {/* Card Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="rounded-full"
              style={{
                width: 9, height: 9,
                backgroundColor: hasData ? (tx.status === "online" ? "#10b981" : "#f59e0b") : "#94a3b8",
                boxShadow: hasData ? "0 0 6px #10b981" : "none",
              }}
            />
            <span className="text-base font-black text-slate-800 dark:text-white tracking-wide">{tx.name}</span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-sky-500/10 text-sky-500 border border-sky-500/20 uppercase tracking-wider">
              {factoryLabel} — {tx.capacityKva} kVA
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isEditMode ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm select-none">
                <span>⋮⋮</span>
                <span>Pindahkan</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">LOAD</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800"
                    style={{ width: 70, height: 8 }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{ width: `${loadPct ? Math.min(100, loadPct) : 0}%`, backgroundColor: loadColor }}
                    />
                  </div>
                  <span className="text-xs font-black font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {loadPct !== null ? `${loadPct}%` : "—%"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Parameters Grid */}
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4.5">
            <ParamCell label="Input Voltage" value={tx.voltageInKv !== null ? `${tx.voltageInKv.toFixed(2)} kV` : "—"} />
            <ParamCell label="Output Volt 400V" value={tx.voltageOutL2L !== null ? `R:${vR_400} S:${vS_400} T:${vT_400} V` : "R: —  S: —  T: — V"} />
            <ParamCell label="Output Volt 230V" value={tx.voltageOutL2N !== null ? `R:${vR_230} S:${vS_230} T:${vT_230} V` : "R: —  S: —  T: — V"} />
            
            <ParamCell label="Active Power" value={tx.activePowerKw !== null ? `${tx.activePowerKw} kW` : "—"} accent={hasData} />
            <ParamCell label="Reactive Power" value={tx.reactivePowerKvar !== null ? `${tx.reactivePowerKvar} kVAR` : "—"} />
            <ParamCell label="Apparent Power" value={tx.apparentPowerKva !== null ? `${tx.apparentPowerKva} kVA` : "—"} />
            
            <ParamCell label="Power Factor" value={tx.powerFactor !== null ? Math.abs(tx.powerFactor).toFixed(3) : "—"} />
            <ParamCell label="Frequency" value={tx.frequencyHz !== null ? `${tx.frequencyHz.toFixed(2)} Hz` : "—"} />
            <ParamCell label="Temperature" value={tx.tempCc !== null ? `${tx.tempCc.toFixed(1)} °C` : "—"} warn={tx.tempCc !== null && tx.tempCc > 60} />

            <ParamCell label="Impedance" value={`${tx.impedance ?? 4.5} %`} />
            <ParamCell label="Vector Group" value={tx.vectorGroup ?? "Dyn11"} />
            <ParamCell label="Mfg / Year" value={`${tx.manufacturer ?? "Schneider"} (${tx.year ?? "2021"})`} />
          </div>

          {/* Current & THD Section */}
          <div
            className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-3"
          >
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider">Arus Per Fasa (A)</span>
              <div className="font-mono tabular-nums font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                R: <span className="font-black text-rose-500 mr-2">{tx.currentR !== null ? Math.round(tx.currentR) : "—"}</span>
                S: <span className="font-black text-amber-500 mr-2">{tx.currentS !== null ? Math.round(tx.currentS) : "—"}</span>
                T: <span className="font-black text-blue-500">{tx.currentT !== null ? Math.round(tx.currentT) : "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
              <div>
                <span className="text-[11px] text-slate-400 uppercase block font-black tracking-wider mb-1">THDV Per Fasa (%)</span>
                <div className="font-mono tabular-nums font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                  R:<span className="mr-1.5">{thdv_R}</span>
                  S:<span className="mr-1.5">{thdv_S}</span>
                  T:<span>{thdv_T}</span>
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase block font-black tracking-wider mb-1">THDi Per Fasa (%)</span>
                <div className="font-mono tabular-nums font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                  R:<span className="mr-1.5">{thdi_R}</span>
                  S:<span className="mr-1.5">{thdi_S}</span>
                  T:<span>{thdi_T}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-bold text-slate-500">
              <div>
                <span>Voltage Unbalanced: </span>
                <span className="text-slate-700 dark:text-slate-200 font-mono tabular-nums font-black text-xs sm:text-sm ml-1">
                  {tx.voltageUnbalance !== null && tx.voltageUnbalance !== undefined ? `${tx.voltageUnbalance.toFixed(2)} %` : "—"}
                </span>
              </div>
              <div>
                <span>Current Unbalanced: </span>
                <span className="text-slate-700 dark:text-slate-200 font-mono tabular-nums font-black text-xs sm:text-sm ml-1">
                  {tx.currentUnbalance !== null && tx.currentUnbalance !== undefined ? `${tx.currentUnbalance.toFixed(2)} %` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Cost & kWh */}
          <div
            className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center"
          >
            <div>
              <span className="text-[11px] text-slate-400 uppercase block font-black tracking-wider mb-0.5">Total Konsumsi</span>
              <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white font-mono tabular-nums">
                {tx.kwh !== null ? tx.kwh.toLocaleString("id-ID") : "—"} <span className="text-xs text-slate-400 font-bold">kWh</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase block font-black tracking-wider mb-0.5">Estimasi Cost</span>
              <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white font-mono tabular-nums">
                {tx.kwh !== null ? formatCurrencyIDR(tx.kwh * TARIF_PER_KWH) : "Rp —"}
              </span>
            </div>
          </div>

          {/* Edit Mode Direction Controls */}
          {isEditMode && (
            <div className="mt-4 pt-3 border-t border-sky-200 dark:border-sky-800/50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onMoveLeft}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
                title="Geser posisi kartu ke kiri"
              >
                <span>◀</span>
                <span>Geser Kiri</span>
              </button>
              <span className="text-[10px] text-sky-500 font-bold">Atur Posisi Aktif</span>
              <button
                type="button"
                onClick={onMoveRight}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
                title="Geser posisi kartu ke kanan"
              >
                <span>Geser Kanan</span>
                <span>▶</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      isTransformerEqual(prev.tx, next.tx) &&
      prev.factoryLabel === next.factoryLabel &&
      prev.isEditMode === next.isEditMode &&
      prev.loadConfig.safeMax === next.loadConfig.safeMax &&
      prev.loadConfig.cautionMax === next.loadConfig.cautionMax
    );
  }
);

const ParamCell = React.memo(function ParamCell({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
        {label}
      </span>
      <span className={`font-black font-mono tabular-nums text-xs sm:text-sm ${
        accent ? "text-emerald-500" :
        warn ? "text-amber-500" :
        "text-slate-800 dark:text-slate-100"
      }`}>
        {value}
      </span>
    </div>
  );
});

/* ═══════════ SLD SCALED CANVAS (RESPONSIVE) ═══════════ */
const SLD_DESIGN_W = 1200;
const SLD_DESIGN_H = 620;

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
      // Responsive scale: fits cleanly on desktop (scale >= 1), and on mobile/tablets caps minimum scale at 0.78 so text stays large and readable with horizontal scroll
      const calculatedScale = availableWidth >= SLD_DESIGN_W ? availableWidth / SLD_DESIGN_W : Math.max(availableWidth / SLD_DESIGN_W, 0.78);
      setScale(calculatedScale);
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

  const scaledWidth = Math.max(SLD_DESIGN_W * scale + 32, 300);
  const scaledHeight = SLD_DESIGN_H * scale + 36;

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
      <div 
        ref={containerRef} 
        style={{ 
          minWidth: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
          padding: "16px", 
          boxSizing: "border-box",
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
            PF: <span className="font-mono text-slate-400">{tx.powerFactor !== null ? tx.powerFactor.toFixed(3) : "—"}</span>
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

/* ═══════════ SLD TRANSFORMER CARD COMPONENT (MEMOIZED) ═══════════ */
const SldTransformerCard = React.memo(
  function SldTransformerCard({
    tx,
    isFirst,
    isDark,
    loadingSld,
    onClick,
    cardLeft,
    width = 100,
  }: {
    tx: TransformerData;
    isFirst: boolean;
    isDark: boolean;
    loadingSld: boolean;
    onClick: () => void;
    cardLeft: number;
    width?: number;
  }) {
    const hasData = tx.activePowerKw !== null && tx.activePowerKw !== undefined;
    const loadPct = hasData && tx.capacityKva && tx.activePowerKw !== null ? Math.round((tx.activePowerKw / tx.capacityKva) * 100) : null;

    return (
      <div className="absolute z-10" style={{ left: cardLeft, top: 358, width }}>
        <div
          onClick={onClick}
          className={`rounded-2xl border p-2.5 text-center cursor-pointer transition-shadow duration-150 hover:shadow-lg ${
            isFirst
              ? "bg-slate-900 border-slate-700 text-white"
              : isDark
                ? "bg-slate-800/90 border-slate-700 text-slate-200"
                : "bg-slate-100/95 border-slate-300 text-slate-800"
          }`}
        >
          <div className={`text-xs font-black ${isFirst ? "text-slate-200" : "text-slate-800 dark:text-white"}`}>
            {tx.capacityKva} kVA
          </div>
          <div className={`text-[10px] font-black tracking-wider uppercase ${isFirst ? "text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
            {tx.name}
          </div>
          <div className="mt-1 text-[9px] text-slate-400 font-bold uppercase">Active Power</div>
          {loadingSld ? (
            <div className="my-1 space-y-1">
              <div className="h-3.5 w-16 bg-slate-300 dark:bg-slate-700 rounded mx-auto" />
              <div className="h-2 w-10 bg-slate-300 dark:bg-slate-700 rounded mx-auto" />
            </div>
          ) : (
            <>
              <div className={`text-xs font-black font-mono tabular-nums ${hasData ? (isFirst ? "text-sky-400" : "text-slate-800 dark:text-slate-100") : "text-slate-400"}`}>
                {hasData ? `${tx.activePowerKw} kW` : "— kW"}
              </div>
              <div className="text-[9px] text-slate-400 font-bold">
                PF: <span className="font-black font-mono tabular-nums">{tx.powerFactor !== null ? Math.abs(tx.powerFactor).toFixed(3) : "—"}</span>
              </div>
            </>
          )}
          
          {/* Load progress bar */}
          <div className="mt-1.5 pt-1 border-t border-slate-200 dark:border-slate-700/60">
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ease-out ${loadingSld ? "bg-slate-300 dark:bg-slate-500 w-1/3" : "bg-slate-300 dark:bg-slate-600"}`}
                style={{ width: loadingSld ? "33%" : `${loadPct ? Math.min(100, loadPct) : 0}%` }}
              />
            </div>
            <div className="text-[8.5px] font-black text-center mt-0.5 text-slate-400 font-mono tabular-nums">
              {loadingSld ? "..." : (loadPct !== null ? `${loadPct}%` : "—%")}
            </div>
          </div>
        </div>

        {/* 400V/230V Label Box */}
        <div className="mt-1 text-center py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200/90 dark:bg-slate-800 text-[9px] font-black text-slate-700 dark:text-slate-300 tracking-wider">
          400V / 230V
        </div>

        {/* Detail Button */}
        <button
          onClick={onClick}
          className="w-full mt-1 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200 hover:bg-sky-500 hover:text-white dark:bg-slate-700 dark:hover:bg-sky-600 text-[10px] font-black text-slate-700 dark:text-slate-200 transition-colors shadow-sm cursor-pointer"
        >
          Detail
        </button>
      </div>
    );
  },
  (prev, next) => {
    return (
      isTransformerEqual(prev.tx, next.tx) &&
      prev.isFirst === next.isFirst &&
      prev.isDark === next.isDark &&
      prev.loadingSld === next.loadingSld &&
      prev.cardLeft === next.cardLeft &&
      prev.width === next.width
    );
  }
);

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

  const toKv = (v: number | null | undefined): number | null => {
    if (v === null || v === undefined || isNaN(Number(v))) return null;
    const num = Number(v);
    return num > 100 ? Number((num / 1000).toFixed(2)) : Number(num.toFixed(2));
  };

  const safeActivePower = (val: any, prev: number | null): number | null => {
    if (val === undefined || val === null || isNaN(Number(val))) return prev;
    const num = Number(val);
    if (num === 0 && prev !== null && prev > 0) return prev;
    if (num > 0 && num < 1.0 && prev !== null && prev > 10.0) {
      return Number((num * 1000).toFixed(1));
    }
    return Number(num.toFixed(1));
  };

  const safePf = (val: any, prev: number | null): number | null => {
    if (val === undefined || val === null || isNaN(Number(val))) return prev;
    const num = Math.abs(Number(val));
    if (num === 0 && prev !== null && prev > 0) return prev;
    return Number(Math.min(1.0, num).toFixed(3));
  };

  const safeVolt = (val: number | null, prev: number | null): number | null => {
    if (val === null || val === undefined || isNaN(val) || val <= 0) return prev;
    return val;
  };

  const isIncomingEqual = (
    a: typeof incomingData,
    b: typeof incomingData
  ): boolean => {
    return (
      a.plnKw === b.plnKw &&
      a.plnPf === b.plnPf &&
      a.wf1Kw === b.wf1Kw &&
      a.wf1Pf === b.wf1Pf &&
      a.wf1Volt === b.wf1Volt &&
      a.wf2Kw === b.wf2Kw &&
      a.wf2Pf === b.wf2Pf &&
      a.wf2Volt === b.wf2Volt
    );
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
        setIncomingData(prev => {
          const next = {
            plnKw: plnRes?.data?.pqData?.activePower !== undefined ? safeActivePower(plnRes.data.pqData.activePower, prev.plnKw) : prev.plnKw,
            plnPf: plnRes?.data?.pqData?.pf !== undefined ? safePf(plnRes.data.pqData.pf, prev.plnPf) : prev.plnPf,
            wf1Kw: wf1Res?.data?.pqData?.activePower !== undefined ? safeActivePower(wf1Res.data.pqData.activePower, prev.wf1Kw) : prev.wf1Kw,
            wf1Pf: wf1Res?.data?.pqData?.pf !== undefined ? safePf(wf1Res.data.pqData.pf, prev.wf1Pf) : prev.wf1Pf,
            wf1Volt: safeVolt(toKv(wf1Res?.data?.pqData?.vll1 ?? wf1Res?.data?.pqData?.voltage), prev.wf1Volt),
            wf2Kw: wf2Res?.data?.pqData?.activePower !== undefined ? safeActivePower(wf2Res.data.pqData.activePower, prev.wf2Kw) : prev.wf2Kw,
            wf2Pf: wf2Res?.data?.pqData?.pf !== undefined ? safePf(wf2Res.data.pqData.pf, prev.wf2Pf) : prev.wf2Pf,
            wf2Volt: safeVolt(toKv(wf2Res?.data?.pqData?.vll1 ?? wf2Res?.data?.pqData?.voltage), prev.wf2Volt),
          };
          return isIncomingEqual(prev, next) ? prev : next;
        });
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
        const next = { ...prev };
        if (payload.deviceId === "Cubicle_PLN_PM8000") {
          next.plnKw = safeActivePower(payload.pqData.activePower, prev.plnKw);
          next.plnPf = safePf(payload.pqData.pf, prev.plnPf);
        } else if (payload.deviceId === "Feeder_WF1_PM5560") {
          next.wf1Kw = safeActivePower(payload.pqData.activePower, prev.wf1Kw);
          next.wf1Pf = safePf(payload.pqData.pf, prev.wf1Pf);
          next.wf1Volt = safeVolt(toKv(payload.pqData.vll1 ?? payload.pqData.voltage), prev.wf1Volt);
        } else if (payload.deviceId === "Feeder_WF2_PM5500") {
          next.wf2Kw = safeActivePower(payload.pqData.activePower, prev.wf2Kw);
          next.wf2Pf = safePf(payload.pqData.pf, prev.wf2Pf);
          next.wf2Volt = safeVolt(toKv(payload.pqData.vll1 ?? payload.pqData.voltage), prev.wf2Volt);
        }
        return isIncomingEqual(prev, next) ? prev : next;
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

  const isSolarEqual = (
    a: typeof solarData,
    b: typeof solarData
  ): boolean => {
    return (
      a.poi1Kw === b.poi1Kw &&
      a.poi1Pf === b.poi1Pf &&
      a.poi2Kw === b.poi2Kw &&
      a.poi2Pf === b.poi2Pf
    );
  };

  // Fetch solar telemetries for SLD
  useEffect(() => {
    if (!isPageActive) return;
    const fetchSolar = () => {
      getJson<{ data: any }>("/analytics/solar/latest")
        .then((res) => {
          if (res?.data) {
            setSolarData(prev => {
              const next = {
                poi1Kw: res.data.poi1?.activePower !== undefined ? safeActivePower(res.data.poi1.activePower, prev.poi1Kw) : prev.poi1Kw,
                poi1Pf: res.data.poi1?.powerFactor !== undefined ? safePf(res.data.poi1.powerFactor, prev.poi1Pf) : prev.poi1Pf,
                poi2Kw: res.data.poi2?.activePower !== undefined ? safeActivePower(res.data.poi2.activePower, prev.poi2Kw) : prev.poi2Kw,
                poi2Pf: res.data.poi2?.powerFactor !== undefined ? safePf(res.data.poi2.powerFactor, prev.poi2Pf) : prev.poi2Pf,
              };
              return isSolarEqual(prev, next) ? prev : next;
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
      setSolarData(prev => {
        const next = {
          poi1Kw: payload.poi1?.activePower !== undefined ? safeActivePower(payload.poi1.activePower, prev.poi1Kw) : prev.poi1Kw,
          poi1Pf: payload.poi1?.powerFactor !== undefined ? safePf(payload.poi1.powerFactor, prev.poi1Pf) : prev.poi1Pf,
          poi2Kw: payload.poi2?.activePower !== undefined ? safeActivePower(payload.poi2.activePower, prev.poi2Kw) : prev.poi2Kw,
          poi2Pf: payload.poi2?.powerFactor !== undefined ? safePf(payload.poi2.powerFactor, prev.poi2Pf) : prev.poi2Pf,
        };
        return isSolarEqual(prev, next) ? prev : next;
      });
    };

    socket.on("electricity:solar_live", handleSolarLive);
    socket.on("solar:live_update", handleSolarLive);

    return () => {
      clearInterval(interval);
      socket.off("electricity:solar_live", handleSolarLive);
      socket.off("solar:live_update", handleSolarLive);
    };
  }, [isPageActive]);

  // Sync transformer incoming voltage whenever wf1Volt or wf2Volt updates
  useEffect(() => {
    if (incomingData.wf1Volt === null && incomingData.wf2Volt === null) return;
    setTelemetryTransformers((prevTrafos) => {
      let anyChanged = false;
      const nextTrafos = prevTrafos.map((tx) => {
        const kv = tx.factory === 1 ? incomingData.wf1Volt : incomingData.wf2Volt;
        if (tx.voltageInKv === kv) return tx;
        anyChanged = true;
        return { ...tx, voltageInKv: kv };
      });
      return anyChanged ? nextTrafos : prevTrafos;
    });
  }, [incomingData.wf1Volt, incomingData.wf2Volt]);

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

          setTelemetryTransformers((prevTrafos) => {
            let anyChanged = false;
            const nextTrafos = prevTrafos.map((tx) => {
              const mapping = TRAFO_PM_MAP[tx.id];
              if (!mapping) return tx;
              const pmRecord = pmMap.get(mapping.pmId.toUpperCase());
              if (!pmRecord) return tx;
              const incomingKv = tx.factory === 1 ? incomingDataRef.current.wf1Volt : incomingDataRef.current.wf2Volt;
              const updated = mapPmToTransformer(tx, pmRecord, incomingKv);
              if (isTransformerEqual(tx, updated)) {
                return tx;
              }
              anyChanged = true;
              return updated;
            });
            return anyChanged ? nextTrafos : prevTrafos;
          });
          setLoadingSld(false);
        }
      } catch (err) {
        console.error("Failed to load transformer telemetries:", err);
      }
    };

    fetchTrafoTelemetries();
    const interval = setInterval(fetchTrafoTelemetries, 1000);

    const socket = getSocket();
    const handlePmUpdate = (payload: { groupId: string; data: ElectricPmItem[] }) => {
      if (!payload || !Array.isArray(payload.data)) return;
      setLoadingSld(false);
      const pmMap = new Map<string, ElectricPmItem>();
      payload.data.forEach((pm) => {
        if (pm.pm_id) {
          pmMap.set(String(pm.pm_id).toUpperCase(), pm);
        }
      });

      setTelemetryTransformers((prevTrafos) => {
        let anyChanged = false;
        const nextTrafos = prevTrafos.map((tx) => {
          const mapping = TRAFO_PM_MAP[tx.id];
          if (!mapping) return tx;
          const pmRecord = pmMap.get(mapping.pmId.toUpperCase());
          if (!pmRecord) return tx;
          const incomingKv = tx.factory === 1 ? incomingDataRef.current.wf1Volt : incomingDataRef.current.wf2Volt;
          const updated = mapPmToTransformer(tx, pmRecord, incomingKv);
          if (isTransformerEqual(tx, updated)) {
            return tx;
          }
          anyChanged = true;
          return updated;
        });
        return anyChanged ? nextTrafos : prevTrafos;
      });
    };

    socket.on("electricity:pm_live_update", handlePmUpdate);

    return () => {
      clearInterval(interval);
      socket.off("electricity:pm_live_update", handlePmUpdate);
    };
  }, [isPageActive]);

  // Sub-Distribution Power Meters (EW23, EW21, EW22)
  const [selectedEwGroup, setSelectedEwGroup] = useState<"ew23" | "ew21" | "ew22">("ew23");
  const [ewPowerMeters, setEwPowerMeters] = useState<ElectricPmItem[]>([]);

  const updateEwPowerMetersList = (prev: ElectricPmItem[], incomingData: ElectricPmItem[]): ElectricPmItem[] => {
    if (prev.length === 0) {
      return [...incomingData].sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
    }
    const incMap = new Map<string, ElectricPmItem>();
    for (const item of incomingData) {
      if (item?.pm_id) incMap.set(item.pm_id.toUpperCase(), item);
    }
    let anyChanged = false;
    const nextList: ElectricPmItem[] = [];
    for (const p of prev) {
      if (!p?.pm_id) continue;
      const upId = p.pm_id.toUpperCase();
      const inc = incMap.get(upId);
      if (!inc) {
        nextList.push(p);
        continue;
      }
      const isSame = (
        p.active_power_total === inc.active_power_total &&
        p.power_factor === inc.power_factor &&
        p.volt_ab === inc.volt_ab &&
        p.current_a === inc.current_a &&
        p.current_b === inc.current_b &&
        p.current_c === inc.current_c &&
        p.active_energy === inc.active_energy &&
        p.status === inc.status
      );
      if (isSame) {
        nextList.push(p);
      } else {
        anyChanged = true;
        nextList.push({
          ...p,
          ...inc,
          active_power_total: inc.active_power_total !== undefined && inc.active_power_total !== null ? inc.active_power_total : p.active_power_total,
          power_factor: inc.power_factor !== undefined && inc.power_factor !== null ? inc.power_factor : p.power_factor,
          volt_ab: inc.volt_ab !== undefined && inc.volt_ab !== null ? inc.volt_ab : p.volt_ab,
          current_a: inc.current_a !== undefined && inc.current_a !== null ? inc.current_a : p.current_a,
          current_b: inc.current_b !== undefined && inc.current_b !== null ? inc.current_b : p.current_b,
          current_c: inc.current_c !== undefined && inc.current_c !== null ? inc.current_c : p.current_c,
          active_energy: inc.active_energy !== undefined && inc.active_energy !== null ? inc.active_energy : p.active_energy,
          status: inc.status !== undefined && inc.status !== null ? inc.status : p.status,
        });
      }
    }
    for (const inc of incomingData) {
      if (inc?.pm_id && !prev.some(p => p.pm_id?.toUpperCase() === inc.pm_id.toUpperCase())) {
        nextList.push(inc);
        anyChanged = true;
      }
    }
    if (!anyChanged) return prev;
    return nextList.sort((a, b) => getPmSortIndex(a.pm_id) - getPmSortIndex(b.pm_id));
  };

  // Fetch initial EW power meters and listen to live socket updates
  useEffect(() => {
    let active = true;
    const fetchPmData = () => {
      if (!isPageActive) return;
      getJson<{ data: ElectricPmItem[] }>(`/analytics/electricity/power-meters?group=${selectedEwGroup}&_t=${Date.now()}`)
        .then((res) => {
          if (active && res?.data && Array.isArray(res.data)) {
            setEwPowerMeters((prev) => updateEwPowerMetersList(prev, res.data));
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

      const filteredData = payload.data.filter((incoming) => {
        if (!incoming?.pm_id) return false;
        if (targetGroup === "custom_pm" && incoming.group_id && incoming.group_id.toLowerCase() !== selectedEwGroup) {
          return false;
        }
        return true;
      });

      setEwPowerMeters((prev) => updateEwPowerMetersList(prev, filteredData));
    };

    socket.on(`electricity:${selectedEwGroup}_live`, handleLiveUpdate);
    socket.on("electricity:custom_pm_live", handleLiveUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off(`electricity:${selectedEwGroup}_live`, handleLiveUpdate);
      socket.off("electricity:custom_pm_live", handleLiveUpdate);
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
  const canEditPosition = isSeniorUnitHeadOrAdmin(role);

  // Detail Transformator Custom Order State (Senior Unit Head & Admin)
  const [isEditingTrafoPos, setIsEditingTrafoPos] = useState(false);
  const [trafoOrderIds, setTrafoOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("scada_trafo_detail_order_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_TRANSFORMERS.map((t) => t.id);
  });
  const [draftTrafoOrderIds, setDraftTrafoOrderIds] = useState<string[]>([]);
  const [trafoToast, setTrafoToast] = useState<string | null>(null);
  const [draggedTrafoId, setDraggedTrafoId] = useState<string | null>(null);

  const handleStartEditTrafoPos = () => {
    setDraftTrafoOrderIds([...trafoOrderIds]);
    setIsEditingTrafoPos(true);
  };

  const handleCancelEditTrafoPos = () => {
    setIsEditingTrafoPos(false);
    setDraftTrafoOrderIds([]);
  };

  const handleSaveTrafoPos = () => {
    setTrafoOrderIds(draftTrafoOrderIds);
    try {
      localStorage.setItem("scada_trafo_detail_order_v1", JSON.stringify(draftTrafoOrderIds));
    } catch (e) {}
    setIsEditingTrafoPos(false);
    setTrafoToast("✓ Posisi kartu Transformator berhasil disimpan!");
    setTimeout(() => setTrafoToast(null), 3000);
  };

  const handleMoveTrafoDirection = (txId: string, direction: "left" | "right") => {
    const list = [...draftTrafoOrderIds];
    const idx = list.indexOf(txId);
    if (idx === -1) return;
    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    setDraftTrafoOrderIds(list);
  };

  const handleTrafoDragStart = (e: React.DragEvent, txId: string) => {
    setDraggedTrafoId(txId);
    e.dataTransfer.setData("text/plain", txId);
  };

  const handleTrafoDrop = (targetTxId: string) => {
    if (!draggedTrafoId || draggedTrafoId === targetTxId) return;
    const list = [...draftTrafoOrderIds];
    const srcIdx = list.indexOf(draggedTrafoId);
    const tgtIdx = list.indexOf(targetTxId);
    if (srcIdx !== -1 && tgtIdx !== -1) {
      list.splice(srcIdx, 1);
      list.splice(tgtIdx, 0, draggedTrafoId);
      setDraftTrafoOrderIds(list);
    }
    setDraggedTrafoId(null);
  };

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [formConfig, setFormConfig] = useState(loadConfig);

  // Bottom historical panel selection state
  const [bottomTxId, setBottomTxId] = useState("mdp-1.1");
  const bottomTx = useMemo(() => {
    return transformers.find(t => t.id === bottomTxId) || transformers[0];
  }, [transformers, bottomTxId]);

  // Section C Historical records state (24-Hour Rolling Window with Consistent 3-Second Polling & FIFO)
  const [bottomPointCount, setBottomPointCount] = useState(0);
  const [bottomTickMs, setBottomTickMs] = useState<number>(() => Math.floor(Date.now() / 3000) * 3000);
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
          const tuples = res?.tuples;
          if (Array.isArray(tuples) && tuples.length > 0) {
            const n = tuples.length;
            const vAb = new Array(n);
            const vBc = new Array(n);
            const vCa = new Array(n);
            const vRn = new Array(n);
            const vSn = new Array(n);
            const vTn = new Array(n);
            const kw = new Array(n);
            const iTot = new Array(n);
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
              vRn[i] = { x, y: Number((v1 / 1.7320508).toFixed(1)) };
              vSn[i] = { x, y: Number((v2 / 1.7320508).toFixed(1)) };
              vTn[i] = { x, y: Number((v3 / 1.7320508).toFixed(1)) };
              kw[i] = { x, y: p };
              iR[i] = { x, y: c1 };
              iS[i] = { x, y: c2 };
              iT[i] = { x, y: c3 };
              iTot[i] = { x, y: Number((c1 + c2 + c3).toFixed(1)) };
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
              vRn: Number((lv1 / 1.7320508).toFixed(1)),
              vSn: Number((lv2 / 1.7320508).toFixed(1)),
              vTn: Number((lv3 / 1.7320508).toFixed(1)),
              kw: Number(last[4]) || 0,
              iR: lc1, iS: lc2, iT: lc3,
              iTot: Number((lc1 + lc2 + lc3).toFixed(1))
            };
            setBottomPointCount(n);
            setBottomTickMs(Number(last[0]) || Math.floor(Date.now() / 3000) * 3000);
          }
        })
        .catch((err) => console.error("Failed to load bottom trafo history:", err))
        .finally(() => setLoadingBottomHistory(false));
    };

    // Fetch initial 24h 3-second rolling history once; subsequent 3-second updates stream via WebSocket
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
      const p = pm.active_power_total !== undefined && pm.active_power_total !== null ? Math.abs(Number(Number(pm.active_power_total).toFixed(2))) : 0;
      if (v1 <= 0 && p <= 0 && c1 <= 0) return;

      const s = bottomSeriesRef.current;
      const lastX = s.vAb.length > 0 ? s.vAb[s.vAb.length - 1].x : 0;
      const rawX = Number(pm.ts) || fallbackTs || Date.now();
      if (rawX - lastX < 2500) return;
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
      pushAndShift(s.vRn, Number((v1 / 1.7320508).toFixed(1)));
      pushAndShift(s.vSn, Number((v2 / 1.7320508).toFixed(1)));
      pushAndShift(s.vTn, Number((v3 / 1.7320508).toFixed(1)));
      pushAndShift(s.kw, p);
      pushAndShift(s.iTot, Number((c1 + c2 + c3).toFixed(1)));
      pushAndShift(s.iR, c1);
      pushAndShift(s.iS, c2);
      pushAndShift(s.iT, c3);

      setBottomPointCount(s.vAb.length);
      setBottomTickMs(nextX);
    };

    // Auto-refresh immediately when a new 3-second batch is saved into electric_trafo_rolling_3s in PostgreSQL
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
          label: "Ampere Total (A)",
          data: s.iTot,
          borderColor: "#8b5cf6",
          backgroundColor: "transparent",
          borderWidth: 1.8,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
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

  const totalLoadKw = useMemo(() => {
    const sumIncoming = (incomingData.wf1Kw || 0) + (incomingData.wf2Kw || 0);
    return sumIncoming > 0 ? sumIncoming : (incomingData.plnKw || 0);
  }, [incomingData]);

  const totalCapacityKva = useMemo(() => {
    return transformers.reduce((sum, tx) => sum + tx.capacityKva, 0);
  }, [transformers]);

  const orderedTransformers = useMemo(() => {
    const orderList = isEditingTrafoPos ? draftTrafoOrderIds : trafoOrderIds;
    return [...transformers].sort((a, b) => {
      const idxA = orderList.indexOf(a.id);
      const idxB = orderList.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [transformers, isEditingTrafoPos, draftTrafoOrderIds, trafoOrderIds]);

  const factory1 = orderedTransformers.filter(tx => tx.factory === 1);
  const factory2 = orderedTransformers.filter(tx => tx.factory === 2);

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
              <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">
                {totalLoadKw > 0 ? `${totalLoadKw.toLocaleString("id-ID")} kW` : "— kW"}
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
            {/* 1. Genset Natural Gas (Center 95, 242) -> Channels down X=175 between MDP-1.1 & MDP-1.2, feeds MDP-1.2 (183, 415) and bridges over MDP-1.2 feeder to MDP-2 (293, 415) */}
            <path
              d="M 95 242 L 95 252 L 175 252 L 175 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Arrowhead into left side of MDP-1.2 */}
            <path
              d="M 175 415 L 183 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />
            {/* Branch from X=175 to MDP-2 at X=285 with jumper bridge arc over MDP-1.2 feeder (X=230) */}
            <path
              d="M 175 345 L 223 345 A 7 7 0 0 1 237 345 L 285 345 L 285 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Arrowhead on second branch into left side of MDP-2 */}
            <path
              d="M 285 415 L 293 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />
            {/* Branch junction circle */}
            <circle cx="175" cy="345" r="3" fill="#10b981" />

            {/* 2. Solar PV POI-1 (Center 475, 242) -> Steps to X=517, feeds right side of MDP-3 (497, 415) */}
            <path
              d="M 475 242 L 475 252 L 517 252 L 517 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <path
              d="M 517 415 L 497 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              markerEnd="url(#arrow-red)"
            />

            {/* 3. Solar PV POI-2 (Center 950, 242) -> Centered departure, steps to channel X=975 between PUTR-2 & PUTR-NEW, feeds right side of PUTR-2 (965, 415) */}
            <path
              d="M 950 242 L 950 252 L 975 252 L 975 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <path
              d="M 975 415 L 965 415"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              markerEnd="url(#arrow-red)"
            />

            {/* 4. Genset Diesel Fuel (Center 1105, 242) -> Straight down along right side, feeds right side of PUTR-NEW (1085, 415) */}
            <path
              d="M 1105 242 L 1105 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <path
              d="M 1105 415 L 1085 415"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#arrow-green)"
            />

            {/* Main PLN line down and split symmetrically to Factory 1 (285) & Factory 2 (795) */}
            <path d="M 600 114 L 600 134 M 285 134 L 795 134" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            
            {/* Feeder line into Incoming Fact-1 */}
            <path d="M 285 134 L 285 150" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            
            {/* Feeder line into Incoming Fact-2 */}
            <path d="M 795 134 L 795 150" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Blue lines from Incoming Feeders down to Yellow Busbars */}
            <path d="M 285 246 L 285 265" fill="none" stroke={activeLineColor} strokeWidth="2.5" />
            <path d="M 795 246 L 795 265" fill="none" stroke={activeLineColor} strokeWidth="2.5" />

            {/* Busbars: Thick Yellow Lines with Ambient Glow (Rendered IN FRONT of auxiliary lines) */}
            {/* Factory 1 Busbar (Centered at X = 285, Width = 430) */}
            <path d="M 70 265 L 500 265" fill="none" stroke="#eab308" strokeWidth="6.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(234,179,8,0.35))" }} />

            {/* Factory 2 Busbar (Centered at X = 915, Width = 350) */}
            <path d="M 741 265 L 1089 265" fill="none" stroke="#eab308" strokeWidth="6.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 4px rgba(234,179,8,0.35))" }} />

            {/* Factory 1: 4 Symmetrical Transformer Branches (Centers: 120, 230, 340, 450) */}
            {[120, 230, 340, 450].map((x) => (
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

            {/* Factory 2: 3 Symmetrical Transformer Branches (Centers: 795, 915, 1035) */}
            {[795, 915, 1035].map((x) => (
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
          </svg>

          {/* 2. ABSOLUTE CARDS LAYOUT */}
          {/* Main PLN card at top center (X = 600) */}
          <div className="absolute z-30" style={{ left: 495, top: 10 }}>
            <div className={`text-center px-4 py-2.5 w-[210px] h-[112px] flex flex-col justify-center rounded-2xl border shadow-md transition-shadow duration-150 ${
              isDark ? "bg-blue-950/50 border-blue-500/50 text-white" : "bg-blue-50/95 border-blue-300 text-slate-800"
            }`}>
              <div className="text-sm leading-tight font-black text-blue-600 dark:text-blue-400 tracking-wide">PLN-21 kV</div>
              <div className="text-xs leading-tight font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">5,540 kVA</div>
              <div className="text-[10px] leading-tight font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3.5 w-20 bg-slate-300 dark:bg-slate-700 rounded my-0.5" />
                ) : (
                  <span className="text-sm font-black font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {incomingData.plnKw !== null ? `${incomingData.plnKw.toLocaleString("id-ID")} kW` : "— kW"}
                  </span>
                )}
              </div>
              <div className="text-xs leading-tight font-bold text-slate-600 dark:text-slate-300 mt-1">
                PF : {loadingSld ? (
                  <span className="inline-block h-3 w-10 bg-slate-300 dark:bg-slate-700 rounded align-middle" />
                ) : (
                  <span className="font-black font-mono tabular-nums">{incomingData.plnPf !== null ? Math.abs(incomingData.plnPf).toFixed(3) : "—"}</span>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════ FACTORY 1 SOURCES (Left Wing, Center = 285) ═══════════ */}
          {/* 1. Genset Natural Gas (Outer Left) */}
          <div className="absolute z-30" style={{ left: 22, top: 148 }}>
            <div className={`px-3 py-2 w-[145px] h-[100px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition-shadow duration-150 ${
              isDark ? "bg-orange-950/40 border-orange-500/40 text-orange-200" : "bg-orange-50/95 border-orange-200 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-orange-600 dark:text-orange-400">Genset</div>
              <div className="text-xs leading-tight font-black text-orange-600 dark:text-orange-400">Natural Gas</div>
              <div className="text-xs leading-tight font-bold text-slate-700 dark:text-slate-200 mt-1 font-mono tabular-nums">1,350 kVA</div>
              <div className="text-[9px] leading-tight text-slate-400 mt-1 font-mono font-bold">Belum Ada Sensor</div>
            </div>
          </div>

          {/* 2. Incoming Fact-1 (Center F1) */}
          <div className="absolute z-30" style={{ left: 208, top: 146 }}>
            <div className={`px-3 py-2 w-[155px] h-[104px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition-shadow duration-150 ${
              isDark ? "bg-blue-950/50 border-blue-500/50 text-white" : "bg-blue-50/95 border-blue-300 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">Incoming Fact-1</div>
              <div className="text-[10px] leading-tight font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3.5 w-16 bg-slate-300 dark:bg-slate-700 rounded my-0.5" />
                ) : (
                  <span className="text-xs sm:text-sm font-black font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {incomingData.wf1Kw !== null ? `${incomingData.wf1Kw.toLocaleString("id-ID")} kW` : "— kW"}
                  </span>
                )}
              </div>
              <div className="text-xs leading-tight font-bold text-slate-600 dark:text-slate-300 mt-1">
                PF : {loadingSld ? (
                  <span className="inline-block h-3 w-10 bg-slate-300 dark:bg-slate-700 rounded align-middle" />
                ) : (
                  <span className="font-black font-mono tabular-nums">{incomingData.wf1Pf !== null ? Math.abs(incomingData.wf1Pf).toFixed(3) : "—"}</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Solar PV POI-1 (Inner Left) */}
          <div className="absolute z-30" style={{ left: 402, top: 148 }}>
            <div className={`px-3 py-2 w-[145px] h-[100px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition-shadow duration-150 ${
              isDark ? "bg-orange-950/40 border-orange-500/40 text-orange-200" : "bg-orange-50/95 border-orange-200 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-orange-600 dark:text-orange-400 uppercase tracking-wide">Solar PV POI-1</div>
              <div className="text-[10px] leading-tight font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3.5 w-16 bg-slate-300 dark:bg-slate-700 rounded my-0.5" />
                ) : (
                  <span className="text-xs font-black font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {solarData.poi1Kw !== null ? `${solarData.poi1Kw.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW` : "— kW"}
                  </span>
                )}
              </div>
              <div className="text-xs leading-tight font-bold text-slate-600 dark:text-slate-300 mt-1">
                PF : {loadingSld ? (
                  <span className="inline-block h-3 w-8 bg-slate-300 dark:bg-slate-700 rounded align-middle" />
                ) : (
                  <span className="font-black font-mono tabular-nums">{solarData.poi1Pf !== null ? Math.abs(solarData.poi1Pf).toFixed(2) : "—"}</span>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════ FACTORY 2 SOURCES (Right Wing) ═══════════ */}
          {/* 1. Incoming Fact-2 (Left F2, Center = 795) */}
          <div className="absolute z-30" style={{ left: 718, top: 146 }}>
            <div className={`px-3 py-2 w-[155px] h-[104px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition-shadow duration-150 ${
              isDark ? "bg-blue-950/50 border-blue-500/50 text-white" : "bg-blue-50/95 border-blue-300 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">Incoming Fact-2</div>
              <div className="text-[10px] leading-tight font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3.5 w-16 bg-slate-300 dark:bg-slate-700 rounded my-0.5" />
                ) : (
                  <span className="text-xs sm:text-sm font-black font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {incomingData.wf2Kw !== null ? `${incomingData.wf2Kw.toLocaleString("id-ID")} kW` : "— kW"}
                  </span>
                )}
              </div>
              <div className="text-xs leading-tight font-bold text-slate-600 dark:text-slate-300 mt-1">
                PF : {loadingSld ? (
                  <span className="inline-block h-3 w-10 bg-slate-300 dark:bg-slate-700 rounded align-middle" />
                ) : (
                  <span className="font-black font-mono tabular-nums">{incomingData.wf2Pf !== null ? Math.abs(incomingData.wf2Pf).toFixed(3) : "—"}</span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Solar PV POI-2 (Center F2, Center = 950) */}
          <div className="absolute z-30" style={{ left: 885, top: 148 }}>
            <div className={`px-3 py-2 w-[145px] h-[100px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition-shadow duration-150 ${
              isDark ? "bg-orange-950/40 border-orange-500/40 text-orange-200" : "bg-orange-50/95 border-orange-200 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-orange-600 dark:text-orange-400 uppercase tracking-wide">Solar PV POI-2</div>
              <div className="text-[10px] leading-tight font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                Active Power <br />
                {loadingSld ? (
                  <span className="inline-block h-3.5 w-16 bg-slate-300 dark:bg-slate-700 rounded my-0.5" />
                ) : (
                  <span className="text-xs font-black font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {solarData.poi2Kw !== null ? `${solarData.poi2Kw.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kW` : "— kW"}
                  </span>
                )}
              </div>
              <div className="text-xs leading-tight font-bold text-slate-600 dark:text-slate-300 mt-1">
                PF : {loadingSld ? (
                  <span className="inline-block h-3 w-8 bg-slate-300 dark:bg-slate-700 rounded align-middle" />
                ) : (
                  <span className="font-black font-mono tabular-nums">{solarData.poi2Pf !== null ? Math.abs(solarData.poi2Pf).toFixed(2) : "—"}</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Genset Diesel Fuel (Outer Right, Center = 1105) */}
          <div className="absolute z-30" style={{ left: 1038, top: 148 }}>
            <div className={`px-3 py-2 w-[145px] h-[100px] flex flex-col justify-center text-center rounded-2xl border shadow-sm transition-shadow duration-150 ${
              isDark ? "bg-orange-950/40 border-orange-500/40 text-orange-200" : "bg-orange-50/95 border-orange-200 text-slate-800"
            }`}>
              <div className="text-xs leading-tight font-black text-orange-600 dark:text-orange-400">Genset</div>
              <div className="text-xs leading-tight font-black text-orange-600 dark:text-orange-400">Diesel Fuel</div>
              <div className="text-xs leading-tight font-bold text-slate-700 dark:text-slate-200 mt-1 font-mono tabular-nums">1,000 kVA</div>
              <div className="text-[9px] leading-tight text-slate-400 mt-1 font-mono font-bold">Belum Ada Sensor</div>
            </div>
          </div>

          {/* ═══════════ FACTORY 1 TRANSFORMER CARDS (4 Units) ═══════════ */}
          {factory1.map((tx, idx) => {
            const cardLeft = 70 + idx * 110;
            return (
              <SldTransformerCard
                key={tx.id}
                tx={tx}
                isFirst={idx === 0}
                isDark={isDark}
                loadingSld={loadingSld}
                onClick={() => setSelectedTx(tx)}
                cardLeft={cardLeft}
                width={100}
              />
            );
          })}

          {/* ═══════════ FACTORY 2 TRANSFORMER CARDS (3 Units) ═══════════ */}
          {factory2.map((tx, idx) => {
            const cardLeft = 745 + idx * 120;
            return (
              <SldTransformerCard
                key={tx.id}
                tx={tx}
                isFirst={idx === 0}
                isDark={isDark}
                loadingSld={loadingSld}
                onClick={() => setSelectedTx(tx)}
                cardLeft={cardLeft}
                width={104}
              />
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[9px] font-bold text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/40">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px #10b981" }} /> Online</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Belum Ada Sensor</span>
            <span className="text-[8px] text-slate-500 italic ml-2">Klik panel / Detail untuk info lengkap</span>
          </div>
        </SldScaledCanvas>
      </section>

      {/* ═══════════ SECTION B: DETAIL TRANSFORMATOR CARDS (MDP) ═══════════ */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <svg style={{ width: 18, height: 18 }} className="text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Detail Transformator — Parameter Lengkap
            </h3>
            {canEditPosition && (
              <div className="ml-2">
                {!isEditingTrafoPos ? (
                  <button
                    type="button"
                    onClick={handleStartEditTrafoPos}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition cursor-pointer"
                    title="Atur Urutan dan Posisi Kartu Transformator (Senior Unit Head / Admin Only)"
                  >
                    <span>📐 Atur Posisi</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={handleCancelEditTrafoPos}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTrafoPos}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25 transition cursor-pointer active:scale-95"
                    >
                      <span>💾 Simpan Posisi</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {trafoToast && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 animate-in fade-in">
              {trafoToast}
            </span>
          )}
        </div>

        {/* Factory 1 */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-[#47729f] dark:text-sky-400 uppercase tracking-widest pl-2">
            ● Factory 1 — {factory1.length} Transformator
          </h4>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {factory1.map((tx) => (
              <TransformerDetailCard
                key={tx.id}
                tx={tx}
                factoryLabel="Factory 1"
                loadConfig={loadConfig}
                isEditMode={isEditingTrafoPos}
                onMoveLeft={() => handleMoveTrafoDirection(tx.id, "left")}
                onMoveRight={() => handleMoveTrafoDirection(tx.id, "right")}
                onDragStart={(e) => handleTrafoDragStart(e, tx.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleTrafoDrop(tx.id)}
              />
            ))}
          </div>
        </div>

        {/* Factory 2 */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-[#47729f] dark:text-sky-400 uppercase tracking-widest pl-2">
            ● Factory 2 — {factory2.length} Transformator
          </h4>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {factory2.map((tx) => (
              <TransformerDetailCard
                key={tx.id}
                tx={tx}
                factoryLabel="Factory 2"
                loadConfig={loadConfig}
                isEditMode={isEditingTrafoPos}
                onMoveLeft={() => handleMoveTrafoDirection(tx.id, "left")}
                onMoveRight={() => handleMoveTrafoDirection(tx.id, "right")}
                onDragStart={(e) => handleTrafoDragStart(e, tx.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleTrafoDrop(tx.id)}
              />
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
          canEditPosition={canEditPosition}
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
            <div className="h-[140px] w-full">
              {bottomPointCount > 0 ? (
                <Line data={voltageTrendChart} options={multiLineChartOptions} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA BELUM TERSEDIA</span>
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
            <div className="h-[140px] w-full">
              {bottomPointCount > 0 ? (
                <Line data={powerTrendChart} options={lineChartOptions} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA BELUM TERSEDIA</span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Belum ada riwayat daya aktif tersimpan hari ini.</p>
                </div>
              )}
            </div>
          </div>

          {/* Ampere */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t("electricity.ampereRecord")}</h4>
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
            <div className="h-[150px] w-full">
              {bottomPointCount > 0 ? (
                <Line data={currentTrendChart} options={currentChartOptions} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 font-mono tracking-wider">DATA BELUM TERSEDIA</span>
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
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                    {bottomZoomChart === "voltage"
                      ? `Voltage Record (V) — ${bottomVoltageMode === "380v" ? "Tegangan 380V" : "Tegangan 230V"}`
                      : bottomZoomChart === "power"
                      ? "Daya Aktif Record — kW Total (kW)"
                      : "Ampere Record (A) — Total & 3 Fasa (R, S, T)"}
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
                    • Resolusi 3 Detik (Real-Time Buffer & Historikal)
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
                <Line data={voltageTrendChart} options={multiLineChartOptions} />
              ) : bottomZoomChart === "power" ? (
                <Line data={powerTrendChart} options={lineChartOptions} />
              ) : (
                <Line data={currentTrendChart} options={currentChartOptions} />
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
