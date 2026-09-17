export interface ConsumptionFactCategory {
  id: string;
  label: string;
  enabled: boolean;
  value?: { kWh: number };
}

// 23 Mesin Factory 1 (PM132 s/d PM185)
export const DEFAULT_FACT1_CATEGORIES: ConsumptionFactCategory[] = [
  { id: "f1_main_supply_qc", label: "F1 MAIN SUPPLY QC OFFICE & LAB", enabled: true, value: { kWh: 0 } },
  { id: "f1_mdp3", label: "F1 MDP3", enabled: true, value: { kWh: 0 } },
  { id: "f1_wh4_penerangan", label: "F1 WH 4 PENERANGAN", enabled: true, value: { kWh: 0 } },
  { id: "f1_mdp2", label: "F1 MDP-2", enabled: true, value: { kWh: 0 } },
  { id: "f1_mdp12", label: "F1 MDP-1.2", enabled: true, value: { kWh: 0 } },
  { id: "f1_full_cooling_wf1", label: "F1 FULL COOLING WF1-U3", enabled: true, value: { kWh: 0 } },
  { id: "f1_mdp11", label: "F1 MDP-1.1", enabled: true, value: { kWh: 0 } },
  { id: "f1_comp_zt55", label: "F1 COMPRESSED AIR ZT-55", enabled: true, value: { kWh: 0 } },
  { id: "f1_hvac_office_atas", label: "F1 HVAC OFFICE ATAS", enabled: true, value: { kWh: 0 } },
  { id: "f1_ct_pump_wf1", label: "F1 COOLING TOWER PUMP WF1-U3", enabled: true, value: { kWh: 0 } },
  { id: "f1_hvac_qc", label: "F1 HVAC-QC", enabled: true, value: { kWh: 0 } },
  { id: "f1_lighting_wh1", label: "F1 LIGHTING WH 1", enabled: true, value: { kWh: 0 } },
  { id: "f1_st3", label: "F1 ST3", enabled: true, value: { kWh: 0 } },
  { id: "f1_qc_lab", label: "F1 QC LAB", enabled: true, value: { kWh: 0 } },
  { id: "f1_chiller_daikin_barat", label: "F1 CHILLER PREP DAIKIN BARAT", enabled: true, value: { kWh: 0 } },
  { id: "f1_chiller_daikin_timur", label: "F1 CHILLER PREP DAIKIN TIMUR", enabled: true, value: { kWh: 0 } },
  { id: "f1_hvac_wh3", label: "F1 HVAC WH-3", enabled: true, value: { kWh: 0 } },
  { id: "f1_chiller_bp_wf1", label: "F1 CHILLER BP WF1-U3", enabled: true, value: { kWh: 0 } },
  { id: "f1_ct_fan_wf1", label: "F1 COOLING TOWER FAN WF1-U3", enabled: true, value: { kWh: 0 } },
  { id: "f1_comp_zt30", label: "F1 COMPRESSED AIR ZT-30.1&2", enabled: true, value: { kWh: 0 } },
  { id: "f1_comp_ale30", label: "F1 COMPRESSED AIR ALE-30", enabled: true, value: { kWh: 0 } },
  { id: "f1_boiler4", label: "F1 BOILER 4", enabled: true, value: { kWh: 0 } },
  { id: "f1_hvac_wf1u3", label: "F1 HVAC WF1U3", enabled: true, value: { kWh: 0 } }
];

