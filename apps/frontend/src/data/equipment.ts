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
    targetTemp: number;
    tolerance: number;
    targetHumidity:number;
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
    targetTemp: number;
    tolerance: number;
    targetHumidity:number;
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
    maxTemp: number;
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
    lowTemp: 25,
    targetTemp: 40,
    tolerance: 2,
    targetHumidity: 75,
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
    targetTemp: 30,
    tolerance: 2,
    targetHumidity: 75,
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
    maxTemp: 30,
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

export const DEFAULT_CT1_EQ_CONFIGS: ConfigEqRow[] = [
  // 1. Motor Fan Menggunakan V-Belt
  { tagKey: "F1_VBELT_TENSION", tagName: "F-1 V-Belt Tension", baseline: 150, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F1_FAN_MOTOR_VISUAL", tagName: "F-1 Fan & Motor Visual Inspection", baseline: 420, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F1_FAN_SHAFT_BEARING", tagName: "F-1 Fan Shaft Bearing Lubrication", baseline: 810, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F1_VBELT_REPLACE", tagName: "F-1 V-Belt Replacement", baseline: 3200, lowLimit: 0, highLimit: 4500, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F1_MOTOR_REDUCER_GREASE", tagName: "F-1 Motor & Reducer Grease/Bearing", baseline: 4600, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F1_MOTOR_OVERHAUL", tagName: "FAN-1 (CT-1) Direct Drive Motor Overhaul", baseline: 8900, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 3. Sirkulasi Pump & Supply Motors
  { tagKey: "P1_STRAINER1_INSPECT", tagName: "P-1 Strainer Cleanliness Inspection", baseline: 180, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_STRAINER1_CLEAN", tagName: "P-1 Strainer Cleaning", baseline: 520, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_PUMP1_BEARING_LUB", tagName: "P-1 Pump Bearing Lubrication", baseline: 750, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_PUMP1_SEAL_LEAK", tagName: "P-1 Pump Seal & Leakage Inspection", baseline: 1200, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_PUMP1_OVERHAUL", tagName: "P-1 Pump Overhaul Major & Descaling", baseline: 2100, lowLimit: 0, highLimit: 2500, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_PUMP1_COUPLING_ALIGN", tagName: "P-1 Pump Coupling Alignment Inspection", baseline: 3100, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_MECH_SEAL_REPLACE", tagName: "P-1 Mechanical Seal Replacement", baseline: 6200, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M1_PUMP_MOTOR_OVERHAUL", tagName: "MTR-1 (CT-1) Pump Motor Overhaul/Bearing", baseline: 2100, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M2_SUPPLY_MOTOR_OVERHAUL", tagName: "MTR-2 (CT-1) Supply Motor 1 Overhaul/Bearing", baseline: 542, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M3_SUPPLY_MOTOR_OVERHAUL", tagName: "MTR-3 (CT-1) Supply Motor 2 Overhaul/Bearing", baseline: 437, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_STRAINER2_INSPECT", tagName: "P-2 Strainer Cleanliness Inspection", baseline: 110, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_STRAINER2_CLEAN", tagName: "P-2 Strainer Cleaning", baseline: 410, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_STRAINER3_INSPECT", tagName: "P-3 Strainer Cleanliness Inspection", baseline: 95, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P1_STRAINER3_CLEAN", tagName: "P-3 Strainer Cleaning", baseline: 380, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 4. Tanki Cooling Tower
  { tagKey: "CT1_BASIN_CLEANLINESS", tagName: "CT-1 Cold Water Basin Debris", baseline: 210, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_FLOAT_VALVE_INSP", tagName: "CT-1 Float Valve & Level Operation", baseline: 680, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_BASIN_SEDIMENT_CLEAN", tagName: "CT-1 Basin Sediment Cleaning", baseline: 1100, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_NOZZLE_DIST_INSP", tagName: "CT-1 Water Distribution & Nozzle Clean", baseline: 2800, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_TANK_FLUSH_CORROSION", tagName: "CT-1 Tank Flushing & Corrosion Inspect", baseline: 5200, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 5. Filler Cooling Tower-1
  { tagKey: "CT1_FILLER_ALGAE_CLOG", tagName: "CT-1 Filler Algae & Clog Visual", baseline: 150, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_FILLER_WATER_DIST", tagName: "CT-1 Filler Water Distribution Check", baseline: 720, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_FILLER_LIGHT_CLEAN", tagName: "CT-1 Filler Light Cleaning (<0.3 MPa)", baseline: 1300, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_FILLER_DEEP_CLEAN", tagName: "CT-1 Filler Deep Chemical Cleaning", baseline: 4200, lowLimit: 0, highLimit: 6000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_FILLER_STRUCT_INSP", tagName: "CT-1 Filler Structural Inspection", baseline: 5800, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT1_FILLER_REPLACEMENT", tagName: "CT-1 Filler PVC Replacement", baseline: 12500, lowLimit: 0, highLimit: 30000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 6. Sistem & Komponen Pendukung
  { tagKey: "CT1_INVERTER_CLEANLINESS", tagName: "CT-1 Inverter Inspection & Cleaning", baseline: 650, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" },
  { tagKey: "CT1_CONTROL_SYS_WIRING", tagName: "CT-1 Control System Wiring & Function", baseline: 1450, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" },
  { tagKey: "CT1_FASTENERS_TIGHT", tagName: "CT-1 Fasteners & Bolts Tightening", baseline: 2600, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" }
];

export const DEFAULT_CT2_EQ_CONFIGS: ConfigEqRow[] = [
  // 2. Cooling Tower-2 (Direct Fan)
  { tagKey: "F2_FAN_MOTOR_VISUAL", tagName: "F-2 Fan & Motor Visual Inspection", baseline: 320, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F2_FAN_SHAFT_BEARING", tagName: "F-2 Fan Shaft Bearing Lubrication", baseline: 680, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F2_MOTOR_GREASE", tagName: "F-2 Motor Grease / Bearing Inspect", baseline: 2100, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F2_MOTOR_OVERHAUL", tagName: "FAN-2 (CT-2) Direct Drive Motor Overhaul", baseline: 3870, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 3. Sirkulasi Pump & Supply Motors
  { tagKey: "P2_STRAINER1_INSPECT", tagName: "P-4 Strainer Cleanliness Inspection", baseline: 45, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_STRAINER1_CLEAN", tagName: "P-4 Strainer Cleaning", baseline: 210, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_PUMP1_BEARING_LUB", tagName: "P-4 Pump Bearing Lubrication", baseline: 387, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_PUMP1_SEAL_LEAK", tagName: "P-4 Pump Seal & Leakage Inspection", baseline: 1100, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_PUMP1_OVERHAUL", tagName: "P-4 Pump Overhaul Major & Descaling", baseline: 387, lowLimit: 0, highLimit: 2500, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_PUMP1_COUPLING_ALIGN", tagName: "P-4 Pump Coupling Alignment Inspection", baseline: 1800, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_MECH_SEAL_REPLACE", tagName: "P-4 Mechanical Seal Replacement", baseline: 3200, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M4_PUMP_MOTOR_OVERHAUL", tagName: "MTR-4 (DU-3) Pump Motor Overhaul/Bearing", baseline: 3870, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M5_SUPPLY_MOTOR_OVERHAUL", tagName: "MTR-5 (BP-3) Supply Motor 3 Overhaul/Bearing", baseline: 2080, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M6_SUPPLY_MOTOR_OVERHAUL", tagName: "MTR-6 (SP-3) Supply Motor 4 Overhaul/Bearing", baseline: 3470, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "P2_STRAINER2_INSPECT", tagName: "P-5 Strainer Cleanliness Inspection", baseline: 120, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_STRAINER2_CLEAN", tagName: "P-5 Strainer Cleaning", baseline: 340, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_STRAINER3_INSPECT", tagName: "P-6 Strainer Cleanliness Inspection", baseline: 85, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P2_STRAINER3_CLEAN", tagName: "P-6 Strainer Cleaning", baseline: 190, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 4. Tanki Cooling Tower
  { tagKey: "CT2_BASIN_CLEANLINESS", tagName: "CT-2 Cold Water Basin Debris", baseline: 410, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_FLOAT_VALVE_INSP", tagName: "CT-2 Float Valve & Level Operation", baseline: 720, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_BASIN_SEDIMENT_CLEAN", tagName: "CT-2 Basin Sediment Cleaning", baseline: 1450, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_NOZZLE_DIST_INSP", tagName: "CT-2 Water Distribution & Nozzle Clean", baseline: 3100, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_TANK_FLUSH_CORROSION", tagName: "CT-2 Tank Flushing & Corrosion Inspect", baseline: 4900, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 5. Filler Cooling Tower-2
  { tagKey: "CT2_FILLER_ALGAE_CLOG", tagName: "CT-2 Filler Algae & Clog Visual", baseline: 280, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_FILLER_WATER_DIST", tagName: "CT-2 Filler Water Distribution Check", baseline: 810, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_FILLER_LIGHT_CLEAN", tagName: "CT-2 Filler Light Cleaning (<0.3 MPa)", baseline: 1650, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_FILLER_DEEP_CLEAN", tagName: "CT-2 Filler Deep Chemical Cleaning", baseline: 3900, lowLimit: 0, highLimit: 6000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_FILLER_STRUCT_INSP", tagName: "CT-2 Filler Structural Inspection", baseline: 5100, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT2_FILLER_REPLACEMENT", tagName: "CT-2 Filler PVC Replacement", baseline: 9800, lowLimit: 0, highLimit: 30000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 6. Sistem & Komponen Pendukung
  { tagKey: "CT2_INVERTER_CLEANLINESS", tagName: "CT-2 Inverter Inspection & Cleaning", baseline: 420, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" },
  { tagKey: "CT2_CONTROL_SYS_WIRING", tagName: "CT-2 Control System Wiring & Function", baseline: 1150, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" },
  { tagKey: "CT2_FASTENERS_TIGHT", tagName: "CT-2 Fasteners & Bolts Tightening", baseline: 2900, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" }
];

export const DEFAULT_CT3_EQ_CONFIGS: ConfigEqRow[] = [
  // 2. Cooling Tower-3 (Direct Fan)
  { tagKey: "F3_FAN_MOTOR_VISUAL", tagName: "F-3 Fan & Motor Visual Inspection", baseline: 510, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F3_FAN_SHAFT_BEARING", tagName: "F-3 Fan Shaft Bearing Lubrication", baseline: 910, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F3_MOTOR_GREASE", tagName: "F-3 Motor Grease / Bearing Inspect", baseline: 1200, lowLimit: 0, highLimit: 5000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "F3_MOTOR_OVERHAUL", tagName: "FAN-3 (CT-3) Direct Drive Motor Overhaul", baseline: 2980, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 3. Sirkulasi Pump & Supply Motors
  { tagKey: "P3_STRAINER1_INSPECT", tagName: "P-7 Strainer Cleanliness Inspection", baseline: 195, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_STRAINER1_CLEAN", tagName: "P-7 Strainer Cleaning", baseline: 580, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_PUMP1_BEARING_LUB", tagName: "P-7 Pump Bearing Lubrication", baseline: 298, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_PUMP1_SEAL_LEAK", tagName: "P-7 Pump Seal & Leakage Inspection", baseline: 1600, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_PUMP1_OVERHAUL", tagName: "P-7 Pump Overhaul Major & Descaling", baseline: 298, lowLimit: 0, highLimit: 2500, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_PUMP1_COUPLING_ALIGN", tagName: "P-7 Pump Coupling Alignment Inspection", baseline: 2400, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_MECH_SEAL_REPLACE", tagName: "P-7 Mechanical Seal Replacement", baseline: 4800, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M7_PUMP_MOTOR_OVERHAUL", tagName: "MTR-7 (ST-3) Pump Motor Overhaul/Bearing", baseline: 2980, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "OFF" },
  { tagKey: "M8_SUPPLY_MOTOR_OVERHAUL", tagName: "MTR-8 (WASHING) Supply Motor 5 Overhaul/Bearing", baseline: 5030, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "M9_SUPPLY_MOTOR_OVERHAUL", tagName: "MTR-9 (MINI LAB) Supply Motor 6 Overhaul/Bearing", baseline: 6890, lowLimit: 0, highLimit: 10000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_STRAINER2_INSPECT", tagName: "P-8 Strainer Cleanliness Inspection", baseline: 60, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_STRAINER2_CLEAN", tagName: "P-8 Strainer Cleaning", baseline: 240, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_STRAINER3_INSPECT", tagName: "P-9 Strainer Cleanliness Inspection", baseline: 75, lowLimit: 0, highLimit: 200, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "P3_STRAINER3_CLEAN", tagName: "P-9 Strainer Cleaning", baseline: 310, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 4. Tanki Cooling Tower
  { tagKey: "CT3_BASIN_CLEANLINESS", tagName: "CT-3 Cold Water Basin Debris", baseline: 520, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_FLOAT_VALVE_INSP", tagName: "CT-3 Float Valve & Level Operation", baseline: 890, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_BASIN_SEDIMENT_CLEAN", tagName: "CT-3 Basin Sediment Cleaning", baseline: 1750, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_NOZZLE_DIST_INSP", tagName: "CT-3 Water Distribution & Nozzle Clean", baseline: 3600, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_TANK_FLUSH_CORROSION", tagName: "CT-3 Tank Flushing & Corrosion Inspect", baseline: 6890, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 5. Filler Cooling Tower-3
  { tagKey: "CT3_FILLER_ALGAE_CLOG", tagName: "CT-3 Filler Algae & Clog Visual", baseline: 580, lowLimit: 0, highLimit: 600, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_FILLER_WATER_DIST", tagName: "CT-3 Filler Water Distribution Check", baseline: 950, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_FILLER_LIGHT_CLEAN", tagName: "CT-3 Filler Light Cleaning (<0.3 MPa)", baseline: 1950, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_FILLER_DEEP_CLEAN", tagName: "CT-3 Filler Deep Chemical Cleaning", baseline: 5400, lowLimit: 0, highLimit: 6000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_FILLER_STRUCT_INSP", tagName: "CT-3 Filler Structural Inspection", baseline: 7200, lowLimit: 0, highLimit: 8000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },
  { tagKey: "CT3_FILLER_REPLACEMENT", tagName: "CT-3 Filler PVC Replacement", baseline: 14200, lowLimit: 0, highLimit: 30000, unit: "h", enableAlert: true, suppressAlert: false, status: "ON" },

  // 6. Sistem & Komponen Pendukung
  { tagKey: "CT3_INVERTER_CLEANLINESS", tagName: "CT-3 Inverter Inspection & Cleaning", baseline: 850, lowLimit: 0, highLimit: 1000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" },
  { tagKey: "CT3_CONTROL_SYS_WIRING", tagName: "CT-3 Control System Wiring & Function", baseline: 1680, lowLimit: 0, highLimit: 2000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" },
  { tagKey: "CT3_FASTENERS_TIGHT", tagName: "CT-3 Fasteners & Bolts Tightening", baseline: 3400, lowLimit: 0, highLimit: 4000, unit: "h", enableAlert: true, suppressAlert: false, status: "—" }
];

export const getDefaultEqConfigs = (unitId: string): ConfigEqRow[] => {
  if (unitId === "cooling-water-1") return DEFAULT_CT1_EQ_CONFIGS;
  if (unitId === "cooling-water-2") return DEFAULT_CT2_EQ_CONFIGS;
  if (unitId === "cooling-water-3") return DEFAULT_CT3_EQ_CONFIGS;
  if (unitId.includes("hvac") || unitId.includes("ahu")) return DEFAULT_HVAC_EQ_CONFIGS;
  return DEFAULT_EQ_CONFIGS;
};


