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

export type ConfigEqRow = {
  tagKey: string;
  tagName: string;
  baseline: number;
  lowLimit: number;
  highLimit: number;
  unit: string;
  enableAlert: boolean;
  suppressAlert: boolean;
  status: "ON" | "OFF" | "—";
  runHoursBeforeMaintenance?: number;
  runHoursLifetime?: number;
};

export const DEFAULT_EQ_CONFIGS: ConfigEqRow[] = [
  { tagKey: "F-1", tagName: "Fan F-1 Running Hours", baseline: 1200, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "F-2", tagName: "Fan F-2 Running Hours", baseline: 980, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "F-3", tagName: "Fan F-3 Running Hours", baseline: 110, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M-1", tagName: "Motor M-1 Running Hours", baseline: 2100, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M-2", tagName: "Motor M-2 Running Hours", baseline: 542, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M-3", tagName: "Motor M-3 Running Hours", baseline: 437, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M-4", tagName: "Motor M-4 Running Hours", baseline: 387, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M-5", tagName: "Motor M-5 Running Hours", baseline: 208, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M-6", tagName: "Motor M-6 Running Hours", baseline: 347, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M-7", tagName: "Motor M-7 Running Hours", baseline: 298, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M-8", tagName: "Motor M-8 Running Hours", baseline: 503, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M-9", tagName: "Motor M-9 Running Hours", baseline: 689, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "DOZING PUMP-1", tagName: "Dosing Pump 1 Running Hours", baseline: 689, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "DOZING PUMP-2", tagName: "Dosing Pump 2 Running Hours", baseline: 689, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-1", tagName: "Strainer M-1 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-2", tagName: "Strainer M-2 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-3", tagName: "Strainer M-3 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-4", tagName: "Strainer M-4 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-5", tagName: "Strainer M-5 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-6", tagName: "Strainer M-6 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-7", tagName: "Strainer M-7 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-8", tagName: "Strainer M-8 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "STRAINER M-9", tagName: "Strainer M-9 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "BASIN CT-1", tagName: "Basin CT-1 Running Hours", baseline: 689, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "BASIN CT-2", tagName: "Basin CT-2 Running Hours", baseline: 689, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "BASIN CT-3", tagName: "Basin CT-3 Running Hours", baseline: 689, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CELLPAD CT-1", tagName: "Cellpad CT-1 Running Hours", baseline: 0, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: false, suppressAlert: false, status: "—" },
  { tagKey: "CELLPAD CT-2", tagName: "Cellpad CT-2 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CELLPAD CT-3", tagName: "Cellpad CT-3 Running Hours", baseline: 689, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "PANEL", tagName: "Control Panel Running Hours", baseline: 689, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" }
];

export type HvacConfig = {
  ahu1: {
    tempSp: number;
    humiditySp: number;
    sfCapacity: number;
    eh1Capacity: number;
    eh2Capacity: number;
    coolDownTime: number;
    highTemp: number;
    lowTemp: number;
    highHumidity: number;
    lowHumidity: number;
    alarmDelay: number;
    stopBuzzer: number;
    dbTemp1: number;
    dbTemp2: number;
    dbHumid1: number;
    dbHumid2: number;
    dbHumid3: number;
  };
  ahu2: {
    tempSp: number;
    humiditySp: number;
    sfCapacity: number;
    ehCapacity: number;
    coolDownTime: number;
    highTemp: number;
    lowTemp: number;
    highHumidity: number;
    lowHumidity: number;
    alarmDelay: number;
    stopBuzzer: number;
    dbTemp1: number;
    dbTemp2: number;
    dbHumid1: number;
    dbHumid2: number;
    dbHumid3: number;
  };
  ahu3: {
    tempSp: number;
    highTemp: number;
    lowTemp: number;
    alarmDelay: number;
  };
};

export const DEFAULT_HVAC_CONFIG: HvacConfig = {
  ahu1: {
    tempSp: 27.6,
    humiditySp: 60.0,
    sfCapacity: 80,
    eh1Capacity: 50,
    eh2Capacity: 40,
    coolDownTime: 15,
    highTemp: 30.0,
    lowTemp: 25.0,
    highHumidity: 70.0,
    lowHumidity: 40.0,
    alarmDelay: 5,
    stopBuzzer: 10,
    dbTemp1: 1.0,
    dbTemp2: 2.0,
    dbHumid1: 2.0,
    dbHumid2: 3.0,
    dbHumid3: 4.0
  },
  ahu2: {
    tempSp: 40.0,
    humiditySp: 75.1,
    sfCapacity: 85,
    ehCapacity: 60,
    coolDownTime: 10,
    highTemp: 42.0,
    lowTemp: 38.0,
    highHumidity: 80.0,
    lowHumidity: 70.0,
    alarmDelay: 5,
    stopBuzzer: 10,
    dbTemp1: 1.0,
    dbTemp2: 2.0,
    dbHumid1: 2.0,
    dbHumid2: 3.0,
    dbHumid3: 4.0
  },
  ahu3: {
    tempSp: 30.0,
    highTemp: 32.0,
    lowTemp: 28.0,
    alarmDelay: 10
  }
};

export const DEFAULT_HVAC_EQ_CONFIGS: ConfigEqRow[] = [
  { tagKey: "UV_LAMP", tagName: "UV Lamp", baseline: 850, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "WATER_TANK", tagName: "Water Tank", baseline: 1420, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "MTR_WTR_TANK", tagName: "Motor Water Tank", baseline: 2100, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "MAKEUP_WTR", tagName: "Make up Water", baseline: 680, lowLimit: 0, highLimit: 3000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CELLPAD_01", tagName: "Cellpad-01", baseline: 1120, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CELLPAD_02", tagName: "Cellpad-02", baseline: 980, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "MTR_DEHUM_01", tagName: "Motor Dehum-01", baseline: 3450, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "MTR_DEHUM_02", tagName: "Motor Dehum-02", baseline: 1890, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "EH_01", tagName: "EH-01", baseline: 2450, lowLimit: 0, highLimit: 12000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "EH_02", tagName: "EH-02", baseline: 1200, lowLimit: 0, highLimit: 12000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "CU_2.1", tagName: "CU-2.1", baseline: 4320, lowLimit: 0, highLimit: 15000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CU_2.2", tagName: "CU-2.2", baseline: 2150, lowLimit: 0, highLimit: 15000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CU_3.1", tagName: "CU-3.1", baseline: 5230, lowLimit: 0, highLimit: 15000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" }
];

