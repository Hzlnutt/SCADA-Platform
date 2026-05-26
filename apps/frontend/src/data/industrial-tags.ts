export type IndustrialTag = {
  id: string;
  name: string;
  area: string;
  category: string;
  tagId: string;
  unit: string;
  normalMin?: number;
  normalMax?: number;
};

export const industrialTags: IndustrialTag[] = [
  {
    id: "cooling-water-1",
    name: "Cooling Water System 1",
    area: "Utilities",
    category: "Cooling",
    tagId: "cooling-water/flow_1",
    unit: "m3/h",
    normalMin: 20,
    normalMax: 60
  },
  {
    id: "cooling-water-2",
    name: "Cooling Water System 2",
    area: "Utilities",
    category: "Cooling",
    tagId: "cooling-water/flow_2",
    unit: "m3/h",
    normalMin: 20,
    normalMax: 60
  },
  {
    id: "cooling-water-3",
    name: "Cooling Water System 3",
    area: "Utilities",
    category: "Cooling",
    tagId: "cooling-water/flow_3",
    unit: "m3/h",
    normalMin: 20,
    normalMax: 60
  },
  {
    id: "boiler-a",
    name: "Boiler A",
    area: "Utilities",
    category: "Steam",
    tagId: "boiler/steam_pressure_a",
    unit: "bar",
    normalMin: 14,
    normalMax: 20
  },
  {
    id: "boiler-b",
    name: "Boiler B",
    area: "Utilities",
    category: "Steam",
    tagId: "boiler/steam_pressure_b",
    unit: "bar",
    normalMin: 14,
    normalMax: 20
  },
  {
    id: "chiller-1",
    name: "Chiller 1",
    area: "Utilities",
    category: "Cooling",
    tagId: "chiller/supply_temp_1",
    unit: "C",
    normalMin: 4,
    normalMax: 10
  },
  {
    id: "ro-1",
    name: "Reverse Osmosis 1",
    area: "Water",
    category: "Treatment",
    tagId: "ro/output_flow_1",
    unit: "m3/h",
    normalMin: 8,
    normalMax: 16
  },
  {
    id: "ro-2",
    name: "Reverse Osmosis 2",
    area: "Water",
    category: "Treatment",
    tagId: "ro/output_flow_2",
    unit: "m3/h",
    normalMin: 8,
    normalMax: 16
  },
  {
    id: "distillate-1",
    name: "Distillate Unit 1",
    area: "Process",
    category: "Water",
    tagId: "distillate/output_flow_1",
    unit: "m3/h",
    normalMin: 6,
    normalMax: 18
  },
  {
    id: "purified-water-1",
    name: "Purified Water Loop 1",
    area: "Water",
    category: "Loop",
    tagId: "pw/flow_rate_1",
    unit: "m3/h",
    normalMin: 8,
    normalMax: 24
  },
  {
    id: "psg-1",
    name: "Pure Steam Generator 1",
    area: "Utilities",
    category: "Steam",
    tagId: "psg/pressure_1",
    unit: "bar",
    normalMin: 2,
    normalMax: 5
  },
  {
    id: "wfi-1",
    name: "WFI Loop 1",
    area: "Water",
    category: "Loop",
    tagId: "wfi/conductivity_1",
    unit: "uS",
    normalMin: 0,
    normalMax: 1.3
  },
  {
    id: "compressor-a",
    name: "Compressor A",
    area: "Utilities",
    category: "Air",
    tagId: "compressor/temp_a",
    unit: "C",
    normalMin: 55,
    normalMax: 90
  },
  {
    id: "compressor-b",
    name: "Compressor B",
    area: "Utilities",
    category: "Air",
    tagId: "compressor/temp_b",
    unit: "C",
    normalMin: 55,
    normalMax: 90
  }
];

export const telemetryTagIds = industrialTags.map((tag) => tag.tagId);
