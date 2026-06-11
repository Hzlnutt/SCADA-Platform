export type MachineSummaryCard = {
  label: string;
  value: number;
  unit: string;
  caption?: string;
};

export type MachineHighlight = {
  label: string;
  value: string;
};

export type MachineStatusSegment = {
  label: string;
  value: number;
  color: string;
};

export type MachineTrendSeries = {
  name: string;
  values: number[];
  color: string;
  dashed?: boolean;
};

export type MachineTrend = {
  label: string;
  unit: string;
  series: MachineTrendSeries[];
};

export type MaintenanceRecord = {
  date: string;
  item: string;
  abnormality?: string;
  action: string;
  downtimeHours: number;
  technician: string;
  status: "completed" | "monitoring" | "planned";
};

export type ShiftReport = {
  shift: string;
  start: string;
  end: string;
  runtimeHours: number;
  downtimeHours: number;
  output: number;
  energy: number;
  notes: string;
};

export type MachineData = {
  id: string;
  name: string;
  area: string;
  category: string;
  tagId: string;
  unit: string;
  consumptionUnit: string;
  description: string;
  summaryCards: MachineSummaryCard[];
  highlights: MachineHighlight[];
  statusDistribution: MachineStatusSegment[];
  dailyConsumption: number[];
  trend: MachineTrend;
  maintenance: MaintenanceRecord[];
  shiftReports: ShiftReport[];
};

export type MachineUnit = MachineData & {
  groupId: string;
  groupName: string;
  unitId: string;
  unitLabel: string;
};

export type MachineGroup = {
  id: string;
  name: string;
  area: string;
  category: string;
  description: string;
  units: MachineUnit[];
  summaryCards: MachineSummaryCard[];
  highlights: MachineHighlight[];
  statusDistribution: MachineStatusSegment[];
  dailyConsumption: number[];
  trend: MachineTrend;
};

const buildSeries = (
  length: number,
  base: number,
  variance: number,
  phase = 0
) =>
  Array.from({ length }, (_, i) => {
    const wave = Math.sin((i + phase) / 3) + Math.cos((i + phase) / 7);
    return Number((base + wave * variance * 0.6).toFixed(2));
  });

const buildDaily = (base: number, variance: number) =>
  buildSeries(31, base, variance, 2).map((value) =>
    Number(value.toFixed(0))
  );

const buildMaintenance = (name: string): MaintenanceRecord[] => [
  {
    date: "2026-05-03 08:15",
    item: `${name} vibration check`,
    abnormality: "Bearing vibration high",
    action: "Alignment check and bearing inspection",
    downtimeHours: 1.4,
    technician: "A. Rahman",
    status: "completed"
  },
  {
    date: "2026-05-10 15:40",
    item: "Flow sensor calibration",
    abnormality: "Sensor drift",
    action: "Calibration and verification",
    downtimeHours: 0.8,
    technician: "N. Putri",
    status: "completed"
  },
  {
    date: "2026-05-18 09:05",
    item: "Valve response tuning",
    abnormality: "Response delay",
    action: "Servo tuning and lubrication",
    downtimeHours: 1.1,
    technician: "D. Kurnia",
    status: "monitoring"
  }
];

const buildShifts = (outputBase: number, energyBase: number): ShiftReport[] => [
  {
    shift: "Shift A",
    start: "06:00",
    end: "14:00",
    runtimeHours: Number((7.4).toFixed(1)),
    downtimeHours: Number((0.6).toFixed(1)),
    output: Number((outputBase * 1.02).toFixed(1)),
    energy: Number((energyBase * 0.98).toFixed(1)),
    notes: "Stable run, minor warmup adjustments"
  },
  {
    shift: "Shift B",
    start: "14:00",
    end: "22:00",
    runtimeHours: Number((7.0).toFixed(1)),
    downtimeHours: Number((1.0).toFixed(1)),
    output: Number((outputBase * 0.95).toFixed(1)),
    energy: Number((energyBase * 1.05).toFixed(1)),
    notes: "Optimization test, slight efficiency drop"
  },
  {
    shift: "Shift C",
    start: "22:00",
    end: "06:00",
    runtimeHours: Number((6.6).toFixed(1)),
    downtimeHours: Number((1.4).toFixed(1)),
    output: Number((outputBase * 0.9).toFixed(1)),
    energy: Number((energyBase * 0.92).toFixed(1)),
    notes: "Night cooling cycle, reduced load"
  }
];

