export type DeviceCatalogItem = {
  id: string;
  name: string;
  area: string;
  category: string;
  tagId?: string;
  unit?: string;
};

export const deviceCatalog: DeviceCatalogItem[] = [
  {
    id: "boiler",
    name: "Boiler",
    area: "Utilities",
    category: "Steam",
    tagId: "boiler/steam_pressure",
    unit: "bar"
  },
  {
    id: "chiller",
    name: "Chiller",
    area: "Utilities",
    category: "Cooling",
    tagId: "chiller/supply_temp",
    unit: "C"
  },
  {
    id: "cooling",
    name: "Cooling",
    area: "Utilities",
    category: "Cooling",
    tagId: "cooling/return_temp",
    unit: "C"
  },
  {
    id: "distillate",
    name: "Distillate Unit",
    area: "Process",
    category: "Water",
    tagId: "distillate/output_flow",
    unit: "m3/h"
  },
  {
    id: "purified-water-loop",
    name: "Purified Water Loop",
    area: "Water",
    category: "Loop",
    tagId: "pw/flow_rate",
    unit: "m3/h"
  },
  {
    id: "pure-steam",
    name: "Pure Steam Generator",
    area: "Utilities",
    category: "Steam",
    tagId: "psg/pressure",
    unit: "bar"
  },
  {
    id: "reverse-osmosis",
    name: "Reverse Osmosis",
    area: "Water",
    category: "Treatment",
    tagId: "ro/output_flow",
    unit: "m3/h"
  },
  {
    id: "wfi-loop",
    name: "Water for Injection Loop",
    area: "Water",
    category: "Loop",
    tagId: "wfi/conductivity",
    unit: "uS"
  },
  {
    id: "compressor",
    name: "Compressor",
    area: "Utilities",
    category: "Air",
    tagId: "compressor/temp",
    unit: "C"
  },
  {
    id: "cooling-water",
    name: "Cooling Water System",
    area: "Utilities",
    category: "Cooling",
    tagId: "cooling-water/flow",
    unit: "m3/h"
  }
];
