export type PowerMeterInfo = {
  name: string;
  model: string;
  category?: string;
  location?: string;
};

export const PM_NAME_MAPPING: Record<string, PowerMeterInfo> = {
  // EW23 Sub-Distribution Power Meters (10 Sub-Feeders)
  PM318: { name: "F2 CHILLER RTAC-275 (PREP)", model: "PA330", category: "Chiller", location: "Factory 2" },
  PM319: { name: "F2 WT-DU-PSG", model: "PM5300", category: "Water Treatment", location: "Factory 2" },
  PM320: { name: "F2 AHU-1 - WF2U2", model: "PM5100", category: "HVAC", location: "Factory 2" },
  PM321: { name: "F2 AHU-2 - WF2U2", model: "PM5350", category: "HVAC", location: "Factory 2" },
  PM322: { name: "F2 PW GENERATION - RO", model: "PM5300", category: "Purified Water", location: "Factory 2" },
  PM323: { name: "F2 COOLING TOWER CT-FAN", model: "PM5100", category: "Cooling Water", location: "Factory 2" },
  PM324: { name: "F2 COOLING TOWER CT-PUMP", model: "PM5300", category: "Cooling Water", location: "Factory 2" },
  PM325: { name: "F2 PUTR-NEW", model: "PM5300", category: "Distribution", location: "Factory 2" },
  PM327: { name: "F2 COOLING FASE-2", model: "PM5300", category: "Cooling Water", location: "Factory 2" },
  PM337: { name: "F2 MCC BP 7", model: "PA330", category: "Bottlepack", location: "Factory 2" },

  // EW22 Sub-Distribution Power Meters (21 Feeders / Machines)
  PM206: { name: "F2 COOLING FASE-1", model: "PM5100", category: "Cooling Water", location: "Factory 2" },
  PM205: { name: "F2 AHU WF2UI", model: "PM5100", category: "HVAC", location: "Factory 2" },
  PM203: { name: "F2 HEATER WF2U2", model: "PM5100", category: "Heater", location: "Factory 2" },
  PM208: { name: "F2 WH 5", model: "PM5100", category: "Warehouse", location: "Factory 2" },
  PM207: { name: "F2 WH 6", model: "PM5100", category: "Warehouse", location: "Factory 2" },
  PM271: { name: "F2 CHILLER RTAC 250 (RO&HVAC)", model: "PA330", category: "Chiller", location: "Factory 2" },
  PM272: { name: "F2 CHILLER RTAC 170 (RO)", model: "PA330", category: "Chiller", location: "Factory 2" },
  PM274: { name: "F2 CHILLER RTAC 100 (BP)", model: "PA330", category: "Chiller", location: "Factory 2" },
  PM273: { name: "RETURN SAMPLE QC", model: "PA330", category: "Quality Control", location: "Factory 2" },
  PM201: { name: "F2 PUTR-1", model: "PM5100", category: "Distribution", location: "Factory 2" },
  PM209: { name: "F2 CHILLER - WF2U2", model: "PM5300", category: "Chiller", location: "Factory 2" },
  PM226: { name: "F2 WH-7", model: "PM5300", category: "Warehouse", location: "Factory 2" },
  PM202: { name: "F2 PUTR-2", model: "PM5100", category: "Distribution", location: "Factory 2" },
  PM288: { name: "F2 Penerangan PD", model: "PA330", category: "Lighting", location: "Factory 2" },
  PM229: { name: "F2 KOBELCO ALE-250", model: "PM5300", category: "Compressor", location: "Factory 2" },
  PM210: { name: "F2 MAIN CRITICAL PANEL", model: "PM5350", category: "Critical Panel", location: "Factory 2" },
  PM215: { name: "F2 COOLING CRITICAL", model: "PM5350", category: "Cooling Water", location: "Factory 2" },
  PM213: { name: "F2 BOILER-5", model: "PM5350", category: "Boiler", location: "Factory 2" },
  PM211: { name: "F2 PANEL OTOKLAF WF2U1", model: "PM5350", category: "Autoclave", location: "Factory 2" },
  PM214: { name: "F2 COMPRESSED AIR ATLAS", model: "PM5100", category: "Compressor", location: "Factory 2" },
  PM212: { name: "F2 PANEL OTOKLAF WF2U2", model: "PM5350", category: "Autoclave", location: "Factory 2" },

  // Incoming Cubicles (3 Main Feeders / Incoming)
  PM410: { name: "incoming cubicle pln", model: "PM8000", category: "Incoming PLN", location: "Main Substation" },
  PM411: { name: "incoming cubicle WF1", model: "PM5560", category: "Feeder WF1", location: "Factory 1" },
  PM412: { name: "incoming cubicle WF2", model: "PM5560", category: "Feeder WF2", location: "Factory 2" },
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
  // EW23 Sub-Distribution Power Meters (Fixed Static Order)
  PM318: 10,
  PM319: 20,
  PM320: 30,
  PM321: 40,
  PM322: 50,
  PM323: 60,
  PM324: 70,
  PM325: 80,
  PM327: 90,
  PM337: 100,

  // EW22 Sub-Distribution Power Meters
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