const buildMachine = (params: {
  id: string;
  name: string;
  area: string;
  category: string;
  tagId: string;
  unit: string;
  consumptionUnit: string;
  baseValue: number;
  variance: number;
  dailyBase: number;
  dailyVariance: number;
  outputBase: number;
  energyBase: number;
}) => {
  const actualSeries = buildSeries(72, params.baseValue, params.variance, 1);
  const minLine = Number((params.baseValue - params.variance * 1.2).toFixed(2));
  const maxLine = Number((params.baseValue + params.variance * 1.2).toFixed(2));

  return {
    id: params.id,
    name: params.name,
    area: params.area,
    category: params.category,
    tagId: params.tagId,
    unit: params.unit,
    consumptionUnit: params.consumptionUnit,
    description: `${params.name} operational summary and performance trends.`,
    summaryCards: [
      { label: "Running Hours", value: 225.3, unit: "h", caption: "Last 7 days" },
      { label: "Stop Hours", value: 18.9, unit: "h", caption: "Unplanned" },
      { label: "Energy", value: params.energyBase, unit: "MWh", caption: "Daily average" },
      { label: "Output", value: params.outputBase, unit: "m3", caption: "Daily total" }
    ],
    highlights: [
      { label: "Availability", value: "92.4%" },
      { label: "Performance", value: "88.6%" },
      { label: "Quality", value: "97.2%" },
      { label: "Active Alarms", value: "2" }
    ],
    statusDistribution: [
      { label: "Running", value: 62, color: "#1f6fb5" },
      { label: "Standby", value: 26, color: "#087f5b" },
      { label: "Stop", value: 12, color: "#bd7a12" }
    ],
    dailyConsumption: buildDaily(params.dailyBase, params.dailyVariance),
    trend: {
      label: params.name,
      unit: params.unit,
      series: [
        { name: "Actual", values: actualSeries, color: "#1f6fb5" },
        { name: "Min", values: actualSeries.map(() => minLine), color: "#bd7a12", dashed: true },
        { name: "Max", values: actualSeries.map(() => maxLine), color: "#b42318", dashed: true }
      ]
    },
    maintenance: buildMaintenance(params.name),
    shiftReports: buildShifts(params.outputBase, params.energyBase)
  } satisfies MachineData;
};

const buildUnit = (params: {
  id: string;
  unitLabel: string;
  groupId: string;
  groupName: string;
  area: string;
  category: string;
  tagId: string;
  unit: string;
  consumptionUnit: string;
  baseValue: number;
  variance: number;
  dailyBase: number;
  dailyVariance: number;
  outputBase: number;
  energyBase: number;
}): MachineUnit => {
  const base = buildMachine({
    id: params.id,
    name: `${params.groupName} ${params.unitLabel}`,
    area: params.area,
    category: params.category,
    tagId: params.tagId,
    unit: params.unit,
    consumptionUnit: params.consumptionUnit,
    baseValue: params.baseValue,
    variance: params.variance,
    dailyBase: params.dailyBase,
    dailyVariance: params.dailyVariance,
    outputBase: params.outputBase,
    energyBase: params.energyBase
  });

  return {
    ...base,
    groupId: params.groupId,
    groupName: params.groupName,
    unitId: params.id,
    unitLabel: params.unitLabel
  } satisfies MachineUnit;
};

const average = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const parsePercent = (value: string) => Number(value.replace("%", ""));

const buildGroupSummary = (units: MachineUnit[]): MachineSummaryCard[] => {
  const energyValues = units.map((unit) =>
    unit.summaryCards.find((card) => card.label === "Energy")?.value ?? 0
  );
  const outputValues = units.map((unit) =>
    unit.summaryCards.find((card) => card.label === "Output")?.value ?? 0
  );
  const runningValues = units.map((unit) =>
    unit.summaryCards.find((card) => card.label === "Running Hours")?.value ?? 0
  );
  const alarmValues = units.map((unit) =>
    Number(unit.highlights.find((item) => item.label === "Active Alarms")?.value ?? 0)
  );

  return [
    {
      label: "Total Energy",
      value: Number(sum(energyValues).toFixed(1)),
      unit: "MWh",
      caption: "Daily total"
    },
    {
      label: "Avg Output",
      value: Number(average(outputValues).toFixed(1)),
      unit: "m3",
      caption: "Daily average"
    },
    {
      label: "Running Hours",
      value: Number(average(runningValues).toFixed(1)),
      unit: "h",
      caption: "Last 7 days"
    },
    {
      label: "Active Alarms",
      value: sum(alarmValues),
      unit: "",
      caption: "Open now"
    }
  ];
};

