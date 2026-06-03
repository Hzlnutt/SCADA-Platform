export type EquipmentSegment = "Utility" | "HVAC" | "WWTP";

export type EquipmentItem = {
  id: string;
  name: string;
  code: string;
  category: string;
  segment: EquipmentSegment;
  tagId?: string;
  unit?: string;
};

export const utilityEquipment: EquipmentItem[] = [
  {
    id: "cooling-tower-wf1u3",
    name: "Cooling Tower",
    code: "WF1-U3",
    category: "Cooling Water System",
    segment: "Utility",
    tagId: "cooling-water/wf1u3_flow",
    unit: "m3/h"
  },
  {
    id: "cooling-tower-wf2",
    name: "Cooling Tower",
    code: "WF2",
    category: "Cooling Water System",
    segment: "Utility",
    tagId: "cooling-water/wf2_flow",
    unit: "m3/h"
  },
  {
    id: "boiler-3-wf1",
    name: "Boiler-3",
    code: "WF1",
    category: "Boiler",
    segment: "Utility",
    tagId: "boiler/boiler_3_pressure",
    unit: "bar"
  },
  {
    id: "boiler-4-wf1",
    name: "Boiler-4",
    code: "WF1",
    category: "Boiler",
    segment: "Utility",
    tagId: "boiler/boiler_4_pressure",
    unit: "bar"
  },
  {
    id: "boiler-5-wf2",
    name: "Boiler-5",
    code: "WF2",
    category: "Boiler",
    segment: "Utility",
    tagId: "boiler/boiler_5_pressure",
    unit: "bar"
  },
  {
    id: "compressed-air-ale-30-wf1",
    name: "Compressed Air ALE-30",
    code: "WF1",
    category: "Compressed Air",
    segment: "Utility",
    tagId: "compressed-air/ale_30_pressure",
    unit: "bar"
  },
  {
    id: "compressed-air-zt-30-1-wf1",
    name: "Compressed Air ZT-30.1",
    code: "WF1",
    category: "Compressed Air",
    segment: "Utility",
    tagId: "compressed-air/zt_30_1_pressure",
    unit: "bar"
  },
  {
    id: "compressed-air-zt-30-2-wf1",
    name: "Compressed Air ZT-30.2",
    code: "WF1",
    category: "Compressed Air",
    segment: "Utility",
    tagId: "compressed-air/zt_30_2_pressure",
    unit: "bar"
  },
  {
    id: "compressed-air-zt-55-wf1",
    name: "Compressed Air ZT-55",
    code: "WF1",
    category: "Compressed Air",
    segment: "Utility",
    tagId: "compressed-air/zt_55_pressure",
    unit: "bar"
  },
  {
    id: "compressed-air-ingersoll-55-wf1",
    name: "Compressed Air Ingersoll-55",
    code: "WF1",
    category: "Compressed Air",
    segment: "Utility",
    tagId: "compressed-air/ingersoll_55_pressure",
    unit: "bar"
  },
  {
    id: "compressed-air-ale-250-wf2",
    name: "Compressed Air ALE-250",
    code: "WF2",
    category: "Compressed Air",
    segment: "Utility",
    tagId: "compressed-air/ale_250_pressure",
    unit: "bar"
  },
  {
    id: "compressed-air-zt-110-wf2",
    name: "Compressed Air ZT-110",
    code: "WF2",
    category: "Compressed Air",
    segment: "Utility",
    tagId: "compressed-air/zt_110_pressure",
    unit: "bar"
  },
  {
    id: "chiller-trane-cgam-40-wf1u3",
    name: "Chiller Trane CGAM-40",
    code: "WF1U3",
    category: "Chiller",
    segment: "Utility",
    tagId: "chiller/trane_cgam_40_temp",
    unit: "degC"
  },
  {
    id: "chiller-daikin-wf1u3",
    name: "Chiller Daikin",
    code: "WF1U3",
    category: "Chiller",
    segment: "Utility",
    tagId: "chiller/daikin_wf1u3_temp",
    unit: "degC"
  },
  {
    id: "chiller-trane-rtac-100-wf2",
    name: "Chiller Trane RTAC-100",
    code: "WF2",
    category: "Chiller",
    segment: "Utility",
    tagId: "chiller/rtac_100_temp",
    unit: "degC"
  },
  {
    id: "chiller-trane-rtac-275-wf2",
    name: "Chiller Trane RTAC-275",
    code: "WF2",
    category: "Chiller",
    segment: "Utility",
    tagId: "chiller/rtac_275_temp",
    unit: "degC"
  }
];

