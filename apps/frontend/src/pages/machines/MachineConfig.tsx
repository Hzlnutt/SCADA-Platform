import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { getUnitById } from "../../data/machines";
import { postJson, getJson, deleteJson, patchJson } from "../../services/api.client";
import { DEFAULT_EQ_CONFIGS, DEFAULT_HVAC_CONFIG, DEFAULT_HVAC_EQ_CONFIGS, getDefaultEqConfigs, getDefaultSensorConfigs } from "../../data/equipment";
import type { ConfigEqRow, ConfigTagRow, HvacConfig } from "../../data/equipment";
import type { MachineOutletContext } from "./MachineLayout";

export type ApiSourceRow = {
  tagKey: string;
  tagName: string;
  url: string;
  unit: string;
};

const getDefaultApiSourceConfigs = (unitId: string): ApiSourceRow[] => {
  const defaultUrl = "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/cooling3";
  const isCooling = unitId === "cooling-water-1" || unitId === "cooling-water-2" || unitId === "cooling-water-3";
  
  if (!isCooling) {
    return getDefaultSensorConfigs(unitId).map(s => ({
      tagKey: s.tagKey,
      tagName: s.tagName,
      url: "",
      unit: s.unit
    }));
  }

  return [
    // Part : Main Information
    { tagKey: "cooling-water/supply_temp", tagName: "Supply Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/return_temp", tagName: "Return Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/delta_temp", tagName: "Delta Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/ambient_temp", tagName: "Ambient Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/ambient_humidity", tagName: "Ambient Humidity", url: defaultUrl, unit: "%" },

    // Part: MTR Pressure
    { tagKey: "cooling-water/pressure_1", tagName: "MTR-1 Press Bar (CT-1)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/pressure_2", tagName: "MTR-2 Press Bar (CT-2)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/pressure_3", tagName: "MTR-3 Press Bar (CT-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_press_du03", tagName: "MTR-4 Press Bar (DU-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_press_bp03", tagName: "MTR-5 Press Bar (BP-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_press_prep03", tagName: "MTR-6 Press Bar (SP-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_press_st03", tagName: "MTR-7 Press Bar (ST-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_press_washing", tagName: "MTR-8 Press Bar (WASHING)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_press_minilab", tagName: "MTR-9 Press Bar (MINI LAB)", url: defaultUrl, unit: "BAR" },

    // Part: Makeup Water
    { tagKey: "cooling-water/makeup_wtr_tds", tagName: "Makeup Water TDS", url: defaultUrl, unit: "µS/cm" },
    { tagKey: "cooling-water/makeup_wtr_ph", tagName: "Makeup Water pH", url: defaultUrl, unit: "pH" },
    { tagKey: "cooling-water/makeup_wtr_flow", tagName: "Makeup Water Flow Rate", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/makeup_wtr_vol", tagName: "Makeup Water VOL", url: defaultUrl, unit: "L/h" },

    // Part: Cooling Tank
    { tagKey: "cooling-water/basin_lvl", tagName: "Cooling Tank Water Level", url: defaultUrl, unit: "%" },
    { tagKey: "cooling-water/cooling_tank_tds", tagName: "Cooling Tank TDS", url: defaultUrl, unit: "µS/cm" },
    { tagKey: "cooling-water/cooling_tank_ph", tagName: "Cooling Tank pH", url: defaultUrl, unit: "pH" },
    { tagKey: "cooling-water/supply_wtr_cond", tagName: "Cooling Tank Conductivity", url: defaultUrl, unit: "µS/cm" },

    // Part: Chemical 357
    { tagKey: "cooling-water/chemical_357_lvl", tagName: "Chemical 357 Level", url: defaultUrl, unit: "%" },
    { tagKey: "cooling-water/chemical_357_pump", tagName: "Chemical 357 Pump Status", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/chemical_357_vol", tagName: "Chemical 357 Volume", url: defaultUrl, unit: "L" },

    // Part: Chemical 327/317
    { tagKey: "cooling-water/chemical_327_lvl", tagName: "Chemical 327/317 Level", url: defaultUrl, unit: "%" },
    { tagKey: "cooling-water/chemical_327_pump", tagName: "Chemical 327/317 Pump Status", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/chemical_327_vol", tagName: "Chemical 327/317 Volume", url: defaultUrl, unit: "L" },

    // ST-3 Return Temp / Process
    { tagKey: "cooling-water/st3_return_temp", tagName: "ST-3 Return Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/eq_temp_st03_supply", tagName: "ST-3 Supply Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/st3_heating", tagName: "ST-3 Heating Status", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/st3_cooling", tagName: "ST-3 Cooling Status", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/st3_steril", tagName: "ST-3 Steril Status", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/jumo_pieces", tagName: "Jumo Pieces (LOT)", url: defaultUrl, unit: "pcs" },

    // Part: Additional Dashboard Metrics
    { tagKey: "cooling-water/ct_efficiency", tagName: "Cooling Tower Efficiency", url: defaultUrl, unit: "%" },
    { tagKey: "cooling-water/total_energy", tagName: "Total Energy Consumption", url: defaultUrl, unit: "kWh" },

    // Part: Cooling Tower 1 details
    { tagKey: "cooling-water/fan_status_1", tagName: "CT-1 Fan Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/ct1_fan_speed", tagName: "CT-1 Fan Speed", url: defaultUrl, unit: "RPM" },
    { tagKey: "cooling-water/motor_status_1", tagName: "CT-1 Motor Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/ct1_motor_current", tagName: "CT-1 Motor Current (Fan)", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/ct1_sirk_current", tagName: "CT-1 Motor Current (Sirkulasi)", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/ct1_motor_power", tagName: "CT-1 Motor Power", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/ct1_flow", tagName: "CT-1 Flow Rate", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/ct1_vibra_fan", tagName: "CT-1 Vibration Fan", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/ct1_vibra_motor", tagName: "CT-1 Vibration Motor Sirk", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/ct1_basin_temp", tagName: "CT-1 Basin Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/ct1_running_hours", tagName: "CT-1 Running Hours", url: defaultUrl, unit: "hrs" },

    // Part: Cooling Tower 2 details
    { tagKey: "cooling-water/fan_status_2", tagName: "CT-2 Fan Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/ct2_fan_speed", tagName: "CT-2 Fan Speed", url: defaultUrl, unit: "RPM" },
    { tagKey: "cooling-water/motor_status_2", tagName: "CT-2 Motor Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/ct2_motor_current", tagName: "CT-2 Motor Current (Fan)", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/ct2_sirk_current", tagName: "CT-2 Motor Current (Sirkulasi)", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/ct2_motor_power", tagName: "CT-2 Motor Power", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/ct2_flow", tagName: "CT-2 Flow Rate", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/ct2_vibra_fan", tagName: "CT-2 Vibration Fan", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/ct2_vibra_motor", tagName: "CT-2 Vibration Motor Sirk", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/ct2_basin_temp", tagName: "CT-2 Basin Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/ct2_running_hours", tagName: "CT-2 Running Hours", url: defaultUrl, unit: "hrs" },

    // Part: Cooling Tower 3 details
    { tagKey: "cooling-water/fan_status_3", tagName: "CT-3 Fan Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/ct3_fan_speed", tagName: "CT-3 Fan Speed", url: defaultUrl, unit: "RPM" },
    { tagKey: "cooling-water/motor_status_3", tagName: "CT-3 Motor Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/ct3_motor_current", tagName: "CT-3 Motor Current (Fan)", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/ct3_sirk_current", tagName: "CT-3 Motor Current (Sirkulasi)", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/ct3_motor_power", tagName: "CT-3 Motor Power", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/ct3_flow", tagName: "CT-3 Flow Rate", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/ct3_vibra_fan", tagName: "CT-3 Vibration Fan", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/ct3_vibra_motor", tagName: "CT-3 Vibration Motor Sirk", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/ct3_basin_temp", tagName: "CT-3 Basin Temp", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/ct3_running_hours", tagName: "CT-3 Running Hours", url: defaultUrl, unit: "hrs" },

    // Part: Additional Tanks & Water details
    { tagKey: "cooling-water/dosing_a_status", tagName: "Dosing Pump A Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/dosing_a_flow", tagName: "Dosing Pump A Flow Rate", url: defaultUrl, unit: "L/h" },
    { tagKey: "cooling-water/dosing_a_hrs", tagName: "Dosing Pump A Run Hours", url: defaultUrl, unit: "h" },
    { tagKey: "cooling-water/dosing_a_cons", tagName: "Dosing Pump A Daily Cons", url: defaultUrl, unit: "L/d" },
    { tagKey: "cooling-water/dosing_b_status", tagName: "Dosing Pump B Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/dosing_b_flow", tagName: "Dosing Pump B Flow Rate", url: defaultUrl, unit: "L/h" },
    { tagKey: "cooling-water/dosing_b_hrs", tagName: "Dosing Pump B Run Hours", url: defaultUrl, unit: "h" },
    { tagKey: "cooling-water/dosing_b_cons", tagName: "Dosing Pump B Daily Cons", url: defaultUrl, unit: "L/d" },
    { tagKey: "cooling-water/blowdown_status", tagName: "Blowdown Operation Status (ON/OFF)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/blowdown_flow", tagName: "Blowdown Flow Rate", url: defaultUrl, unit: "L/h" },
    { tagKey: "cooling-water/blowdown_vol", tagName: "Blowdown Accumulated Volume", url: defaultUrl, unit: "m³" },

    // Part: Motor 1, 2, 3 Extra parameters
    { tagKey: "cooling-water/mtr1_running_hours", tagName: "MTR-1 Running Hours", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/mtr1_hz", tagName: "MTR-1 Frequency", url: defaultUrl, unit: "Hz" },
    { tagKey: "cooling-water/mtr1_kw", tagName: "MTR-1 Power", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/mtr2_running_hours", tagName: "MTR-2 Running Hours", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/mtr2_hz", tagName: "MTR-2 Frequency", url: defaultUrl, unit: "Hz" },
    { tagKey: "cooling-water/mtr2_kw", tagName: "MTR-2 Power", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/mtr3_running_hours", tagName: "MTR-3 Running Hours", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/mtr3_hz", tagName: "MTR-3 Frequency", url: defaultUrl, unit: "Hz" },
    { tagKey: "cooling-water/mtr3_kw", tagName: "MTR-3 Power", url: defaultUrl, unit: "kW" },

    // Part: Equipment Status Matrix details
    { tagKey: "cooling-water/eq_status_du03", tagName: "MTR-4 Status (DU-3) (Running/Stopped)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/eq_flow_du03", tagName: "MTR-4 Flow DU-3", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/eq_press_du03", tagName: "MTR-4 Press Bar (DU-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_curr_du03", tagName: "MTR-4 Current DU-3", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/eq_pow_du03", tagName: "MTR-4 Power DU-3", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/eq_vib_du03", tagName: "MTR-4 Vibration DU-3", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/eq_temp_du03", tagName: "MTR-4 Temp DU-3", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/eq_hrs_du03", tagName: "MTR-4 Run Hours DU-3", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/eq_maint_du03", tagName: "MTR-4 Maint Status DU-3", url: defaultUrl, unit: "status" },

    { tagKey: "cooling-water/eq_status_bp03", tagName: "MTR-5 Status (BP-3) (Running/Stopped)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/eq_flow_bp03", tagName: "MTR-5 Flow BP-3", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/eq_press_bp03", tagName: "MTR-5 Press Bar (BP-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_curr_bp03", tagName: "MTR-5 Current BP-3", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/eq_pow_bp03", tagName: "MTR-5 Power BP-3", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/eq_vib_bp03", tagName: "MTR-5 Vibration BP-3", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/eq_temp_bp03", tagName: "MTR-5 Temp BP-3", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/eq_hrs_bp03", tagName: "MTR-5 Run Hours BP-3", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/eq_maint_bp03", tagName: "MTR-5 Maint Status BP-3", url: defaultUrl, unit: "status" },

    { tagKey: "cooling-water/eq_status_prep03", tagName: "MTR-6 Status (SP-3) (Running/Stopped)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/eq_flow_prep03", tagName: "MTR-6 Flow SP-3", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/eq_press_prep03", tagName: "MTR-6 Press Bar (SP-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_curr_prep03", tagName: "MTR-6 Current SP-3", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/eq_pow_prep03", tagName: "MTR-6 Power SP-3", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/eq_vib_prep03", tagName: "MTR-6 Vibration SP-3", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/eq_temp_prep03", tagName: "MTR-6 Temp SP-3", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/eq_hrs_prep03", tagName: "MTR-6 Run Hours SP-3", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/eq_maint_prep03", tagName: "MTR-6 Maint Status SP-3", url: defaultUrl, unit: "status" },

    { tagKey: "cooling-water/eq_status_st03", tagName: "MTR-7 Status (ST-3) (Running/Stopped)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/eq_flow_st03", tagName: "MTR-7 Flow ST-3", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/eq_press_st03", tagName: "MTR-7 Press Bar (ST-3)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_curr_st03", tagName: "MTR-7 Current ST-3", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/eq_pow_st03", tagName: "MTR-7 Power ST-3", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/eq_vib_st03", tagName: "MTR-7 Vibration ST-3", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/eq_temp_st03", tagName: "MTR-7 Temp ST-3", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/eq_hrs_st03", tagName: "MTR-7 Run Hours ST-3", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/eq_maint_st03", tagName: "MTR-7 Maint Status ST-3", url: defaultUrl, unit: "status" },

    { tagKey: "cooling-water/eq_status_washing", tagName: "MTR-8 Status (WASHING) (Running/Stopped)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/eq_flow_washing", tagName: "MTR-8 Flow WASHING", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/eq_press_washing", tagName: "MTR-8 Press Bar (WASHING)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_curr_washing", tagName: "MTR-8 Current WASHING", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/eq_pow_washing", tagName: "MTR-8 Power WASHING", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/eq_vib_washing", tagName: "MTR-8 Vibration WASHING", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/eq_temp_washing", tagName: "MTR-8 Temp WASHING", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/eq_hrs_washing", tagName: "MTR-8 Run Hours WASHING", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/eq_maint_washing", tagName: "MTR-8 Maint Status WASHING", url: defaultUrl, unit: "status" },

    { tagKey: "cooling-water/eq_status_minilab", tagName: "MTR-9 Status (MINI LAB) (Running/Stopped)", url: defaultUrl, unit: "status" },
    { tagKey: "cooling-water/eq_flow_minilab", tagName: "MTR-9 Flow MINI LAB", url: defaultUrl, unit: "m³/h" },
    { tagKey: "cooling-water/eq_press_minilab", tagName: "MTR-9 Press Bar (MINI LAB)", url: defaultUrl, unit: "BAR" },
    { tagKey: "cooling-water/eq_curr_minilab", tagName: "MTR-9 Current MINI LAB", url: defaultUrl, unit: "A" },
    { tagKey: "cooling-water/eq_pow_minilab", tagName: "MTR-9 Power MINI LAB", url: defaultUrl, unit: "kW" },
    { tagKey: "cooling-water/eq_vib_minilab", tagName: "MTR-9 Vibration MINI LAB", url: defaultUrl, unit: "mm/s" },
    { tagKey: "cooling-water/eq_temp_minilab", tagName: "MTR-9 Temp MINI LAB", url: defaultUrl, unit: "°C" },
    { tagKey: "cooling-water/eq_hrs_minilab", tagName: "MTR-9 Run Hours MINI LAB", url: defaultUrl, unit: "hrs" },
    { tagKey: "cooling-water/eq_maint_minilab", tagName: "MTR-9 Maint Status MINI LAB", url: defaultUrl, unit: "status" }
  ];
};

const getEqDisplayTagKey = (tagKey: string) => {
  switch(tagKey) {
    case "F1_MOTOR_OVERHAUL": return "FAN-CT-1";
    case "F2_MOTOR_OVERHAUL": return "FAN-CT-2";
    case "F3_MOTOR_OVERHAUL": return "FAN-CT-3";
    case "M1_PUMP_MOTOR_OVERHAUL": return "MTR-PUMP-1";
    case "M2_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-2";
    case "M3_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-3";
    case "M4_PUMP_MOTOR_OVERHAUL": return "MTR-PUMP-4";
    case "M5_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-5";
    case "M6_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-6";
    case "M7_PUMP_MOTOR_OVERHAUL": return "MTR-PUMP-7";
    case "M8_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-8";
    case "M9_SUPPLY_MOTOR_OVERHAUL": return "MTR-PUMP-9";
    default: return tagKey;
  }
};

const PID_EQ_TAG_KEYS = [
  "F1_MOTOR_OVERHAUL",
  "F2_MOTOR_OVERHAUL",
  "F3_MOTOR_OVERHAUL",
  "M1_PUMP_MOTOR_OVERHAUL",
  "M2_SUPPLY_MOTOR_OVERHAUL",
  "M3_SUPPLY_MOTOR_OVERHAUL",
  "M4_PUMP_MOTOR_OVERHAUL",
  "M5_SUPPLY_MOTOR_OVERHAUL",
  "M6_SUPPLY_MOTOR_OVERHAUL",
  "M7_PUMP_MOTOR_OVERHAUL",
  "M8_SUPPLY_MOTOR_OVERHAUL",
  "M9_SUPPLY_MOTOR_OVERHAUL"
];

const TAG_KEY_TO_API_JSON_KEY: Record<string, string> = {
  // Main
  "cooling-water/supply_temp": "Scaled_Temp_Tank_Cooling3_Supp",
  "cooling-water/return_temp": "Scaled_Temp_Tank_Cooling3_Return",
  "cooling-water/delta_temp": "delta_temp",
  "cooling-water/ambient_temp": "Scaled_Temp_Washing",
  "cooling-water/ambient_humidity": "Scaled_Level_tank_cooling3",
  "cooling-water/ct_efficiency": "Scaled_Level_tank_cooling3",
  "cooling-water/total_energy": "Scaled_Level_tank_cooling3",

  // CT-1
  "cooling-water/fan_status_1": "Status_Fan_CT1",
  "cooling-water/ct1_fan_speed": "Scaled_Level_tank_cooling3",
  "cooling-water/motor_status_1": "Status_MTR_CT_P1",
  "cooling-water/ct1_motor_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_sirk_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_motor_power": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/pressure_1": "Scaled_Press_CT_P1",
  "cooling-water/ct1_vibra_fan": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_vibra_motor": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_basin_temp": "Scaled_Level_tank_cooling3",
  "cooling-water/ct1_running_hours": "Scaled_Level_tank_cooling3",

  // CT-2
  "cooling-water/fan_status_2": "Status_Fan_CT2",
  "cooling-water/ct2_fan_speed": "Scaled_Level_tank_cooling3",
  "cooling-water/motor_status_2": "Status_MTR_CT_P2",
  "cooling-water/ct2_motor_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_sirk_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_motor_power": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/pressure_2": "Scaled_Press_CT_P2",
  "cooling-water/ct2_vibra_fan": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_vibra_motor": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_basin_temp": "Scaled_Level_tank_cooling3",
  "cooling-water/ct2_running_hours": "Scaled_Level_tank_cooling3",

  // CT-3
  "cooling-water/fan_status_3": "Status_Fan_CT3",
  "cooling-water/ct3_fan_speed": "Scaled_Level_tank_cooling3",
  "cooling-water/motor_status_3": "Status_MTR_CT_P11",
  "cooling-water/ct3_motor_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_sirk_current": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_motor_power": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/pressure_3": "Scaled_Press_CT3_P11",
  "cooling-water/ct3_vibra_fan": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_vibra_motor": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_basin_temp": "Scaled_Level_tank_cooling3",
  "cooling-water/ct3_running_hours": "Scaled_Level_tank_cooling3",

  // Tanks & Dosing
  "cooling-water/cooling_tank_tds": "Scaled_Level_tank_cooling3",
  "cooling-water/cooling_tank_ph": "Scaled_Level_tank_cooling3",
  "cooling-water/supply_wtr_cond": "Scaled_Level_tank_cooling3",
  "cooling-water/basin_lvl": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_ph": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_tds": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/makeup_wtr_vol": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_357_pump": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_357_lvl": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_357_vol": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_327_pump": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_327_lvl": "Scaled_Level_tank_cooling3",
  "cooling-water/chemical_327_vol": "Scaled_Level_tank_cooling3",
  "cooling-water/blowdown_status": "Scaled_Level_tank_cooling3",
  "cooling-water/blowdown_flow": "Scaled_Level_tank_cooling3",
  "cooling-water/blowdown_vol": "Scaled_Level_tank_cooling3",

  // ST-3 Return Temp / Process
  "cooling-water/st3_return_temp": "Scaled_Temp_ST3_Return",
  "cooling-water/eq_temp_st03_supply": "Scaled_Temp_ST3_Supply",
  "cooling-water/st3_heating": "Status_Machine__Heating_ST3",
  "cooling-water/st3_cooling": "Status_Machine__Cooling_ST3",
  "cooling-water/st3_steril": "Status_Machine__Steril_ST3",
  "cooling-water/jumo_pieces": "Jumo_Pieces",

  // Motor 1, 2, 3 Extra
  "cooling-water/mtr1_running_hours": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr1_hz": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr1_kw": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr2_running_hours": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr2_hz": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr2_kw": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr3_running_hours": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr3_hz": "Scaled_Level_tank_cooling3",
  "cooling-water/mtr3_kw": "Scaled_Level_tank_cooling3",

  // Equipment Status Matrix details
  "cooling-water/eq_status_du03": "Status_MTR_DU45",
  "cooling-water/eq_flow_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_du03": "Scaled_Press_DUU3",
  "cooling-water/eq_curr_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_du03": "Scaled_Temp_DU",
  "cooling-water/eq_hrs_du03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_du03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_bp03": "Status_MTR_BP",
  "cooling-water/eq_flow_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_bp03": "Scaled_Press_BP",
  "cooling-water/eq_curr_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_hrs_bp03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_bp03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_prep03": "Status_MTR_Prep3",
  "cooling-water/eq_flow_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_prep03": "Scaled_Press_PrepU3",
  "cooling-water/eq_curr_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_prep03": "Scaled_Tempt_Prep3_Return",
  "cooling-water/eq_hrs_prep03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_prep03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_st03": "Status_MTR_ST3_P3",
  "cooling-water/eq_flow_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_st03": "Scaled_Press_ST3",
  "cooling-water/eq_curr_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_hrs_st03": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_st03": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_washing": "Status_MTR_Washing",
  "cooling-water/eq_flow_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_washing": "Scaled_Press_Washing",
  "cooling-water/eq_curr_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_washing": "Scaled_Temp_Washing",
  "cooling-water/eq_hrs_washing": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_washing": "Scaled_Level_tank_cooling3",

  "cooling-water/eq_status_minilab": "Status_MTR_MiniLab",
  "cooling-water/eq_flow_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_press_minilab": "Scaled_Press_MiniLab",
  "cooling-water/eq_curr_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_pow_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_vib_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_temp_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_hrs_minilab": "Scaled_Level_tank_cooling3",
  "cooling-water/eq_maint_minilab": "Scaled_Level_tank_cooling3"
};

const DEFAULT_TASK_RULES = [
  { id: "1", motorKey: "FAN-CT-1", targetHours: 150, taskName: "F-1 V-Belt Tension" },
  { id: "2", motorKey: "FAN-CT-1", targetHours: 420, taskName: "F-1 Fan & Motor Visual Inspection" },
  { id: "3", motorKey: "FAN-CT-1", targetHours: 810, taskName: "F-1 Fan Shaft Bearing Lubrication" },
  { id: "4", motorKey: "FAN-CT-1", targetHours: 3200, taskName: "F-1 V-Belt Replacement" },
  { id: "5", motorKey: "FAN-CT-1", targetHours: 4600, taskName: "F-1 Motor & Reducer Grease/Bearing" },
  { id: "6", motorKey: "FAN-CT-1", targetHours: 10000, taskName: "FAN-CT-1 Direct Drive Motor Overhaul" },

  { id: "7", motorKey: "MTR-PUMP-1", targetHours: 180, taskName: "P-1 Strainer Cleanliness Inspection" },
  { id: "8", motorKey: "MTR-PUMP-1", targetHours: 520, taskName: "P-1 Strainer Cleaning" },
  { id: "9", motorKey: "MTR-PUMP-1", targetHours: 750, taskName: "P-1 Pump Bearing Lubrication" },
  { id: "10", motorKey: "MTR-PUMP-1", targetHours: 1200, taskName: "P-1 Pump Seal & Leakage Inspection" },
  { id: "11", motorKey: "MTR-PUMP-1", targetHours: 2500, taskName: "P-1 Pump Overhaul Major & Descaling" },
  { id: "12", motorKey: "MTR-PUMP-1", targetHours: 10000, taskName: "MTR-PUMP-1 Pump Motor Overhaul/Bearing" },

  { id: "13", motorKey: "MTR-PUMP-2", targetHours: 10000, taskName: "MTR-PUMP-2 Supply Motor 1 Overhaul/Bearing" },
  { id: "14", motorKey: "MTR-PUMP-3", targetHours: 10000, taskName: "MTR-PUMP-3 Supply Motor 2 Overhaul/Bearing" }
];

export default function MachineConfig() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);

  const isCoolingTower = unitId === "cooling-water-1" || unitId === "cooling-water-2" || unitId === "cooling-water-3";

  if (unitId === "hvac-qc-retained-sample") {
    return <HvacConfigConsole unitId={unitId} machine={machine} />;
  }

  // Tabs for the configuration categories
  const [configTab, setConfigTab] = useState<"sensors" | "equipment" | "api-sources">("sensors");
  const [eqSubTab, setEqSubTab] = useState<"pid" | "preventive">("pid");

  const [sensorRows, setSensorRows] = useState<ConfigTagRow[]>([]);
  const [eqRows, setEqRows] = useState<ConfigEqRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSensorRows = useMemo(() => {
    if (!searchQuery.trim()) return sensorRows;
    const q = searchQuery.toLowerCase();
    return sensorRows.filter(
      (s) =>
        s.tagName.toLowerCase().includes(q) ||
        s.tagKey.toLowerCase().includes(q)
    );
  }, [sensorRows, searchQuery]);

  const [apiSourceRows, setApiSourceRows] = useState<ApiSourceRow[]>(() => {
    const savedList = localStorage.getItem(`scada.config.api_sources_list.${unitId}`);
    if (savedList) {
      try {
        return JSON.parse(savedList);
      } catch (e) {}
    }
    const defaults = getDefaultApiSourceConfigs(unitId);
    const savedUrlsStr = localStorage.getItem(`scada.config.api_sources.${unitId}`);
    if (savedUrlsStr) {
      try {
        const savedUrls = JSON.parse(savedUrlsStr);
        return defaults.map(d => ({
          ...d,
          url: savedUrls[d.tagKey] !== undefined ? savedUrls[d.tagKey] : d.url
        }));
      } catch (e) {}
    }
    return defaults;
  });

  const apiSourceUrls = useMemo(() => {
    const map: Record<string, string> = {};
    apiSourceRows.forEach((r) => {
      map[r.tagKey] = r.url;
    });
    return map;
  }, [apiSourceRows]);

  const filteredApiSourceRows = useMemo(() => {
    if (!searchQuery.trim()) return apiSourceRows;
    const q = searchQuery.toLowerCase();
    return apiSourceRows.filter(
      (s) =>
        s.tagName.toLowerCase().includes(q) ||
        s.tagKey.toLowerCase().includes(q)
    );
  }, [apiSourceRows, searchQuery]);

  const handleApiSourceTagKeyChange = (idx: number, value: string) => {
    setApiSourceRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], tagKey: value };
      return next;
    });
  };

  const handleApiSourceTagNameChange = (idx: number, value: string) => {
    setApiSourceRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], tagName: value };
      return next;
    });
  };

  const handleApiSourceUnitChange = (idx: number, value: string) => {
    setApiSourceRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], unit: value };
      return next;
    });
  };

  const handleApiSourceUrlChange = (idx: number, value: string) => {
    setApiSourceRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], url: value };
      return next;
    });
  };

  const handleDeleteApiSourceRow = (idx: number) => {
    setDeleteTarget({ type: "api-source", apiIdx: idx });
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("delete");
    setShowPasswordModal(true);
  };

  const handleAddApiSourceRow = () => {
    setApiSourceRows((prev) => [
      ...prev,
      {
        tagKey: `cooling-water/new_api_tag_${Date.now()}`,
        tagName: "New API Source",
        url: "",
        unit: ""
      }
    ]);
  };

  const handleResetApiSourcesToDefault = () => {
    if (window.confirm("Apakah Anda yakin ingin menyetel ulang seluruh API Sources ke data default? Tindakan ini akan menimpa perubahan Anda saat ini.")) {
      setApiSourceRows(getDefaultApiSourceConfigs(unitId));
    }
  };

  const [apiLiveData, setApiLiveData] = useState<Record<string, any>>({});

  useEffect(() => {
    setSearchQuery("");
  }, [configTab]);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveApiData = async () => {
      const activeUrls = Object.values(apiSourceUrls).filter((u) => u.trim());
      if (activeUrls.length === 0) return;
      const targetUrl = activeUrls[0];
      try {
        const res = await postJson<{ success: boolean; data?: any }>("/config/api-sources/test", {
          url: targetUrl,
          method: "GET"
        });
        if (isMounted && res && res.success && res.data) {
          setApiLiveData(res.data);
        }
      } catch (err) {
        console.error("Live API poll error:", err);
      }
    };

    fetchActiveApiData();
    const interval = setInterval(fetchActiveApiData, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiSourceUrls]);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [eqTaskConfigs, setEqTaskConfigs] = useState<{
    itemKey: string;
    displayName: string;
    rules: { targetHours: number; warningHours: number; tasks: string[] }[];
  }[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleItemExpand = (itemKey: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  const handleAddRule = (itemKey: string) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        return {
          ...config,
          rules: [
            ...config.rules,
            { targetHours: 1000, warningHours: 168, tasks: [""] }
          ]
        };
      })
    );
  };

  const handleUpdateRuleHours = (itemKey: string, ruleIdx: number, hoursVal: string) => {
    const hours = hoursVal === "" ? 0 : parseFloat(hoursVal);
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          targetHours: isNaN(hours) ? nextRules[ruleIdx].targetHours : hours
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleUpdateWarningHours = (itemKey: string, ruleIdx: number, warnVal: string) => {
    const warn = warnVal === "" ? 0 : parseFloat(warnVal);
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          warningHours: isNaN(warn) ? nextRules[ruleIdx].warningHours : warn
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleDeleteRule = (itemKey: string, ruleIdx: number) => {
    setDeleteTarget({ type: "preventive-rule", itemKey, ruleIdx });
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("delete");
    setShowPasswordModal(true);
  };

  const handleAddTaskDesc = (itemKey: string, ruleIdx: number) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          tasks: [...nextRules[ruleIdx].tasks, ""]
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleUpdateTaskDesc = (itemKey: string, ruleIdx: number, taskIdx: number, val: string) => {
    setEqTaskConfigs((prev) =>
      prev.map((config) => {
        if (config.itemKey !== itemKey) return config;
        const nextRules = [...config.rules];
        const nextTasks = [...nextRules[ruleIdx].tasks];
        nextTasks[taskIdx] = val;
        nextRules[ruleIdx] = {
          ...nextRules[ruleIdx],
          tasks: nextTasks
        };
        return { ...config, rules: nextRules };
      })
    );
  };

  const handleDeleteTaskDesc = (itemKey: string, ruleIdx: number, taskIdx: number) => {
    setDeleteTarget({ type: "preventive-task", itemKey, ruleIdx, taskIdx });
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("delete");
    setShowPasswordModal(true);
  };

  const handleAddEqTaskConfig = () => {
    setEqTaskConfigs((prev) => [
      ...prev,
      {
        itemKey: `NEW_EQ_${Date.now()}`,
        displayName: "New Equipment Maintenance",
        rules: [
          { targetHours: 1000, warningHours: 168, tasks: ["Lakukan inspeksi visual"] }
        ]
      }
    ]);
  };

  const handleDeleteEqTaskConfig = (itemKey: string, displayName: string) => {
    setDeleteTarget({ type: "preventive-category", itemKey, displayName });
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("delete");
    setShowPasswordModal(true);
  };

  const [successMsg, setSuccessMsg] = useState(false);

  const handleSensorSelectChange = (tagKey: string, field: "direction", value: "above" | "below") => {
    setSensorRows((prev) => {
      const idx = prev.findIndex((r) => r.tagKey === tagKey);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: value
      };
      return next;
    });
  };

  const handleDeleteSensorRow = (tagKey: string) => {
    setDeleteTarget({ type: "sensor", sensorTagKey: tagKey });
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("delete");
    setShowPasswordModal(true);
  };

  const handleSensorTagKeyChange = (oldTagKey: string, newTagKey: string) => {
    setSensorRows((prev) =>
      prev.map((r) => (r.tagKey === oldTagKey ? { ...r, tagKey: newTagKey } : r))
    );
  };

  const handleSensorTagNameChange = (tagKey: string, newTagName: string) => {
    setSensorRows((prev) =>
      prev.map((r) => (r.tagKey === tagKey ? { ...r, tagName: newTagName } : r))
    );
  };

  const handleSensorUnitChange = (tagKey: string, newUnit: string) => {
    setSensorRows((prev) =>
      prev.map((r) => (r.tagKey === tagKey ? { ...r, unit: newUnit } : r))
    );
  };

  const handleAddSensorRow = () => {
    setSensorRows((prev) => [
      ...prev,
      {
        tagKey: `cooling-water/new_parameter_${Date.now()}`,
        tagName: "New Parameter Name",
        lowLimit: 0,
        baseline: 0,
        highLimit: 0,
        unit: "°C",
        enableAlert: true,
        suppressAlert: false,
        direction: "above"
      }
    ]);
  };

  const handleResetSensorsToDefault = () => {
    if (window.confirm("Apakah Anda yakin ingin menyetel ulang seluruh parameter sensor ke 105 data default? Tindakan ini akan menimpa perubahan Anda saat ini.")) {
      setSensorRows(getDefaultSensorConfigs(unitId));
    }
  };

  // Load configuration from localStorage or defaults
  useEffect(() => {
    // Sensor parameters load
    getJson<{ data: ConfigTagRow[] }>(`/config/sensor-rules?unitId=${unitId}`)
      .then((res) => {
        if (res && res.data && res.data.length > 0) {
          setSensorRows(res.data);
        } else {
          const defaults = getDefaultSensorConfigs(unitId);
          setSensorRows(defaults);
          postJson("/config/sensor-rules", { unitId, rules: defaults }).catch(err =>
            console.error("Failed to auto-save default sensor rules:", err)
          );
        }
      })
      .catch((err) => {
        console.error("Failed to load sensor rules:", err);
        setSensorRows(getDefaultSensorConfigs(unitId));
      });

    // Equipment configurations load
    if (isCoolingTower) {
      getJson<{ data: any[] }>("/config/rh-task-rules")
        .then((res) => {
          if (res && res.data) {
            setEqTaskConfigs(res.data);
          }
        })
        .catch((err) => console.error("Failed to load task rules:", err));
    } else {
      // standard machines load eqRows
      const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
      if (savedEq) {
        try {
          setEqRows(JSON.parse(savedEq));
        } catch (e) {
          setEqRows(getDefaultEqConfigs(unitId));
        }
      } else {
        setEqRows(getDefaultEqConfigs(unitId));
      }
      setConfigTab("sensors");
    }
  }, [unitId, isCoolingTower]);

  // Handle number input changes for sensors
  const handleSensorNumChange = (tagKey: string, field: "lowLimit" | "baseline" | "highLimit", value: string) => {
    const parsedVal = value === "" ? 0 : parseFloat(value);
    setSensorRows((prev) => {
      const idx = prev.findIndex((r) => r.tagKey === tagKey);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: isNaN(parsedVal) ? next[idx][field] : parsedVal
      };
      return next;
    });
  };

  // Handle check changes for sensors
  const handleSensorCheckChange = (tagKey: string, field: "enableAlert" | "suppressAlert") => {
    setSensorRows((prev) => {
      const idx = prev.findIndex((r) => r.tagKey === tagKey);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: !next[idx][field]
      };
      return next;
    });
  };

  // Handle number changes for equipment
  const handleEqNumChange = (index: number, field: "lowLimit" | "baseline" | "highLimit", value: string) => {
    const parsedVal = value === "" ? 0 : parseFloat(value);
    setEqRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: isNaN(parsedVal) ? next[index][field] : parsedVal
      };
      return next;
    });
  };

  // Handle check changes for equipment
  const handleEqCheckChange = (index: number, field: "enableAlert" | "suppressAlert") => {
    setEqRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: !next[index][field]
      };
      return next;
    });
  };

  const handleDeleteEqRow = (idx: number) => {
    setDeleteTarget({ type: "eq-row", eqIdx: idx });
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("delete");
    setShowPasswordModal(true);
  };

  const handleEqTagKeyChange = (idx: number, value: string) => {
    setEqRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], tagKey: value };
      return next;
    });
  };

  const handleEqTagNameChange = (idx: number, value: string) => {
    setEqRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], tagName: value };
      return next;
    });
  };

  const handleAddEqRow = () => {
    setEqRows((prev) => [
      ...prev,
      {
        tagKey: `M10_MOTOR_OVERHAUL`,
        tagName: "New Equipment Maintenance",
        baseline: 0,
        lowLimit: 0,
        highLimit: 10000,
        unit: "hours",
        enableAlert: true,
        suppressAlert: false,
        status: "—"
      }
    ]);
  };

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordAction, setPasswordAction] = useState<"unlock" | "save" | "delete" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "sensor" | "api-source" | "eq-row" | "preventive-rule" | "preventive-task" | "preventive-category";
    sensorTagKey?: string;
    apiIdx?: number;
    eqIdx?: number;
    itemKey?: string;
    ruleIdx?: number;
    taskIdx?: number;
    displayName?: string;
  } | null>(null);

  // Trigger password prompt to unlock
  const triggerUnlock = () => {
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("unlock");
    setShowPasswordModal(true);
  };

  // Trigger password prompt to save
  const handleSaveTrigger = () => {
    setPasswordInput("");
    setPasswordError("");
    setPasswordAction("save");
    setShowPasswordModal(true);
  };

  // Confirm password and execute action (unlock or save)
  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setPasswordError("Password wajib diisi.");
      return;
    }
    setVerifyingPassword(true);
    setPasswordError("");

    try {
      const res = await postJson<{ valid: boolean }>("/auth/verify-password", { password: passwordInput });
      if (res && res.valid) {
        if (passwordAction === "unlock") {
          setIsUnlocked(true);
          setShowPasswordModal(false);
        } else if (passwordAction === "delete" && deleteTarget) {
          if (deleteTarget.type === "sensor" && deleteTarget.sensorTagKey) {
            setSensorRows((prev) => prev.filter((r) => r.tagKey !== deleteTarget.sensorTagKey));
          } else if (deleteTarget.type === "api-source" && deleteTarget.apiIdx !== undefined) {
            setApiSourceRows((prev) => prev.filter((_, i) => i !== deleteTarget.apiIdx));
          } else if (deleteTarget.type === "eq-row" && deleteTarget.eqIdx !== undefined) {
            setEqRows((prev) => prev.filter((_, i) => i !== deleteTarget.eqIdx));
          } else if (deleteTarget.type === "preventive-rule" && deleteTarget.itemKey && deleteTarget.ruleIdx !== undefined) {
            setEqTaskConfigs((prev) =>
              prev.map((config) => {
                if (config.itemKey !== deleteTarget.itemKey) return config;
                return {
                  ...config,
                  rules: config.rules.filter((_, idx) => idx !== deleteTarget.ruleIdx)
                };
              })
            );
          } else if (deleteTarget.type === "preventive-task" && deleteTarget.itemKey && deleteTarget.ruleIdx !== undefined && deleteTarget.taskIdx !== undefined) {
            setEqTaskConfigs((prev) =>
              prev.map((config) => {
                if (config.itemKey !== deleteTarget.itemKey) return config;
                const nextRules = [...config.rules];
                nextRules[deleteTarget.ruleIdx!] = {
                  ...nextRules[deleteTarget.ruleIdx!],
                  tasks: nextRules[deleteTarget.ruleIdx!].tasks.filter((_, idx) => idx !== deleteTarget.taskIdx)
                };
                return { ...config, rules: nextRules };
              })
            );
          } else if (deleteTarget.type === "preventive-category" && deleteTarget.itemKey) {
            setEqTaskConfigs((prev) => prev.filter((c) => c.itemKey !== deleteTarget.itemKey));
          }

          setDeleteTarget(null);
          setShowPasswordModal(false);
        } else {
          // Save API sources map to localStorage and backend
          localStorage.setItem(`scada.config.api_sources.${unitId}`, JSON.stringify(apiSourceUrls));
          localStorage.setItem(`scada.config.api_sources_list.${unitId}`, JSON.stringify(apiSourceRows));
          await postJson("/config/api-sources-map", { unitId, sources: apiSourceUrls }).catch((err) =>
            console.error("Failed to save API sources map to backend:", err)
          );

          if (isCoolingTower) {
            // Save sensor thresholds to backend database
            await postJson("/config/sensor-rules", { unitId, rules: sensorRows });
            localStorage.setItem(`scada.config.${unitId}`, JSON.stringify(sensorRows));
            // Save custom task rules to database!
            await postJson("/config/rh-task-rules", eqTaskConfigs);
            
            // Map to flat rules array for client-side evaluation on P&ID page
            const flatRules: { id: string; motorKey: string; targetHours: number; warningHours: number; taskName: string }[] = [];
            let ruleIdCounter = 1;
            
            const GENERIC_TO_SPECIFIC_MAP: Record<string, string[]> = {
              "FAN": ["FAN-1", "FAN-2", "FAN-3"],
              "MTR": ["MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9"],
              "Dosing Pump": ["Dosing Pump 1", "Dosing Pump 2"],
              "Strainer": ["Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9"],
              "Cooling Tower": ["CT 1", "CT 2", "CT 3"],
              "Cooling Tank": ["Cooling Tank"],
              "Panel": ["Panel"]
            };

            eqTaskConfigs.forEach((config) => {
              const specificKeys = GENERIC_TO_SPECIFIC_MAP[config.itemKey] || [config.itemKey];
              specificKeys.forEach((specKey) => {
                config.rules.forEach((rule) => {
                  rule.tasks.forEach((task) => {
                    if (task.trim()) {
                      flatRules.push({
                        id: String(ruleIdCounter++),
                        motorKey: specKey,
                        targetHours: rule.targetHours,
                        warningHours: rule.warningHours || 168,
                        taskName: task.trim()
                      });
                    }
                  });
                });
              });
            });
            localStorage.setItem("scada.config.rh.tasks", JSON.stringify(flatRules));
          } else {
            await postJson("/config/sensor-rules", { unitId, rules: sensorRows });
            localStorage.setItem(`scada.config.${unitId}`, JSON.stringify(sensorRows));
            localStorage.setItem(`scada.config.eq.${unitId}`, JSON.stringify(eqRows));
          }
          
          // Dispatch event so other listeners (e.g. evaluating thresholds) update immediately
          window.dispatchEvent(new Event("storage"));
          
          setIsUnlocked(false); // Lock it back after save
          setSuccessMsg(true);
          setShowPasswordModal(false);
          setTimeout(() => setSuccessMsg(false), 3000);
        }
      } else {
        setPasswordError("Password salah. Silakan coba lagi.");
      }
    } catch (err) {
      console.error(err);
      setPasswordError("Gagal memverifikasi password. Silakan coba lagi.");
    } finally {
      setVerifyingPassword(false);
    }
  };

  if (!machine) return null;

  return (
    <div className="space-y-6">
      {/* Configuration Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 transition-colors duration-300 backdrop-blur-md">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            Tag Setpoints & Limits Configuration Console
          </h3>
          <p className="text-xs text-[#47729f] dark:text-slate-500">
            Configure alarms setpoints, suppressing parameters, and equipment running hours matching P&ID layouts.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {isUnlocked ? (
            <button
              onClick={() => setIsUnlocked(false)}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 transition duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lock Configuration
            </button>
          ) : (
            <button
              onClick={triggerUnlock}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 transition duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Unlock to Edit
            </button>
          )}

          {successMsg && (
            <span className="text-xs font-bold text-emerald-500 animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              Configuration Saved Successfully!
            </span>
          )}
          <button
            onClick={handleSaveTrigger}
            disabled={!isUnlocked}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-[#1f6fb5] hover:bg-[#155c99] text-white shadow-md shadow-[#1f6fb5]/25 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Configuration
          </button>
        </div>
      </div>      {/* Internal configuration section sub-tabs */}
      {isCoolingTower && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl w-fit">
            <button
              onClick={() => setConfigTab("sensors")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                configTab === "sensors"
                  ? "bg-[#1f6fb5] text-white shadow-sm"
                  : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
              }`}
            >
              Sensor parameters (TDS, pH, Flow, etc.)
            </button>
            <button
              onClick={() => setConfigTab("equipment")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                configTab === "equipment"
                  ? "bg-[#1f6fb5] text-white shadow-sm"
                  : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
              }`}
            >
              Equipment Running Hours (P&ID Specs)
            </button>
            <button
              onClick={() => setConfigTab("api-sources")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                configTab === "api-sources"
                  ? "bg-[#1f6fb5] text-white shadow-sm"
                  : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
              }`}
            >
              API Sources
            </button>
          </div>
        </div>
      )}

      {/* Configuration Inputs Table */}
      {configTab !== "api-sources" && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        {configTab === "equipment" && (
          <div className="mb-4">
            <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">
              Equipment Task Rules Configuration
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Define multiple running hour rules and custom maintenance tasks for each equipment item. Open tasks will populate in the P&ID diagram sidebar.
            </p>
          </div>
        )}
        {configTab === "sensors" && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            {/* Search Input on the Left */}
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Cari tag atau parameter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium"
              />
              <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Reset and Add Buttons on the Right */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={handleResetSensorsToDefault}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-[#0b3b60]/10 hover:bg-[#0b3b60]/20 text-[#0b3b60] dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 shadow-sm transition border border-[#0b3b60]/20 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset ke Parameter Default
              </button>
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={handleAddSensorRow}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tambah Parameter Sensor
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          {configTab === "sensors" ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">SCADA Parameter Tag</th>
                  <th className="pb-3 px-3 text-center w-24">Low Limit</th>
                  <th className="pb-3 px-3 text-center w-28">Baseline Setpoint</th>
                  <th className="pb-3 px-3 text-center w-24">High Limit</th>
                  <th className="pb-3 px-3 text-center w-28">Limit Rule</th>
                  <th className="pb-3 px-3 text-center w-28">Enable Alert</th>
                  <th className="pb-3 px-3 text-center w-28">Suppress Alert</th>
                  <th className="pb-3 px-3 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {filteredSensorRows.map((row) => (
                  <tr key={row.tagKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-4 px-3">
                      {isUnlocked ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={row.tagKey}
                            onChange={(e) => handleSensorTagKeyChange(row.tagKey, e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-blue-500/30 rounded text-xs font-mono text-[#002b5c] dark:text-white outline-none focus:border-blue-500"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={row.tagName}
                              onChange={(e) => handleSensorTagNameChange(row.tagKey, e.target.value)}
                              className="w-full px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-[10px] text-slate-600 dark:text-slate-300 outline-none placeholder:text-slate-400"
                              placeholder="Sensor Name"
                            />
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => handleSensorUnitChange(row.tagKey, e.target.value)}
                              className="w-20 px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-[10px] text-slate-600 dark:text-slate-300 outline-none placeholder:text-slate-400"
                              placeholder="Unit"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="font-bold text-[#002b5c] dark:text-slate-200">{row.tagKey}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{row.tagName} ({row.unit})</div>
                        </>
                      )}
                    </td>
                    
                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          step="0.01"
                          value={row.lowLimit}
                          disabled={!isUnlocked}
                          onChange={(e) => handleSensorNumChange(row.tagKey, "lowLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs disabled:opacity-50"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#acd3ff] dark:border-slate-700 rounded px-2.5 py-1 bg-sky-500/5 dark:bg-slate-900/80 w-28">
                        <input
                          type="number"
                          step="0.01"
                          value={row.baseline}
                          disabled={!isUnlocked}
                          onChange={(e) => handleSensorNumChange(row.tagKey, "baseline", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs text-[#1f6fb5] dark:text-sky-400 disabled:opacity-50"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          step="0.01"
                          value={row.highLimit}
                          disabled={!isUnlocked}
                          onChange={(e) => handleSensorNumChange(row.tagKey, "highLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs disabled:opacity-50"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <select
                        value={row.direction || "above"}
                        disabled={!isUnlocked}
                        onChange={(e) => handleSensorSelectChange(row.tagKey, "direction", e.target.value as "above" | "below")}
                        className="rounded border border-[#acd3ff] dark:border-slate-800 bg-transparent text-[#002b5c] dark:text-slate-300 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="above" className="bg-white dark:bg-slate-950">Above</option>
                        <option value="below" className="bg-white dark:bg-slate-950">Below</option>
                      </select>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <button
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => handleSensorCheckChange(row.tagKey, "enableAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                          row.enableAlert
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.enableAlert ? "YES" : "NO"}
                      </button>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <button
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => handleSensorCheckChange(row.tagKey, "suppressAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                          row.suppressAlert
                            ? "bg-rose-500/15 text-rose-500 border-rose-500/30 font-bold"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.suppressAlert ? "YES" : "NO"}
                      </button>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <button
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => handleDeleteSensorRow(row.tagKey)}
                        className="px-2.5 py-1 text-[10px] font-bold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 transition border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : isCoolingTower ? (
            /* NEW NESTED EQUIPMENT RUNNING HOURS CONSOLE */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                {/* Info Text on the Left */}
                <div className="text-xs text-slate-400">
                  Kelola rule jam kerja dan instruksi perawatan preventif secara independen.
                </div>

                {/* Add Equipment Category Button on the Right */}
                <div>
                  <button
                    type="button"
                    disabled={!isUnlocked}
                    onClick={handleAddEqTaskConfig}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Equipment
                  </button>
                </div>
              </div>

              {eqTaskConfigs.map((config) => {
                const isExpanded = !!expandedItems[config.itemKey];
                const totalRules = config.rules.length;
                return (
                  <div
                    key={config.itemKey}
                    className="border border-[#acd3ff] dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-900/10 transition-colors"
                  >
                    {/* Collapsible Header */}
                    <div
                      onClick={() => toggleItemExpand(config.itemKey)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition select-none"
                    >
                      <div className="flex items-center gap-3">
                        {isUnlocked ? (
                          <input
                            type="text"
                            value={config.displayName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEqTaskConfigs(prev => prev.map(c => c.itemKey === config.itemKey ? { ...c, displayName: val } : c));
                            }}
                            className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-blue-500/35 rounded text-xs font-bold text-[#002b5c] dark:text-white outline-none w-48"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-xs font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
                            {config.displayName}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                          {totalRules} {totalRules === 1 ? "Rule" : "Rules"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {totalRules > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                            Hours: {config.rules.map((r) => `${r.targetHours}h`).join(", ")}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEqTaskConfig(config.itemKey, config.displayName);
                          }}
                          className="px-2 py-1 text-[10px] font-bold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Hapus
                        </button>
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "transform rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Rules Content */}
                    {isExpanded && (
                      <div className="p-4 border-t border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/40 space-y-4">
                        {config.rules.length === 0 ? (
                          <div className="text-center py-4 text-slate-400 text-xs">
                            No rules defined yet. Click "Add Hours Rule" below to create one.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {config.rules.map((rule, ruleIdx) => (
                              <div
                                key={ruleIdx}
                                className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 space-y-3 relative"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                                  <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Trigger at:</span>
                                      <div className="inline-flex items-center gap-1 border border-[#acd3ff] dark:border-slate-700 rounded px-2 py-0.5 bg-white dark:bg-slate-900 w-24">
                                        <input
                                          type="number"
                                          value={rule.targetHours}
                                          disabled={!isUnlocked}
                                          onChange={(e) => handleUpdateRuleHours(config.itemKey, ruleIdx, e.target.value)}
                                          className="w-full text-center font-bold font-mono bg-transparent outline-none text-xs text-slate-800 dark:text-slate-100 disabled:opacity-50"
                                          placeholder="Hours"
                                        />
                                        <span className="text-[10px] text-slate-400 font-bold">h</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Warning buffer:</span>
                                      <div className="inline-flex items-center gap-1 border border-[#acd3ff] dark:border-slate-700 rounded px-2 py-0.5 bg-white dark:bg-slate-900 w-24">
                                        <input
                                          type="number"
                                          value={rule.warningHours ?? 168}
                                          disabled={!isUnlocked}
                                          onChange={(e) => handleUpdateWarningHours(config.itemKey, ruleIdx, e.target.value)}
                                          className="w-full text-center font-bold font-mono bg-transparent outline-none text-xs text-slate-800 dark:text-slate-100 disabled:opacity-50"
                                          placeholder="168"
                                        />
                                        <span className="text-[10px] text-slate-400 font-bold">h</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-semibold">before target</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!isUnlocked}
                                    onClick={() => handleDeleteRule(config.itemKey, ruleIdx)}
                                    className="px-2 py-1 text-[10px] font-extrabold uppercase hover:bg-rose-500/10 text-rose-500 rounded transition border border-transparent hover:border-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Delete Rule
                                  </button>
                                </div>

                                {/* Task Descriptions List */}
                                <div className="space-y-2">
                                  <div className="text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold flex justify-between items-center">
                                    <span>Task Descriptions</span>
                                    <button
                                      type="button"
                                      disabled={!isUnlocked}
                                      onClick={() => handleAddTaskDesc(config.itemKey, ruleIdx)}
                                      className="text-blue-500 hover:text-blue-600 transition flex items-center gap-0.5 normal-case font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                      </svg>
                                      Add Task Description
                                    </button>
                                  </div>
                                  {rule.tasks.map((taskDesc, taskIdx) => (
                                    <div key={taskIdx} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={taskDesc}
                                        disabled={!isUnlocked}
                                        onChange={(e) => handleUpdateTaskDesc(config.itemKey, ruleIdx, taskIdx, e.target.value)}
                                        placeholder="e.g. Check belt tension, visual inspection"
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-slate-850 dark:text-slate-200 font-semibold disabled:opacity-50"
                                      />
                                      {rule.tasks.length > 1 && (
                                        <button
                                          type="button"
                                          disabled={!isUnlocked}
                                          onClick={() => handleDeleteTaskDesc(config.itemKey, ruleIdx, taskIdx)}
                                          className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded border border-transparent hover:border-rose-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                          title="Delete description"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="pt-2">
                          <button
                            type="button"
                            disabled={!isUnlocked}
                            onClick={() => handleAddRule(config.itemKey)}
                            className="px-3.5 py-2 border border-dashed border-blue-500 hover:border-blue-600 text-blue-500 hover:bg-blue-500/5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Hours Rule
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* STANDARD NON-COOLING EQUIPMENT RUNNING HOURS TABLE */
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                {/* Search Input on the Left */}
                <div className="relative w-64">
                  <input
                    type="text"
                    placeholder="Cari tag atau parameter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium"
                  />
                  <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Add Button on the Right */}
                <div>
                  <button
                    type="button"
                    disabled={!isUnlocked}
                    onClick={handleAddEqRow}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Parameter Equipment
                  </button>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                    <th className="pb-3 px-3">Equipment SCADA Tag</th>
                    <th className="pb-3 px-3 text-center">P&ID Status</th>
                    <th className="pb-3 px-3 text-center w-24">Max Hours</th>
                    <th className="pb-3 px-3 text-center w-28">Enable Alert</th>
                    <th className="pb-3 px-3 text-center w-28">Suppress Alert</th>
                    <th className="pb-3 px-3 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                  {eqRows.map((row, idx) => (
                    <tr key={row.tagKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-3">
                        {isUnlocked ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={row.tagKey}
                              onChange={(e) => handleEqTagKeyChange(idx, e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-blue-500/30 rounded text-xs font-mono text-[#002b5c] dark:text-white outline-none focus:border-blue-500"
                            />
                            <input
                              type="text"
                              value={row.tagName}
                              onChange={(e) => handleEqTagNameChange(idx, e.target.value)}
                              className="w-full px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-[10px] text-slate-600 dark:text-slate-300 outline-none placeholder:text-slate-400"
                              placeholder="Equipment Name"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-[#002b5c] dark:text-slate-200">{getEqDisplayTagKey(row.tagKey)}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{row.tagName}</div>
                          </>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {row.status !== "—" ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider ${
                            row.status === "ON"
                              ? "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                              : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          }`}>
                            {row.status}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                          <input
                            type="number"
                            value={row.highLimit}
                            disabled={!isUnlocked}
                            onChange={(e) => handleEqNumChange(idx, "highLimit", e.target.value)}
                            className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs disabled:opacity-50"
                          />
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => handleEqCheckChange(idx, "enableAlert")}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                            row.enableAlert
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                              : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          {row.enableAlert ? "YES" : "NO"}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => handleEqCheckChange(idx, "suppressAlert")}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                            row.suppressAlert
                              ? "bg-rose-500/15 text-rose-500 border-rose-500/30 font-bold"
                              : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          {row.suppressAlert ? "YES" : "NO"}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => handleDeleteEqRow(idx)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 transition border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* API SOURCES MANAGEMENT PANEL                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* API SOURCES CONFIGURATION PANEL (24 ITEMS MATCHING SENSOR PARAMETERS) */}
      {configTab === "api-sources" && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                Configuration API Sources ({filteredApiSourceRows.length} / {apiSourceRows.length} Items)
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                  {Object.values(apiSourceUrls).filter((u) => u.trim()).length} Active APIs
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Konfigurasi API Endpoint secara independen untuk {apiSourceRows.length} item source. Gunakan tombol <strong>Unlock to Edit</strong> di atas untuk mengelola tag dan API Endpoint URL.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search Input on the Left */}
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Cari tag atau parameter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium"
              />
              <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Reset and Add Buttons on the Right */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={handleResetApiSourcesToDefault}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-[#0b3b60]/10 hover:bg-[#0b3b60]/20 text-[#0b3b60] dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 shadow-sm transition border border-[#0b3b60]/20 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset ke Default API Sources
              </button>
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={handleAddApiSourceRow}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tambah API Source
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3 text-center w-12">#</th>
                  <th className="pb-3 px-3">Sensor Parameter Item</th>
                  <th className="pb-3 px-3">SCADA Tag Key</th>
                  <th className="pb-3 px-3">API Endpoint URL</th>
                  <th className="pb-3 px-3 text-center">Status Endpoint</th>
                  <th className="pb-3 px-3 text-right">Live API Value</th>
                  <th className="pb-3 px-3 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {filteredApiSourceRows.map((sensor, idx) => {
                  const url = sensor.url || "";
                  const hasUrl = Boolean(url.trim());
                  
                  const apiFieldKey = TAG_KEY_TO_API_JSON_KEY[sensor.tagKey];
                  let rawVal = apiFieldKey ? apiLiveData[apiFieldKey] : undefined;

                  // Delta Temp fallback calculation if needed
                  if (
                    sensor.tagKey === "cooling-water/delta_temp" &&
                    apiLiveData["Scaled_Temp_Tank_Cooling3_Return"] !== undefined &&
                    apiLiveData["Scaled_Temp_Tank_Cooling3_Supp"] !== undefined
                  ) {
                    rawVal = apiLiveData["Scaled_Temp_Tank_Cooling3_Return"] - apiLiveData["Scaled_Temp_Tank_Cooling3_Supp"];
                  }

                  let liveValStr = "xx";
                  const isValPresent = hasUrl && rawVal !== undefined && rawVal !== null;
                  if (isValPresent) {
                    liveValStr = typeof rawVal === "number" ? rawVal.toFixed(2) : String(rawVal);
                  }

                  return (
                    <tr key={sensor.tagKey || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        {isUnlocked ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={sensor.tagName}
                              onChange={(e) => handleApiSourceTagNameChange(idx, e.target.value)}
                              className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-[11px] font-bold text-[#002b5c] dark:text-slate-200 outline-none w-full"
                              placeholder="Name"
                            />
                            <input
                              type="text"
                              value={sensor.unit}
                              onChange={(e) => handleApiSourceUnitChange(idx, e.target.value)}
                              className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-[10px] text-slate-500 outline-none w-20"
                              placeholder="Unit"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-[#002b5c] dark:text-slate-200">
                              {sensor.tagName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{sensor.unit}</div>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#47729f] dark:text-slate-400">
                        {isUnlocked ? (
                          <input
                            type="text"
                            value={sensor.tagKey}
                            onChange={(e) => handleApiSourceTagKeyChange(idx, e.target.value)}
                            className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-blue-500/30 rounded text-xs font-mono text-[#002b5c] dark:text-white outline-none focus:border-blue-500 w-full"
                            placeholder="Tag Key"
                          />
                        ) : (
                          sensor.tagKey
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {isUnlocked ? (
                          <input
                            type="text"
                            value={url}
                            onChange={(e) => handleApiSourceUrlChange(idx, e.target.value)}
                            placeholder="Masukkan API Endpoint URL (kosongkan jika belum ada API / data xx)..."
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-blue-500/50 dark:border-blue-500/40 rounded text-xs font-mono text-[#002b5c] dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-sans"
                          />
                        ) : (
                          <div className="font-mono text-[11px] truncate max-w-md">
                            {hasUrl ? (
                              <span className="text-blue-600 dark:text-blue-400 font-semibold">{url}</span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                belum ada api
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            isValPresent
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : hasUrl
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }`}
                        >
                          {isValPresent ? "⚡ API Active" : hasUrl ? "⏳ No Data" : "⏳ belum ada api"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-xs">
                        {isValPresent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-mono font-extrabold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {liveValStr} {sensor.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-mono">xx {sensor.unit}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => handleDeleteApiSourceRow(idx)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 transition border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PASSWORD VERIFICATION MODAL OVERLAY */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="relative w-[420px] rounded-2xl border border-blue-500/30 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl transition-all">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-900 pb-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  Verifikasi Password Konfigurasi
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {passwordAction === "unlock"
                    ? "Masukkan password akun Anda untuk membuka kunci mode edit konfigurasi."
                    : passwordAction === "delete"
                    ? "Masukkan password akun Anda untuk memverifikasi tindakan HAPUS item."
                    : "Masukkan password akun Anda untuk menyimpan seluruh perubahan konfigurasi."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#002b5c] dark:text-slate-300 uppercase">
                  Password Operator / Administrator <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Masukkan password akun Anda..."
                  required
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-blue-500/50 dark:border-blue-500/40 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-[#002b5c] dark:text-white font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/30"
                />
                {passwordError && (
                  <p className="mt-1.5 text-[11px] text-rose-500 font-bold flex items-center gap-1">
                    <span>⚠️</span> {passwordError}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-900 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={verifyingPassword}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={verifyingPassword}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {verifyingPassword ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Memverifikasi...
                    </>
                  ) : passwordAction === "unlock" ? (
                    "Verifikasi & Buka Edit"
                  ) : (
                    "Verifikasi & Simpan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function HvacConfigConsole({ unitId, machine }: { unitId: string; machine: any }) {
  const [activeTab, setActiveTab] = useState<"ahu1" | "ahu2" | "ahu3" | "equipment" | "api-sources">("ahu1");
  const [activeSubTab, setActiveSubTab] = useState<"general" | "sensor" | "advanced">("general");

  const [hvacConfig, setHvacConfig] = useState<HvacConfig>(DEFAULT_HVAC_CONFIG);
  const [eqRows, setEqRows] = useState<ConfigEqRow[]>([]);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    const savedHvac = localStorage.getItem(`scada.config.hvac.${unitId}`);
    if (savedHvac) {
      try {
        setHvacConfig(JSON.parse(savedHvac));
      } catch (e) {
        setHvacConfig(DEFAULT_HVAC_CONFIG);
      }
    } else {
      setHvacConfig(DEFAULT_HVAC_CONFIG);
    }

    const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
    if (savedEq) {
      try {
        setEqRows(JSON.parse(savedEq));
      } catch (e) {
        setEqRows(DEFAULT_HVAC_EQ_CONFIGS);
      }
    } else {
      setEqRows(DEFAULT_HVAC_EQ_CONFIGS);
    }
  }, [unitId]);

  const handleHvacChange = (ahu: "ahu1" | "ahu2" | "ahu3", field: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setHvacConfig((prev) => ({
      ...prev,
      [ahu]: {
        ...prev[ahu],
        [field]: isNaN(val) ? prev[ahu][field as keyof typeof prev[typeof ahu]] : val
      }
    }));
  };

  const handleEqNumChange = (index: number, field: "lowLimit" | "baseline" | "highLimit", value: string) => {
    const parsedVal = value === "" ? 0 : parseFloat(value);
    setEqRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: isNaN(parsedVal) ? next[index][field] : parsedVal
      };
      return next;
    });
  };

  const handleEqCheckChange = (index: number, field: "enableAlert" | "suppressAlert") => {
    setEqRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: !next[index][field]
      };
      return next;
    });
  };

  const handleSave = () => {
    localStorage.setItem(`scada.config.hvac.${unitId}`, JSON.stringify(hvacConfig));
    localStorage.setItem(`scada.config.eq.${unitId}`, JSON.stringify(eqRows));
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  if (!machine) return null;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 transition-colors duration-300 backdrop-blur-md">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide">
            HVAC Config Console
          </h3>
          <p className="text-xs text-[#47729f] dark:text-slate-500">
            Set alarm parameter setpoints, sensor thresholds, deadbands, and equipment limit parameters.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {successMsg && (
            <span className="text-xs font-bold text-emerald-500 animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              HVAC Configuration Saved Successfully!
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-[#1f6fb5] hover:bg-[#155c99] text-white shadow-md shadow-[#1f6fb5]/25 transition duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Configuration
          </button>
        </div>
      </div>

      {/* Main Selection Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl w-fit">
        {[
          { id: "ahu1", label: "AHU-01 Clean Area" },
          { id: "ahu2", label: "AHU-02 Accelerated" },
          { id: "ahu3", label: "AHU-03 Long-term" },
          { id: "equipment", label: "Equipment Running Hours" },
          { id: "api-sources", label: "API Sources" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === tab.id
                ? "bg-[#1f6fb5] text-white shadow-sm"
                : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Room Tabs content */}
      {activeTab !== "equipment" && activeTab !== "api-sources" && (
        <div className="space-y-6">
          {/* Sub tabs (General / Sensor / Advanced) - Show only for AHU-01 and AHU-02 */}
          {activeTab !== "ahu3" && (
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-0.5">
              {[
                { id: "general", label: "General Setting" },
                { id: "sensor", label: "Sensor Setting" },
                { id: "advanced", label: "Advance Setting" }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id as any)}
                  className={`px-3 py-2 text-xs font-bold transition border-b-2 -mb-0.5 ${
                    activeSubTab === subTab.id
                      ? "border-[#1f6fb5] text-[#1f6fb5] dark:text-sky-400 font-extrabold"
                      : "border-transparent text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
                  }`}
                >
                  {subTab.label}
                </button>
              ))}
            </div>
          )}

          {/* Configuration Form Body */}
          <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
            {activeTab === "ahu3" ? (
              // Simple Form for AHU-03 (Stability Room)
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  AHU-03 Stability Room Parameters
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Room Temp Setpoint (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig.ahu3.tempSp}
                      onChange={(e) => handleHvacChange("ahu3", "tempSp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      High Temp Alarm (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig.ahu3.highTemp}
                      onChange={(e) => handleHvacChange("ahu3", "highTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Low Temp Alarm (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig.ahu3.lowTemp}
                      onChange={(e) => handleHvacChange("ahu3", "lowTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Alarm Delay (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig.ahu3.alarmDelay}
                      onChange={(e) => handleHvacChange("ahu3", "alarmDelay", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            ) : activeSubTab === "general" ? (
              // General settings subtab for AHU-1/AHU-2
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  General Room Control Parameters ({activeTab === "ahu1" ? "AHU-01 Clean Area" : "AHU-02 Reference Area"})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Room Temperature Setpoint (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].tempSp}
                      onChange={(e) => handleHvacChange(activeTab, "tempSp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Room Humidity Setpoint (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].humiditySp}
                      onChange={(e) => handleHvacChange(activeTab, "humiditySp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Supply Fan Capacity (%)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].sfCapacity}
                      onChange={(e) => handleHvacChange(activeTab, "sfCapacity", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  {activeTab === "ahu1" ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                          Electric Heater 1 (EH-01) Steps
                        </label>
                        <input
                          type="number"
                          value={hvacConfig.ahu1.eh1Capacity}
                          onChange={(e) => handleHvacChange("ahu1", "eh1Capacity", e.target.value)}
                          className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                          Electric Heater 2 (EH-02) Steps
                        </label>
                        <input
                          type="number"
                          value={hvacConfig.ahu1.eh2Capacity}
                          onChange={(e) => handleHvacChange("ahu1", "eh2Capacity", e.target.value)}
                          className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                        Electric Heater (EH) Capacity (%)
                      </label>
                      <input
                        type="number"
                        value={hvacConfig.ahu2.ehCapacity}
                        onChange={(e) => handleHvacChange("ahu2", "ehCapacity", e.target.value)}
                        className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Cool Down Time (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].coolDownTime}
                      onChange={(e) => handleHvacChange(activeTab, "coolDownTime", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            ) : activeSubTab === "sensor" ? (
              // Sensor alarm bounds settings subtab for AHU-1/AHU-2
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  Safety Sensor Limits & Alarm Bounds
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      High Temp Alarm Limit (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].highTemp}
                      onChange={(e) => handleHvacChange(activeTab, "highTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Low Temp Alarm Limit (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].lowTemp}
                      onChange={(e) => handleHvacChange(activeTab, "lowTemp", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      High Humidity Alarm Limit (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].highHumidity}
                      onChange={(e) => handleHvacChange(activeTab, "highHumidity", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Low Humidity Alarm Limit (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].lowHumidity}
                      onChange={(e) => handleHvacChange(activeTab, "lowHumidity", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Alarm Delay (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].alarmDelay}
                      onChange={(e) => handleHvacChange(activeTab, "alarmDelay", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Stop Buzzer Delay (min)
                    </label>
                    <input
                      type="number"
                      value={hvacConfig[activeTab].stopBuzzer}
                      onChange={(e) => handleHvacChange(activeTab, "stopBuzzer", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Advanced settings subtab for AHU-1/AHU-2
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
                  Deadband (DB) Offsets & Calibrations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Temperature Offset 1 (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbTemp1}
                      onChange={(e) => handleHvacChange(activeTab, "dbTemp1", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Temperature Offset 2 (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbTemp2}
                      onChange={(e) => handleHvacChange(activeTab, "dbTemp2", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Humidity Offset 1 (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbHumid1}
                      onChange={(e) => handleHvacChange(activeTab, "dbHumid1", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Humidity Offset 2 (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbHumid2}
                      onChange={(e) => handleHvacChange(activeTab, "dbHumid2", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                      Deadband Humidity Offset 3 (%RH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hvacConfig[activeTab].dbHumid3}
                      onChange={(e) => handleHvacChange(activeTab, "dbHumid3", e.target.value)}
                      className="w-full rounded-md border border-[#acd3ff] dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#002b5c] dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#1f6fb5]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equipment Running Hours Settings Tab */}
      {activeTab === "equipment" && (
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
            Equipment running hours bounds
          </h4>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Equipment Component Tag</th>
                  <th className="pb-3 px-3 text-center">P&ID Live Status</th>
                  <th className="pb-3 px-3 text-center w-24">Min Hours</th>
                  <th className="pb-3 px-3 text-center w-28">Baseline Hours</th>
                  <th className="pb-3 px-3 text-center w-24">Max Hours</th>
                  <th className="pb-3 px-3 text-center w-28">Enable Alert</th>
                  <th className="pb-3 px-3 text-center w-28">Suppress Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {eqRows.map((row, idx) => (
                  <tr key={row.tagKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-[#002b5c] dark:text-slate-200">{row.tagName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{row.tagKey}</div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider ${
                        row.status === "ON"
                          ? "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                        {row.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          value={row.lowLimit}
                          onChange={(e) => handleEqNumChange(idx, "lowLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#acd3ff] dark:border-slate-700 rounded px-2.5 py-1 bg-sky-500/5 dark:bg-slate-900/80 w-28">
                        <input
                          type="number"
                          value={row.baseline}
                          onChange={(e) => handleEqNumChange(idx, "baseline", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs text-[#1f6fb5] dark:text-sky-400"
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 border border-[#d6e9fb] dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 w-24">
                        <input
                          type="number"
                          value={row.highLimit}
                          onChange={(e) => handleEqNumChange(idx, "highLimit", e.target.value)}
                          className="w-full text-center font-bold font-mono bg-transparent outline-none focus:ring-0 focus:border-transparent text-xs"
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleEqCheckChange(idx, "enableAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition ${
                          row.enableAlert
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.enableAlert ? "YES" : "NO"}
                      </button>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleEqCheckChange(idx, "suppressAlert")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-extrabold uppercase border transition ${
                          row.suppressAlert
                            ? "bg-rose-500/15 text-rose-500 border-rose-500/30 font-bold"
                            : "bg-slate-100 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {row.suppressAlert ? "YES" : "NO"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}