const buildGroupHighlights = (units: MachineUnit[]): MachineHighlight[] => {
  const availability = average(
    units.map((unit) =>
      parsePercent(unit.highlights.find((item) => item.label === "Availability")?.value ?? "0")
    )
  );
  const performance = average(
    units.map((unit) =>
      parsePercent(unit.highlights.find((item) => item.label === "Performance")?.value ?? "0")
    )
  );
  const quality = average(
    units.map((unit) =>
      parsePercent(unit.highlights.find((item) => item.label === "Quality")?.value ?? "0")
    )
  );
  const alarms = sum(
    units.map((unit) =>
      Number(unit.highlights.find((item) => item.label === "Active Alarms")?.value ?? 0)
    )
  );

  return [
    { label: "Availability", value: `${availability.toFixed(1)}%` },
    { label: "Performance", value: `${performance.toFixed(1)}%` },
    { label: "Quality", value: `${quality.toFixed(1)}%` },
    { label: "Active Alarms", value: String(alarms) }
  ];
};

const buildGroupTrend = (
  units: MachineUnit[],
  label: string,
  unit: string
): MachineTrend => {
  const length = units[0]?.trend.series[0]?.values.length ?? 0;
  const actual = Array.from({ length }, (_, index) =>
    Number(
      average(units.map((unit) => unit.trend.series[0].values[index] ?? 0)).toFixed(2)
    )
  );
  const minLine = actual.length
    ? Math.min(...actual) - 0.4
    : 0;
  const maxLine = actual.length
    ? Math.max(...actual) + 0.4
    : 0;

  return {
    label,
    unit,
    series: [
      { name: "Actual", values: actual, color: "#1f6fb5" },
      { name: "Min", values: actual.map(() => minLine), color: "#bd7a12", dashed: true },
      { name: "Max", values: actual.map(() => maxLine), color: "#b42318", dashed: true }
    ]
  };
};

const buildGroupDaily = (units: MachineUnit[]) => {
  const length = units[0]?.dailyConsumption.length ?? 0;
  return Array.from({ length }, (_, index) =>
    Number(sum(units.map((unit) => unit.dailyConsumption[index] ?? 0)).toFixed(0))
  );
};

const buildGroup = (params: {
  id: string;
  name: string;
  area: string;
  category: string;
  units: MachineUnit[];
}): MachineGroup => {
  return {
    id: params.id,
    name: params.name,
    area: params.area,
    category: params.category,
    description: `${params.name} performance summary across units.`,
    units: params.units,
    summaryCards: buildGroupSummary(params.units),
    highlights: buildGroupHighlights(params.units),
    statusDistribution: params.units[0]?.statusDistribution ?? [],
    dailyConsumption: buildGroupDaily(params.units),
    trend: buildGroupTrend(params.units, params.name, params.units[0]?.unit ?? "")
  } satisfies MachineGroup;
};

