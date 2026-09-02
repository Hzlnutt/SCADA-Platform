import { Router } from "express";

export const mockScadaRouter = Router();

// Power meter lists based on the provided spreadsheet tables
const ew21PowerMeters = [
  132, 133, 134, 135, 136, 138, 139, 140, 151, 152, 153, 154, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185
];

const ew22PowerMeters = [
  206, 205, 203, 208, 207, 271, 272, 274, 273, 201, 209, 226, 202, 288, 229, 210, 215, 213, 211, 214, 212
];

const ew23PowerMeters = [
  319, 320, 321, 322, 323, 325, 324, 327, 318, 337, 411, 412, 410
];

/**
 * Generates 22 power parameters for a single power meter.
 * The parameters are generated with realistic values and dynamic jitter.
 */
const generatePmData = (pmId: number) => {
  // Voltages line-to-line around 380V (e.g. 375 to 384V)
  const voltAB = 375 + Math.random() * 9;
  const voltBC = 375 + Math.random() * 9;
  const voltCA = 375 + Math.random() * 9;
  const voltLL = (voltAB + voltBC + voltCA) / 3;

  // Active power in Watts (some PMs have higher loads than others)
  let activePowerBase = 12000; // default 12 kW
  if (pmId < 150) {
    activePowerBase = 85000; // ~85 kW
  } else if (pmId >= 200 && pmId < 220) {
    activePowerBase = 110000; // ~110 kW
  } else if (pmId >= 410) {
    activePowerBase = 450000; // ~450 kW for incoming cubicles
  }

  const activePower = activePowerBase * (0.8 + Math.random() * 0.4);
  const pf = 0.88 + Math.random() * 0.08;
  const apparentPower = activePower / pf;
  const reactivePower = Math.sqrt(Math.max(0, apparentPower * apparentPower - activePower * activePower));

  // Current (A) = Power / (sqrt(3) * Volt * PF)
  const avgCurrent = activePower / (Math.sqrt(3) * voltLL * pf);
  const currentA = avgCurrent * (0.97 + Math.random() * 0.06);
  const currentB = avgCurrent * (0.97 + Math.random() * 0.06);
  const currentC = avgCurrent * (0.97 + Math.random() * 0.06);

  const freq = 49.85 + Math.random() * 0.3;
  const status = 9.18354961579912e-41; // Using the provided status float value from user template

  // Active energy accumulator in Wh (slowly incrementing over time)
  const activeEnergy = 1250000 + Math.floor(Date.now() / 60000) * 10 + (pmId * 100);

  // THD values (total harmonic distortion)
  const thdVoltA = 0.4 + Math.random() * 0.8;
  const thdVoltB = 0.4 + Math.random() * 0.8;
  const thdVoltC = 0.4 + Math.random() * 0.8;
  
  const thdCurrA = 1.0 + Math.random() * 1.5;
  const thdCurrB = 1.0 + Math.random() * 1.5;
  const thdCurrC = 1.0 + Math.random() * 1.5;

  const voltUnbalance = 0.1 + Math.random() * 0.3;
  const currUnbalance = 0.3 + Math.random() * 1.2;

  return {
    [`Active_Power_Total_PM${pmId}`]: Number(activePower.toFixed(2)),
    [`VoltAB_PM${pmId}`]: Number(voltAB.toFixed(2)),
    [`Apparent_Power_Total_PM${pmId}`]: Number(apparentPower.toFixed(2)),
    [`VoltCA_PM${pmId}`]: Number(voltCA.toFixed(2)),
    [`Current_C_PM${pmId}`]: Number(currentC.toFixed(2)),
    [`THD_Current_C_PM${pmId}`]: Number(thdCurrC.toFixed(2)),
    [`THD_Volt_A_PM${pmId}`]: Number(thdVoltA.toFixed(2)),
    [`VoltBC_PM${pmId}`]: Number(voltBC.toFixed(2)),
    [`Volt_LL_PM${pmId}`]: Number(voltLL.toFixed(2)),
    [`Volatage_Unbalance_PM${pmId}`]: Number(voltUnbalance.toFixed(2)),
    [`THD_Volt_C_PM${pmId}`]: Number(thdVoltC.toFixed(2)),
    [`Frequency_PM${pmId}`]: Number(freq.toFixed(2)),
    [`THD_Current_A_PM${pmId}`]: Number(thdCurrA.toFixed(2)),
    [`Current_Umbalance_PM${pmId}`]: Number(currUnbalance.toFixed(2)),
    [`Current_A_PM${pmId}`]: Number(currentA.toFixed(2)),
    [`Status_PM${pmId}`]: status,
    [`Reactive_Power_Total_PM${pmId}`]: Number(reactivePower.toFixed(2)),
    [`Power_Factor_PM${pmId}`]: Number(pf.toFixed(3)),
    [`Current_B_PM${pmId}`]: Number(currentB.toFixed(2)),
    [`THD_Volt_B_PM${pmId}`]: Number(thdVoltB.toFixed(2)),
    [`ActiveEnergy_PM${pmId}`]: activeEnergy,
    [`THD_Current_B_PM${pmId}`]: Number(thdCurrB.toFixed(2))
  };
};

