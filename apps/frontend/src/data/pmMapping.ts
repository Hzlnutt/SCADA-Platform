export type PowerMeterInfo = {
  name: string;
  model: string;
  category?: string;
  location?: string;
  diewonName?: string;
};

export const PM_NAME_MAPPING: Record<string, PowerMeterInfo> = {
  // EW21 Sub-Distribution Power Meters (Factory 1: 23 Units)
  PM132: { name: "F1 MAIN SUPPLY QC OFFICE & LAB", model: "PM5100", category: "Distribution", location: "Factory 1", diewonName: "MAIN SUPPLY QC OFFICE & LAB" },
  PM133: { name: "F1 MDP3", model: "PM5100", category: "Distribution", location: "Factory 1", diewonName: "MDP3" },
  PM134: { name: "F1 WH 4 PENERANGAN", model: "PM5100", category: "Warehouse", location: "Factory 1", diewonName: "WH 4 PENERANGAN" },
  PM135: { name: "F1 MDP-2", model: "PM5100", category: "Distribution", location: "Factory 1", diewonName: "MDP-2" },
  PM136: { name: "F1 MDP-1.2", model: "PM5100", category: "Distribution", location: "Factory 1", diewonName: "MDP-1.2" },
  PM138: { name: "F1 FULL COOLING WF1-U3", model: "PM5100", category: "HVAC", location: "Factory 1", diewonName: "FULL COOLING WF1-U3" },
  PM139: { name: "F1 MDP-1.1", model: "PM5100", category: "Distribution", location: "Factory 1", diewonName: "MDP-1.1" },
  PM140: { name: "F1 COMPRESSED AIR ZT-55", model: "PM5100", category: "Compressor", location: "Factory 1", diewonName: "COMPRESSED AIR ZT-55" },
  PM151: { name: "F1 HVAC OFFICE ATAS", model: "PM5100", category: "HVAC", location: "Factory 1", diewonName: "HVAC OFFICE ATAS" },
  PM152: { name: "F1 COOLING TOWER PUMP WF1-U3", model: "PM5100", category: "Cooling Water", location: "Factory 1", diewonName: "COOLING TOWER PUMP WF1-U3" },
  PM153: { name: "F1 HVAC-QC", model: "PM5100", category: "HVAC", location: "Factory 1", diewonName: "HVAC-QC" },
  PM154: { name: "F1 LIGHTING WH 1", model: "PM5100", category: "Warehouse", location: "Factory 1", diewonName: "LIGHTING WH 1" },
  PM175: { name: "F1 ST3", model: "PA330", category: "Distribution", location: "Factory 1", diewonName: "ST3" },
  PM176: { name: "F1 QC LAB", model: "PA330", category: "Quality Control", location: "Factory 1", diewonName: "QC LAB" },
  PM177: { name: "F1 CHILLER PREP DAIKIN BARAT", model: "PA330", category: "Chiller", location: "Factory 1", diewonName: "CHILLER PREP DAIKIN BARAT" },
  PM178: { name: "F1 CHILLER PREP DAIKIN TIMUR", model: "PA330", category: "Chiller", location: "Factory 1", diewonName: "CHILLER PREP DAIKIN TIMUR" },
  PM179: { name: "F1 HVAC WH-3", model: "PA330", category: "Warehouse", location: "Factory 1", diewonName: "HVAC WH-3" },
  PM180: { name: "F1 CHILLER BP WF1-U3", model: "PA330", category: "Chiller", location: "Factory 1", diewonName: "CHILLER BP WF1-U3" },
  PM181: { name: "F1 COOLING TOWER FAN WF1-U3", model: "PA330", category: "Cooling Water", location: "Factory 1", diewonName: "COOLING TOWER FAN WF1-U3" },
  PM182: { name: "F1 COMPRESSED AIR ZT-30.1&2", model: "PA330", category: "Compressor", location: "Factory 1", diewonName: "COMPRESSED AIR ZT-30.1&2" },
  PM183: { name: "F1 COMPRESSED AIR ALE-30", model: "PA330", category: "Compressor", location: "Factory 1", diewonName: "COMPRESSED AIR ALE-30" },
  PM184: { name: "F1 BOILER 4", model: "PA330", category: "Boiler", location: "Factory 1", diewonName: "BOILER 4" },
  PM185: { name: "F1 HVAC WF1U3", model: "PA330", category: "HVAC", location: "Factory 1", diewonName: "HVAC WF1U3" },

  // EW22 Sub-Distribution Power Meters (Factory 2: 21 Units)
  PM201: { name: "F2 PUTR-1", model: "PM5100", category: "Distribution", location: "Factory 2", diewonName: "PUTR-1" },
  PM202: { name: "F2 PUTR-2", model: "PM5100", category: "Distribution", location: "Factory 2", diewonName: "PUTR-2" },
  PM203: { name: "F2 HEATER WF2U2", model: "PM5100", category: "Heater", location: "Factory 2", diewonName: "HEATER WF2U2" },
  PM205: { name: "F2 AHU WF2UI", model: "PM5100", category: "HVAC", location: "Factory 2", diewonName: "AHU WF2UI" },
  PM206: { name: "F2 COOLING FASE-1", model: "PM5100", category: "Cooling Water", location: "Factory 2", diewonName: "COOLING FASE-1" },
  PM207: { name: "F2 WH 6", model: "PM5100", category: "Warehouse", location: "Factory 2", diewonName: "WH 6" },
  PM208: { name: "F2 WH 5", model: "PM5100", category: "Warehouse", location: "Factory 2", diewonName: "WH 5" },
  PM209: { name: "F2 CHILLER - WF2U2", model: "PM5300", category: "Chiller", location: "Factory 2", diewonName: "CHILLER - WF2U2" },
  PM210: { name: "F2 MAIN CRITICAL PANEL", model: "PM5350", category: "Critical Panel", location: "Factory 2", diewonName: "MAIN CRITICAL PANEL" },
  PM211: { name: "F2 PANEL OTOKLAF WF2U1", model: "PM5350", category: "Autoclave", location: "Factory 2", diewonName: "PANEL OTOKLAF WF2U1" },
  PM212: { name: "F2 PANEL OTOKLAF WF2U2", model: "PM5350", category: "Autoclave", location: "Factory 2", diewonName: "PANEL OTOKLAF WF2U2" },
  PM213: { name: "F2 BOILER-5", model: "PM5350", category: "Boiler", location: "Factory 2", diewonName: "BOILER-5" },
  PM214: { name: "F2 COMPRESSED AIR ATLAS", model: "PM5100", category: "Compressor", location: "Factory 2", diewonName: "COMPRESSED AIR ATLAS" },
  PM215: { name: "F2 COOLING CRITICAL", model: "PM5350", category: "Cooling Water", location: "Factory 2", diewonName: "COOLING CRITICAL" },
  PM226: { name: "F2 WH-7", model: "PM5300", category: "Warehouse", location: "Factory 2", diewonName: "WH-7" },
  PM229: { name: "F2 KOBELCO ALE-250", model: "PM5300", category: "Compressor", location: "Factory 2", diewonName: "KOBELCO ALE-250" },
  PM271: { name: "F2 CHILLER RTAC 250 (RO&HVAC)", model: "PA330", category: "Chiller", location: "Factory 2", diewonName: "CHILLER RTAC 250 (RO&HVAC)" },
  PM272: { name: "F2 CHILLER RTAC 170 (RO)", model: "PA330", category: "Chiller", location: "Factory 2", diewonName: "CHILLER RTAC 170 (RO)" },
  PM273: { name: "RETURN SAMPLE QC", model: "PA330", category: "Quality Control", location: "Factory 2", diewonName: "RETURN SAMPLE QC" },
  PM274: { name: "F2 CHILLER RTAC 100 (BP)", model: "PA330", category: "Chiller", location: "Factory 2", diewonName: "CHILLER RTAC 100 (BP)" },
  PM288: { name: "F2 Penerangan PD", model: "PA330", category: "Lighting", location: "Factory 2", diewonName: "Penerangan PD" },

  // EW23 Sub-Distribution Power Meters (Factory 2 Sub: 10 Units)
  PM318: { name: "F2 COOLING FASE-2", model: "PM5300", category: "Cooling Water", location: "Factory 2", diewonName: "COOLING FASE-2" },
  PM319: { name: "F2 CHILLER RTAC-275 (PREP)", model: "PA330", category: "Chiller", location: "Factory 2", diewonName: "CHILLER RTAC-275 (PREP)" },
  PM320: { name: "F2 WT-DU-PSG", model: "PM5300", category: "Water Treatment", location: "Factory 2", diewonName: "WT-DU-PSG" },
  PM321: { name: "F2 AHU-1 - WF2U2", model: "PM5100", category: "HVAC", location: "Factory 2", diewonName: "AHU-1 - WF2U2" },
  PM322: { name: "F2 AHU-2 - WF2U2", model: "PM5350", category: "HVAC", location: "Factory 2", diewonName: "AHU-2 - WF2U2" },
  PM323: { name: "F2 PW GENERATION - RO", model: "PM5300", category: "Purified Water", location: "Factory 2", diewonName: "PW GENERATION - RO" },
  PM324: { name: "F2 COOLING TOWER CT-PUMP", model: "PM5300", category: "Cooling Water", location: "Factory 2", diewonName: "COOLING TOWER CT-PUMP" },
  PM325: { name: "F2 COOLING TOWER CT-FAN", model: "PM5100", category: "Cooling Water", location: "Factory 2", diewonName: "COOLING TOWER CT-FAN" },
  PM327: { name: "F2 PUTR-NEW", model: "PM5300", category: "Distribution", location: "Factory 2", diewonName: "PUTR-NEW" },
  PM337: { name: "F2 MCC BP 7", model: "PA330", category: "Bottlepack", location: "Factory 2", diewonName: "MCC BP 7" },

  // Incoming Cubicles (3 Units)
  PM410: { name: "incoming cubicle pln", model: "PM8000", category: "Incoming PLN", location: "Main Substation", diewonName: "incoming cubicle pln" },
  PM411: { name: "incoming cubicle WF1", model: "PM5560", category: "Feeder WF1", location: "Factory 1", diewonName: "incoming cubicle WF1" },
  PM412: { name: "incoming cubicle WF2", model: "PM5560", category: "Feeder WF2", location: "Factory 2", diewonName: "incoming cubicle WF2" },
  PM8000: { name: "incoming cubicle pln", model: "PM8000", category: "Incoming PLN", location: "Main Substation" },
  PM5560: { name: "incoming cubicle WF1", model: "PM5560", category: "Feeder WF1", location: "Factory 1" },
  PM5560_WF1: { name: "incoming cubicle WF1", model: "PM5560", category: "Feeder WF1", location: "Factory 1" },
  PM5560_WF2: { name: "incoming cubicle WF2", model: "PM5560", category: "Feeder WF2", location: "Factory 2" },
  PM5500: { name: "incoming cubicle WF2", model: "PM5560", category: "Feeder WF2", location: "Factory 2" },
  PM5500_WF1: { name: "incoming cubicle WF1", model: "PM5560", category: "Feeder WF1", location: "Factory 1" },
  PM5500_WF2: { name: "incoming cubicle WF2", model: "PM5560", category: "Feeder WF2", location: "Factory 2" },
  Cubicle_PLN_PM8000: { name: "incoming cubicle pln", model: "PM8000", category: "Incoming PLN", location: "Main Substation" },
  Feeder_WF1_PM5560: { name: "incoming cubicle WF1", model: "PM5560", category: "Feeder WF1", location: "Factory 1" },
  Feeder_WF2_PM5500: { name: "incoming cubicle WF2", model: "PM5560", category: "Feeder WF2", location: "Factory 2" }
};