export const machineGroups: MachineGroup[] = [
  buildGroup({
    id: "cooling-water-system",
    name: "Cooling Water System",
    area: "Utilities",
    category: "Cooling",
    units: [
      buildUnit({
        id: "cooling-water-1",
        unitLabel: "WF1U3",
        groupId: "cooling-water-system",
        groupName: "Cooling Water System",
        area: "Utilities",
        category: "Cooling",
        tagId: "cooling-water/flow_1",
        unit: "m3/h",
        consumptionUnit: "m3",
        baseValue: 42,
        variance: 7,
        dailyBase: 4400,
        dailyVariance: 640,
        outputBase: 1360,
        energyBase: 98
      }),
      buildUnit({
        id: "cooling-water-2",
        unitLabel: "Unit 2",
        groupId: "cooling-water-system",
        groupName: "Cooling Water System",
        area: "Utilities",
        category: "Cooling",
        tagId: "cooling-water/flow_2",
        unit: "m3/h",
        consumptionUnit: "m3",
        baseValue: 38,
        variance: 6,
        dailyBase: 4200,
        dailyVariance: 620,
        outputBase: 1290,
        energyBase: 94
      }),
      buildUnit({
        id: "cooling-water-3",
        unitLabel: "Unit 3",
        groupId: "cooling-water-system",
        groupName: "Cooling Water System",
        area: "Utilities",
        category: "Cooling",
        tagId: "cooling-water/flow_3",
        unit: "m3/h",
        consumptionUnit: "m3",
        baseValue: 41,
        variance: 6.5,
        dailyBase: 4350,
        dailyVariance: 600,
        outputBase: 1330,
        energyBase: 96
      })
    ]
  }),
  buildGroup({
    id: "boiler-plant",
    name: "Boiler Plant",
    area: "Utilities",
    category: "Steam",
    units: [
      buildUnit({
        id: "boiler-1",
        unitLabel: "Boiler A",
        groupId: "boiler-plant",
        groupName: "Boiler Plant",
        area: "Utilities",
        category: "Steam",
        tagId: "boiler/steam_pressure_a",
        unit: "bar",
        consumptionUnit: "m3",
        baseValue: 18.6,
        variance: 1.4,
        dailyBase: 5600,
        dailyVariance: 850,
        outputBase: 1810,
        energyBase: 126
      }),
      buildUnit({
        id: "boiler-2",
        unitLabel: "Boiler B",
        groupId: "boiler-plant",
        groupName: "Boiler Plant",
        area: "Utilities",
        category: "Steam",
        tagId: "boiler/steam_pressure_b",
        unit: "bar",
        consumptionUnit: "m3",
        baseValue: 17.4,
        variance: 1.6,
        dailyBase: 5400,
        dailyVariance: 800,
        outputBase: 1700,
        energyBase: 120
      }),
      buildUnit({
        id: "boiler-3",
        unitLabel: "Boiler-3 WF1",
        groupId: "boiler-plant",
        groupName: "Boiler Plant",
        area: "Utilities",
        category: "Steam",
        tagId: "boiler/boiler_3_pressure",
        unit: "bar",
        consumptionUnit: "m3",
        baseValue: 18.0,
        variance: 1.5,
        dailyBase: 5000,
        dailyVariance: 800,
        outputBase: 1750,
        energyBase: 122
      }),
      buildUnit({
        id: "boiler-4",
        unitLabel: "Boiler-4",
        groupId: "boiler-plant",
        groupName: "Boiler Plant",
        area: "Utilities",
        category: "Steam",
        tagId: "boiler/boiler_4_pressure",
        unit: "bar",
        consumptionUnit: "m3",
        baseValue: 17.5,
        variance: 1.2,
        dailyBase: 4800,
        dailyVariance: 700,
        outputBase: 1650,
        energyBase: 115
      }),
      buildUnit({
        id: "boiler-5",
        unitLabel: "Boiler-5",
        groupId: "boiler-plant",
        groupName: "Boiler Plant",
        area: "Utilities",
        category: "Steam",
        tagId: "boiler/boiler_5_pressure",
        unit: "bar",
        consumptionUnit: "m3",
        baseValue: 17.8,
        variance: 1.3,
        dailyBase: 4900,
        dailyVariance: 750,
        outputBase: 1680,
        energyBase: 118
      })
    ]
  }),
  buildGroup({
    id: "water-treatment",
    name: "Water Treatment",
    area: "Water",
    category: "Treatment",
    units: [
      buildUnit({
        id: "reverse-osmosis-1",
        unitLabel: "RO 1",
        groupId: "water-treatment",
        groupName: "Water Treatment",
        area: "Water",
        category: "Treatment",
        tagId: "ro/output_flow_1",
        unit: "m3/h",
        consumptionUnit: "m3",
        baseValue: 11.8,
        variance: 1.6,
        dailyBase: 2800,
        dailyVariance: 410,
        outputBase: 1020,
        energyBase: 70
      }),
      buildUnit({
        id: "reverse-osmosis-2",
        unitLabel: "RO 2",
        groupId: "water-treatment",
        groupName: "Water Treatment",
        area: "Water",
        category: "Treatment",
        tagId: "ro/output_flow_2",
        unit: "m3/h",
        consumptionUnit: "m3",
        baseValue: 12.2,
        variance: 1.4,
        dailyBase: 2900,
        dailyVariance: 400,
        outputBase: 1040,
        energyBase: 72
      })
    ]
  }),
  buildGroup({
    id: "compressor-house",
    name: "Compressor House",
    area: "Utilities",
    category: "Air",
    units: [
      buildUnit({
        id: "compressor-1",
        unitLabel: "Compressor A",
        groupId: "compressor-house",
        groupName: "Compressor House",
        area: "Utilities",
        category: "Air",
        tagId: "compressor/temp_a",
        unit: "C",
        consumptionUnit: "kWh",
        baseValue: 82,
        variance: 6,
        dailyBase: 3600,
        dailyVariance: 520,
        outputBase: 1100,
        energyBase: 86
      }),
      buildUnit({
        id: "compressor-2",
        unitLabel: "Compressor B",
        groupId: "compressor-house",
        groupName: "Compressor House",
        area: "Utilities",
        category: "Air",
        tagId: "compressor/temp_b",
        unit: "C",
        consumptionUnit: "kWh",
        baseValue: 80,
        variance: 5.5,
        dailyBase: 3500,
        dailyVariance: 480,
        outputBase: 1070,
        energyBase: 82
      })
    ]
  }),
  buildGroup({
    id: "chiller-system",
    name: "Chiller System",
    area: "Utilities",
    category: "Cooling",
    units: [
      buildUnit({
        id: "trane-cgam-40",
        unitLabel: "Trane CGAM-40",
        groupId: "chiller-system",
        groupName: "Chiller System",
        area: "Utilities",
        category: "Cooling",
        tagId: "chiller/trane_cgam_40_temp",
        unit: "C",
        consumptionUnit: "kWh",
        baseValue: 6.8,
        variance: 1.1,
        dailyBase: 4200,
        dailyVariance: 620,
        outputBase: 1320,
        energyBase: 94
      }),
      buildUnit({
        id: "daikin-wf1u3",
        unitLabel: "Daikin WF1U3",
        groupId: "chiller-system",
        groupName: "Chiller System",
        area: "Utilities",
        category: "Cooling",
        tagId: "chiller/daikin_wf1u3_temp",
        unit: "C",
        consumptionUnit: "kWh",
        baseValue: 7.2,
        variance: 1.2,
        dailyBase: 4100,
        dailyVariance: 600,
        outputBase: 1290,
        energyBase: 90
      }),
      buildUnit({
        id: "rtac-100",
        unitLabel: "RTAC-100",
        groupId: "chiller-system",
        groupName: "Chiller System",
        area: "Utilities",
        category: "Cooling",
        tagId: "chiller/rtac_100_temp",
        unit: "C",
        consumptionUnit: "kWh",
        baseValue: 6.9,
        variance: 1.0,
        dailyBase: 4300,
        dailyVariance: 610,
        outputBase: 1310,
        energyBase: 92
      }),
      buildUnit({
        id: "rtac-275",
        unitLabel: "RTAC-275",
        groupId: "chiller-system",
        groupName: "Chiller System",
        area: "Utilities",
        category: "Cooling",
        tagId: "chiller/rtac_275_temp",
        unit: "C",
        consumptionUnit: "kWh",
        baseValue: 6.5,
        variance: 0.9,
        dailyBase: 4500,
        dailyVariance: 640,
        outputBase: 1380,
        energyBase: 98
      })
    ]
  }),
  buildGroup({
    id: "distillate-unit",
    name: "Distillate Unit",
    area: "Process",
    category: "Water",
    units: [
      buildUnit({
        id: "distillate-1",
        unitLabel: "Unit 1",
        groupId: "distillate-unit",
        groupName: "Distillate Unit",
        area: "Process",
        category: "Water",
        tagId: "distillate/output_flow_1",
        unit: "m3/h",
        consumptionUnit: "m3",
        baseValue: 12.4,
        variance: 1.8,
        dailyBase: 3100,
        dailyVariance: 540,
        outputBase: 980,
        energyBase: 72
      })
    ]
  }),
  buildGroup({
    id: "purified-water-loop",
    name: "Purified Water Loop",
    area: "Water",
    category: "Loop",
    units: [
      buildUnit({
        id: "purified-water-1",
        unitLabel: "Loop 1",
        groupId: "purified-water-loop",
        groupName: "Purified Water Loop",
        area: "Water",
        category: "Loop",
        tagId: "pw/flow_rate_1",
        unit: "m3/h",
        consumptionUnit: "m3",
        baseValue: 18.3,
        variance: 2.2,
        dailyBase: 5200,
        dailyVariance: 700,
        outputBase: 1450,
        energyBase: 110
      })
    ]
  }),
  buildGroup({
    id: "pure-steam-generator",
    name: "Pure Steam Generator",
    area: "Utilities",
    category: "Steam",
    units: [
      buildUnit({
        id: "psg-1",
        unitLabel: "PSG 1",
        groupId: "pure-steam-generator",
        groupName: "Pure Steam Generator",
        area: "Utilities",
        category: "Steam",
        tagId: "psg/pressure_1",
        unit: "bar",
        consumptionUnit: "m3",
        baseValue: 3.4,
        variance: 0.6,
        dailyBase: 1900,
        dailyVariance: 320,
        outputBase: 760,
        energyBase: 48
      })
    ]
  }),
  buildGroup({
    id: "wfi-loop",
    name: "WFI Loop",
    area: "Water",
    category: "Loop",
    units: [
      buildUnit({
        id: "wfi-1",
        unitLabel: "Loop 1",
        groupId: "wfi-loop",
        groupName: "WFI Loop",
        area: "Water",
        category: "Loop",
        tagId: "wfi/conductivity_1",
        unit: "uS",
        consumptionUnit: "m3",
        baseValue: 0.78,
        variance: 0.18,
        dailyBase: 2400,
        dailyVariance: 360,
        outputBase: 880,
        energyBase: 58
      })
    ]
  }),
  buildGroup({
    id: "compressed-air",
    name: "Compressed Air",
    area: "Utilities",
    category: "Air",
    units: [
      buildUnit({
        id: "ale-30",
        unitLabel: "ALE-30",
        groupId: "compressed-air",
        groupName: "Compressed Air",
        area: "Utilities",
        category: "Air",
        tagId: "compressed-air/ale_30_pressure",
        unit: "bar",
        consumptionUnit: "kWh",
        baseValue: 7.2,
        variance: 0.5,
        dailyBase: 3600,
        dailyVariance: 520,
        outputBase: 1100,
        energyBase: 86
      }),
      buildUnit({
        id: "zt-30.1",
        unitLabel: "ZT-30.1",
        groupId: "compressed-air",
        groupName: "Compressed Air",
        area: "Utilities",
        category: "Air",
        tagId: "compressed-air/zt_30_1_pressure",
        unit: "bar",
        consumptionUnit: "kWh",
        baseValue: 7.0,
        variance: 0.4,
        dailyBase: 3400,
        dailyVariance: 480,
        outputBase: 1050,
        energyBase: 82
      }),
      buildUnit({
        id: "zt-30-2",
        unitLabel: "ZT-30.2",
        groupId: "compressed-air",
        groupName: "Compressed Air",
        area: "Utilities",
        category: "Air",
        tagId: "compressed-air/zt_30_2_pressure",
        unit: "bar",
        consumptionUnit: "kWh",
        baseValue: 7.1,
        variance: 0.45,
        dailyBase: 3500,
        dailyVariance: 500,
        outputBase: 1070,
        energyBase: 84
      }),
      buildUnit({
        id: "zt-55",
        unitLabel: "ZT-55",
        groupId: "compressed-air",
        groupName: "Compressed Air",
        area: "Utilities",
        category: "Air",
        tagId: "compressed-air/zt_55_pressure",
        unit: "bar",
        consumptionUnit: "kWh",
        baseValue: 7.4,
        variance: 0.6,
        dailyBase: 3800,
        dailyVariance: 540,
        outputBase: 1150,
        energyBase: 90
      }),
      buildUnit({
        id: "ingersoll-55",
        unitLabel: "Ingersoll-55",
        groupId: "compressed-air",
        groupName: "Compressed Air",
        area: "Utilities",
        category: "Air",
        tagId: "compressed-air/ingersoll_55_pressure",
        unit: "bar",
        consumptionUnit: "kWh",
        baseValue: 7.3,
        variance: 0.55,
        dailyBase: 3700,
        dailyVariance: 530,
        outputBase: 1120,
        energyBase: 88
      }),
      buildUnit({
        id: "ale-250",
        unitLabel: "ALE-250",
        groupId: "compressed-air",
        groupName: "Compressed Air",
        area: "Utilities",
        category: "Air",
        tagId: "compressed-air/ale_250_pressure",
        unit: "bar",
        consumptionUnit: "kWh",
        baseValue: 7.5,
        variance: 0.7,
        dailyBase: 4200,
        dailyVariance: 600,
        outputBase: 1250,
        energyBase: 98
      }),
      buildUnit({
        id: "zt-110",
        unitLabel: "ZT-110",
        groupId: "compressed-air",
        groupName: "Compressed Air",
        area: "Utilities",
        category: "Air",
        tagId: "compressed-air/zt_110_pressure",
        unit: "bar",
        consumptionUnit: "kWh",
        baseValue: 7.2,
        variance: 0.5,
        dailyBase: 3900,
        dailyVariance: 560,
        outputBase: 1180,
        energyBase: 92
      })
    ]
  }),
  buildGroup({
    id: "hvac",
    name: "HVAC",
    area: "HVAC",
    category: "Air",
    units: [
      { id: "hvac-qc-lab", label: "QC Lab" },
      { id: "hvac-qc-retained-sample", label: "AHU-01 Retained" },
      { id: "hvac-wh-3", label: "WH-3" },
      { id: "hvac-wh-4", label: "WH-4" },
      { id: "hvac-wh-5", label: "WH-5" },
      { id: "hvac-wh-6", label: "WH-6" },
      { id: "hvac-wh-7", label: "WH-7" },
      { id: "hvac-preparation-wf1u3", label: "Prep WF1U3" },
      { id: "hvac-bottlepack-wf1u3", label: "Bottlepack WF1U3" },
      { id: "hvac-qc-sampling-wf1u3", label: "QC Sampling WF1U3" },
      { id: "hvac-corridor-wf1u3", label: "Corridor WF1U3" },
      { id: "hvac-steril-ip-wf1u3", label: "Steril IP WF1U3" },
      { id: "hvac-preparation-wf2u1", label: "Prep WF2U1" },
      { id: "hvac-bottlepack-wf2u1", label: "Bottlepack WF2U1" },
      { id: "hvac-weighing-wf2u1", label: "Weighing WF2U1" },
      { id: "hvac-laundry-wf2u1", label: "Laundry WF2U1" },
      { id: "hvac-steril-wf2u1", label: "Steril WF2U1" },
      { id: "hvac-ip-wf2u1", label: "IP WF2U1" },
      { id: "hvac-corridor-wf2u1", label: "Corridor WF2U1" },
      { id: "hvac-material-wf2u1", label: "Material WF2U1" },
      { id: "hvac-wt-wf2u1", label: "WT WF2U1" },
      { id: "hvac-qc-wf2u1", label: "QC WF2U1" },
      { id: "oac-1-wf2u1", label: "OAC-1 WF2U1" },
      { id: "oac-2-wf2u1", label: "OAC-2 WF2U1" },
      { id: "hvac-preparation-wf2u2", label: "Prep WF2U2" },
      { id: "hvac-bottlepack-wf2u2", label: "Bottlepack WF2U2" },
      { id: "hvac-steril-wf2u2", label: "Steril WF2U2" },
      { id: "hvac-ip-wf2u2", label: "IP WF2U2" },
      { id: "hvac-corridor-bp-wf2u2", label: "Corridor BP" },
      { id: "oac-wf2u2", label: "OAC WF2U2" }
    ].map((u, i) => buildUnit({
      id: u.id,
      unitLabel: u.label,
      groupId: "hvac",
      groupName: "HVAC",
      area: "HVAC",
      category: "Air",
      tagId: `hvac/${u.id.replace("hvac-", "")}_temp`,
      unit: "C",
      consumptionUnit: "kWh",
      baseValue: 22.0,
      variance: 2.0,
      dailyBase: 1200 + i * 20,
      dailyVariance: 150,
      outputBase: 500,
      energyBase: 35
    }))
  })
];

export const machineUnits = machineGroups.flatMap((group) => group.units);
export const machines = machineUnits;

export const defaultGroupId = machineGroups[0]?.id ?? "";
export const defaultUnitId = machineGroups[0]?.units[0]?.id ?? "";

export const getGroupById = (id: string | undefined) =>
  machineGroups.find((group) => group.id === id);

export const getUnitById = (id: string | undefined) =>
  machineUnits.find((unit) => unit.id === id);

export const getUnitsByGroup = (groupId: string | undefined) =>
  machineUnits.filter((unit) => unit.groupId === groupId);

export const getMachineById = (id: string | undefined) => getUnitById(id);