// 31 Mesin Factory 2 (21 Feeders EW22 + 10 Feeders EW23)
export const DEFAULT_FACT2_CATEGORIES: ConsumptionFactCategory[] = [
  { id: "f2_putr1", label: "F2 PUTR-1", enabled: true, value: { kWh: 0 } },
  { id: "f2_putr2", label: "F2 PUTR-2", enabled: true, value: { kWh: 0 } },
  { id: "f2_heater_wf2u2", label: "F2 HEATER WF2U2", enabled: true, value: { kWh: 0 } },
  { id: "f2_ahu_wf2ui", label: "F2 AHU WF2UI", enabled: true, value: { kWh: 0 } },
  { id: "f2_cooling_fase1", label: "F2 COOLING FASE-1", enabled: true, value: { kWh: 0 } },
  { id: "f2_wh6", label: "F2 WH 6", enabled: true, value: { kWh: 0 } },
  { id: "f2_wh5", label: "F2 WH 5", enabled: true, value: { kWh: 0 } },
  { id: "f2_chiller_wf2u2", label: "F2 CHILLER - WF2U2", enabled: true, value: { kWh: 0 } },
  { id: "f2_main_critical", label: "F2 MAIN CRITICAL PANEL", enabled: true, value: { kWh: 0 } },
  { id: "f2_otoklaf_wf2u1", label: "F2 PANEL OTOKLAF WF2U1", enabled: true, value: { kWh: 0 } },
  { id: "f2_otoklaf_wf2u2", label: "F2 PANEL OTOKLAF WF2U2", enabled: true, value: { kWh: 0 } },
  { id: "f2_boiler5", label: "F2 BOILER-5", enabled: true, value: { kWh: 0 } },
  { id: "f2_comp_atlas", label: "F2 COMPRESSED AIR ATLAS", enabled: true, value: { kWh: 0 } },
  { id: "f2_cooling_critical", label: "F2 COOLING CRITICAL", enabled: true, value: { kWh: 0 } },
  { id: "f2_wh7", label: "F2 WH-7", enabled: true, value: { kWh: 0 } },
  { id: "f2_comp_ale250", label: "F2 KOBELCO ALE-250", enabled: true, value: { kWh: 0 } },
  { id: "f2_chiller_rtac250", label: "F2 CHILLER RTAC 250 (RO&HVAC)", enabled: true, value: { kWh: 0 } },
  { id: "f2_chiller_rtac170", label: "F2 CHILLER RTAC 170 (RO)", enabled: true, value: { kWh: 0 } },
  { id: "f2_return_sample_qc", label: "RETURN SAMPLE QC", enabled: true, value: { kWh: 0 } },
  { id: "f2_chiller_rtac100", label: "F2 CHILLER RTAC 100 (BP)", enabled: true, value: { kWh: 0 } },
  { id: "f2_penerangan_pd", label: "F2 Penerangan PD", enabled: true, value: { kWh: 0 } },
  { id: "f2_cooling_fase2", label: "F2 COOLING FASE-2", enabled: true, value: { kWh: 0 } },
  { id: "f2_chiller_rtac275", label: "F2 CHILLER RTAC-275 (PREP)", enabled: true, value: { kWh: 0 } },
  { id: "f2_wt_du_psg", label: "F2 WT-DU-PSG", enabled: true, value: { kWh: 0 } },
  { id: "f2_ahu1_wf2u2", label: "F2 AHU-1 - WF2U2", enabled: true, value: { kWh: 0 } },
  { id: "f2_ahu2_wf2u2", label: "F2 AHU-2 - WF2U2", enabled: true, value: { kWh: 0 } },
  { id: "f2_pw_gen_ro", label: "F2 PW GENERATION - RO", enabled: true, value: { kWh: 0 } },
  { id: "f2_ct_pump_wf2", label: "F2 COOLING TOWER CT-PUMP", enabled: true, value: { kWh: 0 } },
  { id: "f2_ct_fan_wf2", label: "F2 COOLING TOWER CT-FAN", enabled: true, value: { kWh: 0 } },
  { id: "f2_putr_new", label: "F2 PUTR-NEW", enabled: true, value: { kWh: 0 } },
  { id: "f2_mcc_bp7", label: "F2 MCC BP 7", enabled: true, value: { kWh: 0 } }
];

// Factual fallback: zero series (no dummy / synthetic numbers)
export function getMachineSeries(
  _machineName?: string,
  daysCurrent: number = 31,
  daysPrevious: number = 31
): { current: number[]; previous: number[] } {
  return {
    current: new Array(daysCurrent).fill(0),
    previous: new Array(daysPrevious).fill(0)
  };
}

