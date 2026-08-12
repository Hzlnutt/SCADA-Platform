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
    [`Active_Power_Total_pm${pmId}`]: Number(activePower.toFixed(2)),
    [`VoltAB_pm${pmId}`]: Number(voltAB.toFixed(2)),
    [`Apparent_Power_Total_pm${pmId}`]: Number(apparentPower.toFixed(2)),
    [`VoltCA_pm${pmId}`]: Number(voltCA.toFixed(2)),
    [`Current_C_pm${pmId}`]: Number(currentC.toFixed(2)),
    [`THD_Current_C_pm${pmId}`]: Number(thdCurrC.toFixed(2)),
    [`THD_Volt_A_pm${pmId}`]: Number(thdVoltA.toFixed(2)),
    [`VoltBC_pm${pmId}`]: Number(voltBC.toFixed(2)),
    [`Volt_LL_pm${pmId}`]: Number(voltLL.toFixed(2)),
    [`Volatage_Unbalance_pm${pmId}`]: Number(voltUnbalance.toFixed(2)),
    [`THD_Volt_C_pm${pmId}`]: Number(thdVoltC.toFixed(2)),
    [`Frequency_pm${pmId}`]: Number(freq.toFixed(2)),
    [`THD_Current_A_pm${pmId}`]: Number(thdCurrA.toFixed(2)),
    [`Current_Umbalance_pm${pmId}`]: Number(currUnbalance.toFixed(2)),
    [`Current_A_pm${pmId}`]: Number(currentA.toFixed(2)),
    [`Status_pm${pmId}`]: status,
    [`Reactive_Power_Total_pm${pmId}`]: Number(reactivePower.toFixed(2)),
    [`Power_Factor_pm${pmId}`]: Number(pf.toFixed(3)),
    [`Current_B_pm${pmId}`]: Number(currentB.toFixed(2)),
    [`THD_Volt_B_pm${pmId}`]: Number(thdVoltB.toFixed(2)),
    [`ActiveEnergy_pm${pmId}`]: activeEnergy,
    [`THD_Current_B_pm${pmId}`]: Number(thdCurrB.toFixed(2))
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
