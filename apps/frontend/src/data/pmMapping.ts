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