export const hvacEquipment: EquipmentItem[] = [
  { id: "hvac-qc-lab", name: "HVAC QC Lab", code: "QC-LAB", category: "QC", segment: "HVAC" },
  { id: "hvac-qc-retained-sample", name: "HVAC QC Retained Sample", code: "QC-RS", category: "QC", segment: "HVAC" },
  { id: "hvac-wh-3", name: "HVAC WH-3", code: "WH-3", category: "Warehouse", segment: "HVAC" },
  { id: "hvac-wh-4", name: "HVAC WH-4", code: "WH-4", category: "Warehouse", segment: "HVAC" },
  { id: "hvac-wh-5", name: "HVAC WH-5", code: "WH-5", category: "Warehouse", segment: "HVAC" },
  { id: "hvac-wh-6", name: "HVAC WH-6", code: "WH-6", category: "Warehouse", segment: "HVAC" },
  { id: "hvac-wh-7", name: "HVAC WH-7", code: "WH-7", category: "Warehouse", segment: "HVAC" },
  { id: "hvac-preparation-wf1u3", name: "HVAC Preparation", code: "WF1U3", category: "WF1U3", segment: "HVAC" },
  { id: "hvac-bottlepack-wf1u3", name: "HVAC Bottlepack", code: "WF1U3", category: "WF1U3", segment: "HVAC" },
  { id: "hvac-qc-sampling-wf1u3", name: "HVAC QC Sampling", code: "WF1U3", category: "WF1U3", segment: "HVAC" },
  { id: "hvac-corridor-wf1u3", name: "HVAC Corridor", code: "WF1U3", category: "WF1U3", segment: "HVAC" },
  { id: "hvac-steril-ip-wf1u3", name: "HVAC Steril IP", code: "WF1U3", category: "WF1U3", segment: "HVAC" },
  { id: "hvac-preparation-wf2u1", name: "HVAC Preparation", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-bottlepack-wf2u1", name: "HVAC Bottlepack", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-weighing-wf2u1", name: "HVAC Weighing", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-laundry-wf2u1", name: "HVAC Laundry", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-steril-wf2u1", name: "HVAC Steril", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-ip-wf2u1", name: "HVAC IP", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-corridor-wf2u1", name: "HVAC Corridor", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-material-wf2u1", name: "HVAC Material", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-wt-wf2u1", name: "HVAC WT", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "hvac-qc-wf2u1", name: "HVAC QC", code: "WF2U1", category: "WF2U1", segment: "HVAC" },
  { id: "oac-1-wf2u1", name: "OAC-1", code: "WF2U1", category: "OAC", segment: "HVAC" },
  { id: "oac-2-wf2u1", name: "OAC-2", code: "WF2U1", category: "OAC", segment: "HVAC" },
  { id: "hvac-preparation-wf2u2", name: "HVAC Preparation", code: "WF2U2", category: "WF2U2", segment: "HVAC" },
  { id: "hvac-bottlepack-wf2u2", name: "HVAC Bottlepack", code: "WF2U2", category: "WF2U2", segment: "HVAC" },
  { id: "hvac-steril-wf2u2", name: "HVAC Steril", code: "WF2U2", category: "WF2U2", segment: "HVAC" },
  { id: "hvac-ip-wf2u2", name: "HVAC IP", code: "WF2U2", category: "WF2U2", segment: "HVAC" },
  { id: "hvac-corridor-bp-wf2u2", name: "HVAC Corridor BP", code: "WF2U2", category: "WF2U2", segment: "HVAC" },
  { id: "oac-wf2u2", name: "OAC", code: "WF2U2", category: "OAC", segment: "HVAC" },
  { id: "chiller-trane-rtac-250-wf2", name: "Chiller Trane RTAC-250", code: "WF2", category: "Chiller", segment: "HVAC" },
  { id: "chiller-trane-185-wf2", name: "Chiller Trane-185", code: "WF2", category: "Chiller", segment: "HVAC" }
];

export const wwtpEquipment: EquipmentItem[] = [
  {
    id: "wwtp-inlet",
    name: "WWTP Inlet Pump",
    code: "WWTP-IN",
    category: "Influent",
    segment: "WWTP",
    tagId: "wwtp/inlet_flow",
    unit: "m3/h"
  },
  {
    id: "wwtp-aerator",
    name: "WWTP Aerator",
    code: "WWTP-AE",
    category: "Treatment",
    segment: "WWTP",
    tagId: "wwtp/do_level",
    unit: "mg/L"
  },
  {
    id: "wwtp-clarifier",
    name: "WWTP Clarifier",
    code: "WWTP-CL",
    category: "Clarifier",
    segment: "WWTP",
    tagId: "wwtp/tss",
    unit: "mg/L"
  },
  {
    id: "wwtp-effluent",
    name: "WWTP Effluent Meter",
    code: "WWTP-OUT",
    category: "Effluent",
    segment: "WWTP",
    tagId: "wwtp/effluent_flow",
    unit: "m3/h"
  }
];

export const allEquipment = [...utilityEquipment, ...hvacEquipment, ...wwtpEquipment];