export const getPmInfo = (pmId: string): PowerMeterInfo => {
  const normalized = (pmId || "").trim();
  if (PM_NAME_MAPPING[normalized]) return PM_NAME_MAPPING[normalized];
  if (PM_NAME_MAPPING[normalized.toUpperCase()]) return PM_NAME_MAPPING[normalized.toUpperCase()];

  // Return fallback formatted name if not explicitly mapped
  return {
    name: normalized.toUpperCase(),
    model: "Power Meter",
    category: "Sub-Distribution",
    location: "Factory Utility"
  };
};

export const PM_ORDER_INDEX: Record<string, number> = {
  // EW21 Sub-Distribution Power Meters (Factory 1)
  PM132: 132,
  PM133: 133,
  PM134: 134,
  PM135: 135,
  PM136: 136,
  PM138: 138,
  PM139: 139,
  PM140: 140,
  PM151: 151,
  PM152: 152,
  PM153: 153,
  PM154: 154,
  PM175: 175,
  PM176: 176,
  PM177: 177,
  PM178: 178,
  PM179: 179,
  PM180: 180,
  PM181: 181,
  PM182: 182,
  PM183: 183,
  PM184: 184,
  PM185: 185,

  // EW22 Sub-Distribution Power Meters (Factory 2)
  PM201: 201,
  PM202: 202,
  PM203: 203,
  PM205: 205,
  PM206: 206,
  PM207: 207,
  PM208: 208,
  PM209: 209,
  PM210: 210,
  PM211: 211,
  PM212: 212,
  PM213: 213,
  PM214: 214,
  PM215: 215,
  PM226: 226,
  PM229: 229,
  PM271: 271,
  PM272: 272,
  PM273: 273,
  PM274: 274,
  PM288: 288,

  // EW23 Sub-Distribution Power Meters (Factory 2 Sub)
  PM318: 318,
  PM319: 319,
  PM320: 320,
  PM321: 321,
  PM322: 322,
  PM323: 323,
  PM324: 324,
  PM325: 325,
  PM327: 327,
  PM337: 337,

  // Incoming Cubicles
  PM410: 410,
  PM8000: 410,
  CUBICLE_PLN_PM8000: 410,
  PM411: 411,
  PM5560: 411,
  PM5560_WF1: 411,
  FEEDER_WF1_PM5560: 411,
  PM412: 412,
  PM5560_WF2: 412,
  PM5500: 412,
  FEEDER_WF2_PM5500: 412
};

export const getPmSortIndex = (pmId: string): number => {
  const normalized = (pmId || "").trim().toUpperCase();
  if (PM_ORDER_INDEX[normalized] !== undefined) return PM_ORDER_INDEX[normalized];
  const m = normalized.match(/\d+/);
  if (m) return parseInt(m[0], 10) + 1000;
  return 99999;
};