mockScadaRouter.get("/system/webdev/Utility_Dashboard/electric_ew21", (_req, res) => {
  const sorted = [...ew21PowerMeters].sort((a, b) => a - b);
  const result = sorted.map((pmId) => generatePmData(pmId));
  res.json(result);
});

mockScadaRouter.get("/system/webdev/Utility_Dashboard/electric_ew22", (_req, res) => {
  const sorted = [...ew22PowerMeters].sort((a, b) => a - b);
  const result = sorted.map((pmId) => generatePmData(pmId));
  res.json(result);
});

mockScadaRouter.get("/system/webdev/Utility_Dashboard/electric_ew23", (_req, res) => {
  const sorted = [...ew23PowerMeters].sort((a, b) => a - b);
  const result = sorted.map((pmId) => generatePmData(pmId));
  res.json(result);
});

mockScadaRouter.get("/system/webdev/Utility_Dashboard/electric_plts", (_req, res) => {
  res.json({
    POI_1: {
      Status_POI_1: true,
      Volt_AN_POI_1: 227.38,
      Total_KVARH_POI_1: 21410.5,
      Volt_CA_POI_1: 392.35,
      Volt_BC_POI_1: 389.98,
      Volt_CN_POI_1: 226.32,
      Volt_BN_POI_1: 225.61,
      Scale_Total_KW_POI_1: 45.2,
      Frequency_POI_1: 49.98,
      Total_KWH_POI_1: 24558.67,
      Volt_AB_POI_1: 391.86
    },
    POI_2: {
      Volt_AN_POI_2: 223.64,
      Total_KVARH_POI_2: 7562.75,
      Volt_CA_POI_2: 378.83,
      Volt_BN_POI_2: 219.47,
      Volt_BC_POI_2: 385.98,
      Volt_CN_POI_2: 221.11,
      Scale_Total_KW_POI_2: 82.5,
      Frequency_POI_2: 49.98,
      Volt_AB_POI_2: 383.13,
      Status_POI_2: true,
      Total_KWH_POI_2: 95707.05
    }
  });
});

mockScadaRouter.get("/system/webdev/Utility_Dashboard/hvac_retain_plc1", (_req, res) => {
  res.json({
    PLC1_AHU1_Utl: {
      ACT_RTx_1A: 40.46875,
      xIND_RUN_EH01: true,
      ACT_RTx_1B: 40.40625,
      ACT_SF01_CAP: 90,
      ACT_RHx_1B: 74.875,
      ACT_RHx_1A: 76.8125,
      ACT_EH01_CAP: 30,
      xIND_RUN_HP: true,
      ACT_SF01_CUR: 1.87649989128113,
      xIND_RUN_SF01: true,
      ACT_SF01_SPD: 1839.82495117188,
      ACT_RATx_1: 40.0625,
      xIND_RUN_HF01: true,
      ACT_RAHx_1: 75.75
    }
  });
});

mockScadaRouter.get("/system/webdev/Utility_Dashboard/hvac_retain_plc2_2", (_req, res) => {
  res.json({
    PLC2_AHU2: {
      ACT_RTx_2B: 29.84375,
      xIND_RUN_EH02: false,
      ACT_RTx_2A: 28.71875,
      ACT_RHx_2A: 76.1875,
      ACT_RHx_2B: 70.125,
      ACT_SF02A_SPD: 1828.7099609375,
      ACT_SF02_CAP: 90,
      ACT_SF02B_SPD: 1846.26000976563,
      xIND_RUN_SF02A: true,
      ACT_RATx_2: 30.1625003814697,
      xIND_RUN_SF02B: true,
      ACT_RAHx_2: 68.1374969482422,
      xIND_RUN_CU02A: true,
      ACT_SF02B_CUR: 1.5387499332428,
      ACT_EH02_CAP: 0,
      xIND_RUN_CU02B: true
    }
  });
});

mockScadaRouter.get("/system/webdev/Utility_Dashboard/hvac_retain_plc2_3", (_req, res) => {
  res.json({
    PLC2_AHU3: {
      ACT_RTx_3A: 26.25,
      ACT_RTx_3B: 27.5625
    }
  });
});
