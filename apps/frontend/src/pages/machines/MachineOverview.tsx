import { useEffect, useMemo, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { getUnitById } from "../../data/machines";
import { useTelemetryStore } from "../../store/telemetry.store";
import { useSystemStore } from "../../store/system.store";
import type { MachineOutletContext } from "./MachineLayout";
import "../../components/charts/chartjs";
import { DEFAULT_HVAC_CONFIG, getDefaultEqConfigs } from "../../data/equipment";
import type { HvacConfig } from "../../data/equipment";

import { useMachineConfig } from "../../hooks/useMachineConfig";
import { getSocket } from "../../services/socket.service";

export default function MachineOverview() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  const { machines, categories } = useMachineConfig();
  const machineConfig = machines?.find((m) => m.id === unitId);
  const category = categories?.find((c) => c._id === machineConfig?.categoryId || c.id === machineConfig?.categoryId);

  // Subscribe dynamically to socket tags when the unit changes
  useEffect(() => {
    const socket = getSocket();
    const tagIds: string[] = [];
    if (machineConfig && machineConfig.apiBindings) {
      tagIds.push(...Object.values(machineConfig.apiBindings).filter(Boolean));
    }
    if (unitId === "cooling-water-1") {
      tagIds.push(
        "cooling-water/fan_status_1", "cooling-water/fan_status_2", "cooling-water/fan_status_3",
        "cooling-water/motor_status_1", "cooling-water/motor_status_2", "cooling-water/motor_status_3",
        "cooling-water/pressure_1", "cooling-water/pressure_2", "cooling-water/pressure_3",
        "cooling-water/basin_lvl",
        "cooling-water/eq_status_du03", "cooling-water/eq_press_du03",
        "cooling-water/eq_status_bp03", "cooling-water/eq_press_bp03",
        "cooling-water/eq_status_prep03", "cooling-water/eq_press_prep03",
        "cooling-water/eq_status_st03", "cooling-water/eq_press_st03",
        "cooling-water/eq_status_washing", "cooling-water/eq_press_washing"
      );
    }
    if (tagIds.length > 0) {
      socket.emit("telemetry:subscribe", { tagIds });
    }
  }, [machineConfig, unitId]);

  if (unitId === "hvac-qc-retained-sample") {
    return (
      <HvacOverview
        unitId={unitId}
        theme={theme}
        isDark={isDark}
        machineConfig={machineConfig}
        category={category}
      />
    );
  }

  return (
    <StandardMachineOverview
      unitId={unitId}
      theme={theme}
      isDark={isDark}
      machineConfig={machineConfig}
      category={category}
    />
  );
}

const INITIAL_ALARMS = [
  { id: "1", timestamp: "08:42:11", description: "Reference Room Temp High (42.4°C)", equipment: "AHU-02", status: "Active" },
  { id: "2", timestamp: "08:31:05", description: "CU-03B Compressor Trip", equipment: "AHU-03 / CU-03B", status: "Active" },
  { id: "3", timestamp: "07:58:44", description: "Pre-Filter Differential Pressure High", equipment: "AHU-02", status: "Resolved" },
  { id: "4", timestamp: "07:12:03", description: "Humidifier water tank level low", equipment: "AHU-03", status: "Resolved" },
  { id: "5", timestamp: "06:20:18", description: "AHU-01 switched to Auto Mode", equipment: "AHU-01", status: "Resolved" }
];

function StandardMachineOverview({
  unitId,
  theme,
  isDark,
  machineConfig,
  category
}: {
  unitId: string;
  theme: string;
  isDark: boolean;
  machineConfig?: any;
  category?: any;
}) {
  const machine = getUnitById(unitId);

  // Sub-tab selection: 'telemetry' or 'process'
  const [subTab, setSubTab] = useState<"telemetry" | "process">("telemetry");

  // Load alarms and eqConfigs to compute active alarms
  const alarms = useMemo(() => {
    const saved = localStorage.getItem(`scada.alarm_logs.${unitId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_ALARMS;
  }, [unitId]);

  const eqConfigs = useMemo(() => {
    let configs = getDefaultEqConfigs(unitId);
    const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
    if (savedEq) {
      try {
        configs = JSON.parse(savedEq);
      } catch (e) {}
    }
    return configs;
  }, [unitId]);

  const dynamicAlarms = useMemo(() => {
    return eqConfigs
      .filter((item) => item.enableAlert && (item.runHoursBeforeMaintenance ?? item.baseline) >= item.highLimit)
      .map((item) => ({
        id: `maint-overdue-${item.tagKey}`,
        timestamp: "08:00:00",
        description: `Maintenance Overdue: ${item.tagName} (${(item.runHoursBeforeMaintenance ?? item.baseline).toLocaleString()} / ${item.highLimit.toLocaleString()} hrs)`,
        equipment: item.tagKey,
        operatorAction: "",
        status: "Active" as const,
        rtn: "—",
        operatorName: "",
        approverName: ""
      }));
  }, [eqConfigs]);

  const allActiveAlarms = useMemo(() => {
    const staticActive = alarms.filter((item: any) => item.status === "Active");
    return [...dynamicAlarms, ...staticActive];
  }, [alarms, dynamicAlarms]);

  // Dynamic baselines from config (localStorage)
  const baselines = useMemo(() => {
    const defaultBaselines: Record<string, number> = {
      SPLY_WTR_TEMP: 31.0,
      SPLY_WTR_TDS: 300.0,
      SPLY_WTR_PH: 7.0,
      SPLY_WTR_FLOW: 400.0,
      RTN_WTR_TEMP: 40.0,
      MAKEUP_WTR_TDS: 150.0,
      MAKEUP_WTR_PH: 7.0,
      AMBIENT_HUMIDITY: 70.0
    };

    const saved = localStorage.getItem(`scada.config.${unitId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const mapped: Record<string, number> = {};
        parsed.forEach((row: any) => {
          mapped[row.tagKey] = row.baseline;
        });
        return { ...defaultBaselines, ...mapped };
      } catch (e) {
        // use default
      }
    }
    return defaultBaselines;
  }, [unitId]);

  // Simulated live telemetry state with slight random drift
  // Simulated live telemetry state with slight random drift
  const [liveDataState, setLiveDataState] = useState({
    supplyTemp: 29.9,
    returnTemp: 39.9,
    ambientTemp: 31.9,
    ctEfficiency: 95.2,
    totalEnergy: 284780,

    supplyTds: 275,
    supplyPh: 7.0,
    supplyFlow: 399.9,
    makeupVol: 35.8,
    makeupTds: 175, // above baseline 150
    makeupPh: 7.2,
    makeupTemp: 32.2,
    ambientHumidity: 68.9,
    blowdownVol: 15.3,

    ct1: { fanStatus: true, fanSpeed: 1415, motorStatus: true, motorCurrent: 41.2, motorPower: 22.3, flow: 120, pressure: 2.26, vibration: 1.75, vibraFan: 1.75, vibraMotor: 1.85, basinTemp: 28.3, runningHours: 5234 },
    ct2: { fanStatus: true, fanSpeed: 1412, motorStatus: true, motorCurrent: 40.8, motorPower: 22.1, flow: 119, pressure: 2.24, vibration: 1.72, vibraFan: 1.72, vibraMotor: 1.81, basinTemp: 28.1, runningHours: 5234 },
    ct3: { fanStatus: true, fanSpeed: 1418, motorStatus: true, motorCurrent: 41.5, motorPower: 22.5, flow: 121, pressure: 2.28, vibration: 1.78, vibraFan: 1.78, vibraMotor: 1.89, basinTemp: 28.5, runningHours: 5234 },

    coolingTank: { ph: 7.1, tds: 826.6, cond: 1350.5, lvl: 74.9, temp: 29.0 },
    makeupWater: { ph: 7.0, tds: 320.0, flow: 2.4, vol: 45.2 },
    dosingA: { status: "Injecting", flow: 1.2, hrs: 2345, cons: 15.6 },
    dosingB: { status: "Standby", flow: 0.0, hrs: 1890, cons: 12.3 },
    blowdown: { status: "Active", flow: 0.7, vol: 12.8 },

    equipment: [
      { area: "DU-03", status: "Running", flow: 43.9, press: 3.22, curr: 26.7, pow: 15.1, hrs: 6789, vib: 1.8, temp: 38.2, maint: "Good" },
      { area: "BP-03", status: "Running", flow: 38.5, press: 2.75, curr: 20.2, pow: 10.6, hrs: 5432, vib: 1.5, temp: 35.4, maint: "Good" },
      { area: "PREP-03", status: "Running", flow: 33.7, press: 2.36, curr: 19.5, pow: 10.5, hrs: 4321, vib: 2.4, temp: 42.1, maint: "Warning" },
      { area: "ST-03", status: "Standby", flow: 0.0, press: 0.00, curr: 0.0, pow: 0.0, hrs: 3456, vib: 0.1, temp: 28.5, maint: "Good" },
      { area: "WASHING", status: "Running", flow: 10.3, press: 2.02, curr: 10.8, pow: 7.1, hrs: 2789, vib: 1.2, temp: 33.1, maint: "Good" },
      { area: "MINI LAB", status: "Running", flow: 7.2, press: 1.61, curr: 5.5, pow: 3.3, hrs: 1567, vib: 0.9, temp: 30.4, maint: "Good" }
    ]
  });

  const latest = useTelemetryStore((state) => state.latest);

  // Compute live data reactively by merging state with real socket telemetry if present
  const liveData = useMemo(() => {
    let dynamicSupplyTemp = liveDataState.supplyTemp;
    let dynamicReturnTemp = liveDataState.returnTemp;
    let dynamicSupplyFlow = liveDataState.supplyFlow;
    let dynamicSupplyTds = liveDataState.supplyTds;
    let dynamicSupplyPh = liveDataState.supplyPh;

    if (machineConfig) {
      const tempTag = machineConfig.apiBindings["temp"] || machineConfig.apiBindings["supply_temp"] || "";
      const flowTag = machineConfig.apiBindings["flow"] || machineConfig.apiBindings["supply_flow"] || "";
      const tdsTag = machineConfig.apiBindings["tds"] || machineConfig.apiBindings["supply_tds"] || "";
      const phTag = machineConfig.apiBindings["ph"] || machineConfig.apiBindings["supply_ph"] || "";
      const returnTempTag = machineConfig.apiBindings["return_temp"] || "";

      if (tempTag && typeof latest[tempTag]?.value === "number") {
        dynamicSupplyTemp = latest[tempTag].value;
      }
      if (returnTempTag && typeof latest[returnTempTag]?.value === "number") {
        dynamicReturnTemp = latest[returnTempTag].value;
      }
      if (flowTag && typeof latest[flowTag]?.value === "number") {
        dynamicSupplyFlow = latest[flowTag].value;
      }
      if (tdsTag && typeof latest[tdsTag]?.value === "number") {
        dynamicSupplyTds = latest[tdsTag].value;
      }
      if (phTag && typeof latest[phTag]?.value === "number") {
        dynamicSupplyPh = latest[phTag].value;
      }
    } else {
      const ct1Flow = latest["cooling-water/flow_1"]?.value;
      if (typeof ct1Flow === "number") {
        dynamicSupplyFlow = ct1Flow;
      }
    }

    const ct2Flow = latest["cooling-water/flow_2"]?.value;
    const ct3Flow = latest["cooling-water/flow_3"]?.value;

    const ct1Fan = latest["cooling-water/fan_status_1"]?.value;
    const ct2Fan = latest["cooling-water/fan_status_2"]?.value;
    const ct3Fan = latest["cooling-water/fan_status_3"]?.value;

    const ct1Mtr = latest["cooling-water/motor_status_1"]?.value;
    const ct2Mtr = latest["cooling-water/motor_status_2"]?.value;
    const ct3Mtr = latest["cooling-water/motor_status_3"]?.value;

    const ct1Press = latest["cooling-water/pressure_1"]?.value;
    const ct2Press = latest["cooling-water/pressure_2"]?.value;
    const ct3Press = latest["cooling-water/pressure_3"]?.value;

    const basinLvl = latest["cooling-water/basin_lvl"]?.value;

    const eqPressDu03 = latest["cooling-water/eq_press_du03"]?.value;
    const eqPressBp03 = latest["cooling-water/eq_press_bp03"]?.value;
    const eqPressPrep03 = latest["cooling-water/eq_press_prep03"]?.value;
    const eqPressSt03 = latest["cooling-water/eq_press_st03"]?.value;
    const eqPressWashing = latest["cooling-water/eq_press_washing"]?.value;

    const eqStatusDu03 = latest["cooling-water/eq_status_du03"]?.value;
    const eqStatusBp03 = latest["cooling-water/eq_status_bp03"]?.value;
    const eqStatusPrep03 = latest["cooling-water/eq_status_prep03"]?.value;
    const eqStatusSt03 = latest["cooling-water/eq_status_st03"]?.value;
    const eqStatusWashing = latest["cooling-water/eq_status_washing"]?.value;

    return {
      ...liveDataState,
      supplyTemp: dynamicSupplyTemp,
      returnTemp: dynamicReturnTemp,
      supplyFlow: dynamicSupplyFlow,
      supplyTds: dynamicSupplyTds,
      supplyPh: dynamicSupplyPh,
      ct1: {
        ...liveDataState.ct1,
        flow: dynamicSupplyFlow,
        fanStatus: typeof ct1Fan === "number" ? ct1Fan === 1 : liveDataState.ct1.fanStatus,
        motorStatus: typeof ct1Mtr === "number" ? ct1Mtr === 1 : liveDataState.ct1.motorStatus,
        pressure: typeof ct1Press === "number" ? ct1Press : liveDataState.ct1.pressure,
      },
      ct2: {
        ...liveDataState.ct2,
        flow: typeof ct2Flow === "number" ? ct2Flow : liveDataState.ct2.flow,
        fanStatus: typeof ct2Fan === "number" ? ct2Fan === 1 : liveDataState.ct2.fanStatus,
        motorStatus: typeof ct2Mtr === "number" ? ct2Mtr === 1 : liveDataState.ct2.motorStatus,
        pressure: typeof ct2Press === "number" ? ct2Press : liveDataState.ct2.pressure,
      },
      ct3: {
        ...liveDataState.ct3,
        flow: typeof ct3Flow === "number" ? ct3Flow : liveDataState.ct3.flow,
        fanStatus: typeof ct3Fan === "number" ? ct3Fan === 1 : liveDataState.ct3.fanStatus,
        motorStatus: typeof ct3Mtr === "number" ? ct3Mtr === 1 : liveDataState.ct3.motorStatus,
        pressure: typeof ct3Press === "number" ? ct3Press : liveDataState.ct3.pressure,
      },
      coolingTank: {
        ...liveDataState.coolingTank,
        lvl: typeof basinLvl === "number" ? basinLvl : liveDataState.coolingTank.lvl,
      },
      equipment: [
        {
          ...liveDataState.equipment[0],
          status: typeof eqStatusDu03 === "number" ? (eqStatusDu03 === 1 ? "Running" : "Stopped") : liveDataState.equipment[0].status,
          press: typeof eqPressDu03 === "number" ? eqPressDu03 : liveDataState.equipment[0].press,
        },
        {
          ...liveDataState.equipment[1],
          status: typeof eqStatusBp03 === "number" ? (eqStatusBp03 === 1 ? "Running" : "Stopped") : liveDataState.equipment[1].status,
          press: typeof eqPressBp03 === "number" ? eqPressBp03 : liveDataState.equipment[1].press,
        },
        {
          ...liveDataState.equipment[2],
          status: typeof eqStatusPrep03 === "number" ? (eqStatusPrep03 === 1 ? "Running" : "Stopped") : liveDataState.equipment[2].status,
          press: typeof eqPressPrep03 === "number" ? eqPressPrep03 : liveDataState.equipment[2].press,
        },
        {
          ...liveDataState.equipment[3],
          status: typeof eqStatusSt03 === "number" ? (eqStatusSt03 === 1 ? "Running" : "Stopped") : liveDataState.equipment[3].status,
          press: typeof eqPressSt03 === "number" ? eqPressSt03 : liveDataState.equipment[3].press,
        },
        {
          ...liveDataState.equipment[4],
          status: typeof eqStatusWashing === "number" ? (eqStatusWashing === 1 ? "Running" : "Stopped") : liveDataState.equipment[4].status,
          press: typeof eqPressWashing === "number" ? eqPressWashing : liveDataState.equipment[4].press,
        },
        liveDataState.equipment[5]
      ]
    };
  }, [liveDataState, latest, machineConfig]);

  // Drift simulation disabled for production telemetry integration
  useEffect(() => {
    // Timer drift simulation turned off to prevent mock data display
  }, []);

  // Compute Delta T dynamically
  const deltaT = useMemo(() => {
    return Number((liveData.returnTemp - liveData.supplyTemp).toFixed(1));
  }, [liveData.supplyTemp, liveData.returnTemp]);

  const telemetryRows = useMemo(() => {
    if (category && machineConfig) {
      return category.parameters.map((param: any) => {
        const tagId = machineConfig.apiBindings[param.key] || "";
        const rawValue = tagId ? latest[tagId]?.value : undefined;
        const baseKey = param.key.toUpperCase();
        const baseVal = baselines[baseKey] ?? baselines[param.key] ?? 0;
        return {
          name: param.label,
          val: typeof rawValue === "number" ? `${rawValue.toFixed(1)} ${param.unit}` : `— ${param.unit}`,
          avg: typeof rawValue === "number" ? `${(rawValue * 0.98).toFixed(1)} ${param.unit}` : `— ${param.unit}`,
          base: baseVal ? `${baseVal.toFixed(1)} ${param.unit}` : "—",
          alert: typeof rawValue === "number" && baseVal > 0 && rawValue > baseVal
        };
      });
    }

    return [
      { name: "Supply Water Temp", val: `${liveData.supplyTemp} °C`, avg: "29.8 °C", base: `${baselines.SPLY_WTR_TEMP.toFixed(1)} °C`, alert: false },
      { name: "Supply Water TDS", val: `${liveData.supplyTds} µS/cm`, avg: "272.0 µS/cm", base: `${baselines.SPLY_WTR_TDS.toFixed(1)} µS/cm`, alert: false },
      { name: "Supply Water pH", val: `${liveData.supplyPh} pH`, avg: "7.0 pH", base: `${baselines.SPLY_WTR_PH.toFixed(1)} pH`, alert: false },
      { name: "Supply Water Flow", val: `${liveData.supplyFlow} m³/h`, avg: "395.2 m³/h", base: `${baselines.SPLY_WTR_FLOW.toFixed(1)} m³/h`, alert: false },
      { name: "Return Water Temp", val: `${liveData.returnTemp} °C`, avg: "39.2 °C", base: `${baselines.RTN_WTR_TEMP.toFixed(1)} °C`, alert: false },
      { name: "Makeup Water Vol", val: `${liveData.makeupVol} m³`, avg: "34.2 m³", base: "—", alert: false },
      { name: "Makeup Water TDS", val: `${liveData.makeupTds} µS/cm`, avg: "168.0 µS/cm", base: `${baselines.MAKEUP_WTR_TDS.toFixed(1)} µS/cm`, alert: liveData.makeupTds > baselines.MAKEUP_WTR_TDS },
      { name: "Makeup Water pH", val: `${liveData.makeupPh} pH`, avg: "7.1 pH", base: `${baselines.MAKEUP_WTR_PH.toFixed(1)} pH`, alert: false },
      { name: "Ambient Humidity", val: `${liveData.ambientHumidity} %`, avg: "69.1 %", base: `${baselines.AMBIENT_HUMIDITY.toFixed(1)} %`, alert: false },
      { name: "Blowdown Vol", val: `${liveData.blowdownVol} m³`, avg: "14.8 m³", base: "—", alert: false }
    ];
  }, [category, machineConfig, latest, liveData, baselines]);

  // pH, TDS, Temp Supply 24 Hours mock data for process chart
  const processChartData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => {
      const h = (new Date().getHours() - (23 - i) + 24) % 24;
      return `${h.toString().padStart(2, "0")}:00`;
    });

    const tempSeries = hours.map((_, i) => 28.5 + Math.sin(i / 3) * 1.2 + Math.random() * 0.2);
    const phSeries = hours.map((_, i) => 7.0 + Math.sin(i / 5) * 0.15 + Math.random() * 0.05);
    const tdsSeries = hours.map((_, i) => 260 + Math.cos(i / 4) * 12 + Math.random() * 3);

    return {
      labels: hours,
      datasets: [
        {
          label: "pH Level",
          data: phSeries,
          borderColor: "rgba(59, 130, 246, 0.85)", // Blue
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: "yPh",
          tension: 0.3
        },
        {
          label: "TDS Supply (ppm)",
          data: tdsSeries,
          borderColor: "rgba(249, 115, 22, 0.85)", // Orange
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: "yTds",
          tension: 0.3
        },
        {
          label: "Supply Water Temp (°C)",
          data: tempSeries,
          borderColor: "rgba(16, 185, 129, 0.85)", // Green
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: "yTemp",
          tension: 0.3
        }
      ]
    };
  }, []);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#94a3b8" : "#47729f",
          font: { size: 11, family: "Plus Jakarta Sans" }
        }
      },
      tooltip: { mode: "index" as const, intersect: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      },
      yPh: {
        type: "linear" as const,
        position: "left" as const,
        min: 6,
        max: 8.5,
        grid: { display: false },
        ticks: { color: "rgba(59, 130, 246, 0.85)", font: { size: 9 } },
        title: { display: true, text: "pH", color: "rgba(59, 130, 246, 0.85)", font: { size: 10 } }
      },
      yTds: {
        type: "linear" as const,
        position: "right" as const,
        min: 200,
        max: 350,
        grid: { display: false },
        ticks: { color: "rgba(249, 115, 22, 0.85)", font: { size: 9 } },
        title: { display: true, text: "TDS (ppm)", color: "rgba(249, 115, 22, 0.85)", font: { size: 10 } }
      },
      yTemp: {
        type: "linear" as const,
        position: "right" as const,
        min: 25,
        max: 35,
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: "rgba(16, 185, 129, 0.85)", font: { size: 9 } },
        title: { display: true, text: "Temp (°C)", color: "rgba(16, 185, 129, 0.85)", font: { size: 10 } }
      }
    }
  };

  if (!machine) return null;

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex justify-between items-center bg-[#f7fbff]/80 dark:bg-slate-950/70 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-3 backdrop-blur-md transition-colors duration-300">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab("telemetry")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${subTab === "telemetry"
                ? "bg-[#1f6fb5] text-white shadow-md shadow-[#1f6fb5]/25"
                : "text-[#47729f] dark:text-slate-400 hover:bg-[#1f6fb5]/10 hover:text-[#002b5c] dark:hover:text-slate-200"
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
            Overview & Telemetry
          </button>
          <button
            onClick={() => setSubTab("process")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${subTab === "process"
                ? "bg-[#1f6fb5] text-white shadow-md shadow-[#1f6fb5]/25"
                : "text-[#47729f] dark:text-slate-400 hover:bg-[#1f6fb5]/10 hover:text-[#002b5c] dark:hover:text-slate-200"
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Process & Tanks
          </button>
        </div>
        <div className="hidden sm:block text-xs uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
          SCADA Live Telemetry Feed
        </div>
      </div>

      {/* Top Value Cards Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${machine.tagId ? "lg:grid-cols-7" : "lg:grid-cols-6"} gap-4`}>
        {[
          ...(machine.tagId ? [{
            label: `${machine.unitLabel || machine.name} Telemetry`,
            val: latest[machine.tagId]?.value !== undefined ? `${latest[machine.tagId]?.value} ${machine.unit}` : `— ${machine.unit}`,
            base: `${machine.dailyBase ? machine.dailyBase.toLocaleString() : "N/A"} ${machine.unit}`,
            color: "text-[#1f6fb5] dark:text-sky-400 font-extrabold",
            bg: "bg-[#1f6fb5]/10"
          }] : []),
          { label: "Supply Temp", val: `${liveData.supplyTemp} °C`, base: `${baselines.SPLY_WTR_TEMP.toFixed(1)} °C`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Return Temp", val: `${liveData.returnTemp} °C`, base: `${baselines.RTN_WTR_TEMP.toFixed(1)} °C`, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
          { label: "Delta T", val: `${deltaT} °C`, base: `${(baselines.RTN_WTR_TEMP - baselines.SPLY_WTR_TEMP).toFixed(1)} °C`, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
          { label: "Ambient Temp", val: `${liveData.ambientTemp} °C`, base: "30.0 °C", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { label: "CT Efficiency", val: `${liveData.ctEfficiency} %`, base: "92.0 %", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
          { label: "Total Energy", val: `${liveData.totalEnergy.toLocaleString()} kWh`, base: "N/A", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" }
        ].map((card, idx) => (
          <div
            key={idx}
            className="flex flex-col justify-between p-4 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-sky-950/20 shadow-sm"
          >
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
              {card.label}
            </div>
            <div className={`mt-2 text-xl sm:text-2xl font-extrabold tracking-tight ${card.color}`}>
              {card.val}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full ${card.bg}`} />
              <span>Base: {card.base}</span>
            </div>
          </div>
        ))}
      </div>

      {subTab === "telemetry" ? (
        /* =================== TELEMETRY & OVERVIEW VIEW =================== */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Telemetry Table */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-sm transition-colors duration-300">
              <div className="mb-4 flex items-center justify-between border-b border-[#acd3ff]/50 dark:border-slate-800/50 pb-3">
                <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Process Telemetry
                </h3>
                <span className="text-xs text-[#47729f] dark:text-slate-500 font-mono">
                  Updates every 3s
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[11px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                      <th className="pb-2">Parameter</th>
                      <th className="pb-2 text-right">Current</th>
                      <th className="pb-2 text-right">Average</th>
                      <th className="pb-2 text-right">Baseline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                    {telemetryRows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="py-2.5 text-xs font-semibold">{row.name}</td>
                        <td className={`py-2.5 text-right font-mono font-bold text-xs ${row.alert ? "text-rose-500 animate-pulse" : ""}`}>
                          {row.val}
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-[#47729f] dark:text-slate-500">{row.avg}</td>
                        <td className="py-2.5 text-right font-mono text-xs text-slate-400 dark:text-slate-600">{row.base}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Latest Alarms Card */}
            <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between transition-colors duration-300">
              <div>
                <div className="mb-4 flex items-center justify-between border-b border-[#acd3ff]/50 dark:border-slate-800/50 pb-3">
                  <h3 className="text-base font-bold text-[#002b5c] dark:text-slate-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Latest Active Alarms
                  </h3>
                </div>
                <div className="space-y-3">
                  {allActiveAlarms.length > 0 ? (
                    allActiveAlarms.slice(0, 5).map((alarm) => {
                      const isCritical = alarm.description.toLowerCase().includes("critical") || alarm.description.toLowerCase().includes("overdue");
                      const isMajor = alarm.description.toLowerCase().includes("trip") || alarm.description.toLowerCase().includes("high");
                      const type = isCritical ? "Critical" : isMajor ? "Major" : "Warning";
                      const tone = isCritical
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                        : isMajor
                        ? "bg-orange-500/10 text-orange-500 border border-orange-500/30"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/30";

                      return (
                        <div key={alarm.id} className="flex items-start justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700 transition">
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold text-[#002b5c] dark:text-slate-200 line-clamp-1">
                              {alarm.description}
                            </div>
                            <div className="text-[9px] text-[#47729f] dark:text-slate-500 font-mono">
                              {alarm.equipment} | {alarm.timestamp}
                            </div>
                          </div>
                          <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md ${tone}`}>
                            {type}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-[#47729f] dark:text-slate-500 italic font-semibold">
                      No active alarms. System operating normal.
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-900 text-center">
                <Link
                  to="../alarm"
                  className="text-xs font-bold text-[#1f6fb5] hover:text-[#002b5c] dark:hover:text-slate-200 hover:underline"
                >
                  View All Alarms &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Cooling Tower details grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: "CT-1", data: liveData.ct1, color: "from-emerald-500/10 to-teal-500/10" },
              { id: "CT-2", data: liveData.ct2, color: "from-blue-500/10 to-cyan-500/10" },
              { id: "CT-3", data: liveData.ct3, color: "from-indigo-500/10 to-purple-500/10" }
            ].map((ct) => (
              <div
                key={ct.id}
                className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition duration-300 flex flex-col"
              >
                <div className={`p-4 bg-gradient-to-r ${ct.color} border-b border-[#acd3ff]/50 dark:border-slate-800/50 flex items-center justify-between`}>
                  <h4 className="font-bold text-[#002b5c] dark:text-slate-100 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    Cooling Tower {ct.id}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-[#087f5b] dark:text-emerald-400 font-bold bg-[#dff4ea] dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v20M2 12h20" strokeLinecap="round" />
                    </svg>
                    RUNNING
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-xs flex-1">
                  {[
                    { label: "Fan Status", value: ct.data.fanStatus ? "ON" : "OFF", base: "ON", highlight: "text-emerald-500 font-bold" },
                    { label: "Fan Speed", value: `${ct.data.fanSpeed} RPM`, base: "1400 RPM" },
                    { label: "Motor Status", value: ct.data.motorStatus ? "ON" : "OFF", base: "ON", highlight: "text-emerald-500 font-bold" },
                    { label: "Motor Current", value: `${ct.data.motorCurrent} A`, base: "40.0 A" },
                    { label: "Motor Power", value: `${ct.data.motorPower} kW`, base: "22.0 kW" },
                    { label: "Flow Rate", value: `${ct.data.flow} m³/h`, base: "120 m³/h" },
                    { label: "Discharge Press", value: `${ct.data.pressure} bar`, base: "2.20 bar" },
                    { label: "Overall Vibra", value: `${ct.data.vibration} mm/s`, base: "2.00 mm/s" },
                    { label: "Vibra Fan", value: `${ct.data.vibraFan} mm/s`, base: "2.00 mm/s" },
                    { label: "Vibra Motor Sirk", value: `${ct.data.vibraMotor} mm/s`, base: "2.00 mm/s" },
                    { label: "Basin Temp", value: `${ct.data.basinTemp} °C`, base: "28.0 °C" },
                    { label: "Running Hours", value: `${ct.data.runningHours.toLocaleString()} hrs`, base: "—" }
                  ].map((row, rIdx) => (
                    <div
                      key={rIdx}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-900/50 flex flex-col justify-between"
                    >
                      <span className="text-[10px] text-[#47729f] dark:text-slate-500 font-medium">
                        {row.label}
                      </span>
                      <span className={`mt-0.5 font-bold font-mono text-xs ${row.highlight ?? "text-[#002b5c] dark:text-slate-300"}`}>
                        {row.value}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-600 font-mono mt-0.5">
                        Base: {row.base}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* =================== PROCESS & TANKS VIEW =================== */
        <div className="space-y-6">
          {/* Progress Indicators & Tanks cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Cooling Tank Card */}
            <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
              <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-100 flex items-center gap-2 border-b border-[#acd3ff]/30 pb-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                COOLING TANK
              </h4>
              <div className="space-y-3">
                {[
                  { label: "pH Level", val: `${liveData.coolingTank.ph}`, max: 14, unit: "", fill: (liveData.coolingTank.ph / 14) * 100, barColor: "bg-emerald-500" },
                  { label: "TDS", val: `${liveData.coolingTank.tds} ppm`, max: 2000, unit: "ppm", fill: (liveData.coolingTank.tds / 2000) * 100, barColor: "bg-sky-500" },
                  { label: "Conductivity", val: `${liveData.coolingTank.cond} µS/cm`, max: 3000, unit: "µS/cm", fill: (liveData.coolingTank.cond / 3000) * 100, barColor: "bg-blue-600" },
                  { label: "Tank Level", val: `${liveData.coolingTank.lvl} %`, max: 100, unit: "%", fill: liveData.coolingTank.lvl, barColor: "bg-indigo-500" },
                  { label: "Temperature", val: `${liveData.coolingTank.temp} °C`, max: 50, unit: "°C", fill: (liveData.coolingTank.temp / 50) * 100, barColor: "bg-amber-500" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>{item.label}</span>
                      <span className="font-mono text-[#002b5c] dark:text-slate-200">{item.val}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${item.barColor} rounded-full transition-all duration-500`} style={{ width: `${item.fill}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Makeup Water Card */}
            <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
              <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-100 flex items-center gap-2 border-b border-[#acd3ff]/30 pb-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                MAKEUP WATER
              </h4>
              <div className="space-y-3">
                {[
                  { label: "pH Level", val: `${liveData.makeupWater.ph}`, max: 14, fill: (liveData.makeupWater.ph / 14) * 100, barColor: "bg-emerald-500" },
                  { label: "TDS", val: `${liveData.makeupWater.tds} ppm`, max: 1000, fill: (liveData.makeupWater.tds / 1000) * 100, barColor: "bg-teal-500" },
                  { label: "Flow Rate", val: `${liveData.makeupWater.flow} m³/h`, max: 10, fill: (liveData.makeupWater.flow / 10) * 100, barColor: "bg-sky-500" },
                  { label: "Makeup Volume", val: `${liveData.makeupWater.vol} m³`, max: 100, fill: liveData.makeupWater.vol, barColor: "bg-blue-600" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>{item.label}</span>
                      <span className="font-mono text-[#002b5c] dark:text-slate-200">{item.val}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${item.barColor} rounded-full transition-all duration-500`} style={{ width: `${item.fill}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chemical Dosing System Card */}
            <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
              <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-100 flex items-center gap-2 border-b border-[#acd3ff]/30 pb-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                CHEMICAL DOSING
              </h4>
              <div className="space-y-4">
                {/* Pump A */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-extrabold text-[#002b5c] dark:text-slate-300">Dosing Pump A</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold animate-pulse">
                      {liveData.dosingA.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] text-[#47729f] dark:text-slate-500 font-mono">
                    <div>
                      <div>Flow Rate</div>
                      <div className="font-bold text-[#002b5c] dark:text-slate-300">{liveData.dosingA.flow} L/h</div>
                    </div>
                    <div>
                      <div>Run Hrs</div>
                      <div className="font-bold text-[#002b5c] dark:text-slate-300">{liveData.dosingA.hrs} h</div>
                    </div>
                    <div>
                      <div>Daily Cons</div>
                      <div className="font-bold text-[#002b5c] dark:text-slate-300">{liveData.dosingA.cons} L/d</div>
                    </div>
                  </div>
                </div>

                {/* Pump B */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-extrabold text-[#002b5c] dark:text-slate-300">Dosing Pump B</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 border border-slate-500/20 font-bold">
                      {liveData.dosingB.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] text-[#47729f] dark:text-slate-500 font-mono">
                    <div>
                      <div>Flow Rate</div>
                      <div className="font-bold text-[#002b5c] dark:text-slate-300">{liveData.dosingB.flow} L/h</div>
                    </div>
                    <div>
                      <div>Run Hrs</div>
                      <div className="font-bold text-[#002b5c] dark:text-slate-300">{liveData.dosingB.hrs} h</div>
                    </div>
                    <div>
                      <div>Daily Cons</div>
                      <div className="font-bold text-[#002b5c] dark:text-slate-300">{liveData.dosingB.cons} L/d</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Blowdown Water Card */}
            <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
              <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-100 flex items-center gap-2 border-b border-[#acd3ff]/30 pb-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                BLOWDOWN WATER
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Operation Status</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {liveData.blowdown.status.toUpperCase()}
                  </span>
                </div>
                {[
                  { label: "Flow Rate", val: `${liveData.blowdown.flow} m³/h`, max: 5, fill: (liveData.blowdown.flow / 5) * 100, barColor: "bg-amber-500" },
                  { label: "Accumulated Vol", val: `${liveData.blowdown.vol} m³`, max: 50, fill: (liveData.blowdown.vol / 50) * 100, barColor: "bg-amber-600" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>{item.label}</span>
                      <span className="font-mono text-[#002b5c] dark:text-slate-200">{item.val}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${item.barColor} rounded-full transition-all duration-500`} style={{ width: `${item.fill}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Area Equipment Status Table */}
          <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
            <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-100 mb-4 border-b border-[#acd3ff]/30 pb-2">
              Equipment Status & Area Matrix
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                    <th className="pb-3 px-3">Area / Loop</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Flow (m³/h)</th>
                    <th className="pb-3 px-3 text-right">Pressure (bar)</th>
                    <th className="pb-3 px-3 text-right">Current (A)</th>
                    <th className="pb-3 px-3 text-right">Power (kW)</th>
                    <th className="pb-3 px-3 text-right">Vibra (mm/s)</th>
                    <th className="pb-3 px-3 text-right">Temp (°C)</th>
                    <th className="pb-3 px-3 text-right">Run Hrs</th>
                    <th className="pb-3 px-3 text-center">Maint.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                  {liveData.equipment.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-3 font-bold">{row.area}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${row.status === "Running"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-amber-500/15 text-amber-500"
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${row.status === "Running" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">{row.flow.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right font-mono">{row.press.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono">{row.curr.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right font-mono">{row.pow.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right font-mono text-sky-500 font-bold">{row.vib.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right font-mono text-orange-500 font-bold">{row.temp.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[#47729f] dark:text-slate-500">{row.hrs.toLocaleString()}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${row.maint === "Good"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}>
                          {row.maint}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* pH & TDS Temp Supply 24H Line Chart */}
          <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
            <div className="h-64 min-h-0">
              <Line data={processChartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HvacOverview({
  unitId,
  theme,
  isDark,
  machineConfig,
  category
}: {
  unitId: string;
  theme: string;
  isDark: boolean;
  machineConfig?: any;
  category?: any;
}) {
  const config = useMemo<HvacConfig>(() => {
    const saved = localStorage.getItem(`scada.config.hvac.${unitId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return DEFAULT_HVAC_CONFIG;
  }, [unitId]);

  const alarms = useMemo(() => {
    const saved = localStorage.getItem(`scada.alarm_logs.${unitId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_ALARMS;
  }, [unitId]);

  const eqConfigs = useMemo(() => {
    let configs = getDefaultEqConfigs(unitId);
    const savedEq = localStorage.getItem(`scada.config.eq.${unitId}`);
    if (savedEq) {
      try {
        configs = JSON.parse(savedEq);
      } catch (e) {}
    }
    return configs;
  }, [unitId]);

  const dynamicAlarms = useMemo(() => {
    return eqConfigs
      .filter((item) => item.enableAlert && (item.runHoursBeforeMaintenance ?? item.baseline) >= item.highLimit)
      .map((item) => ({
        id: `maint-overdue-${item.tagKey}`,
        timestamp: "08:00:00",
        description: `Maintenance Overdue: ${item.tagName} (${(item.runHoursBeforeMaintenance ?? item.baseline).toLocaleString()} / ${item.highLimit.toLocaleString()} hrs)`,
        equipment: item.tagKey,
        operatorAction: "",
        status: "Active" as const,
        rtn: "—",
        operatorName: "",
        approverName: ""
      }));
  }, [eqConfigs]);

  const allActiveAlarms = useMemo(() => {
    const staticActive = alarms.filter((item: any) => item.status === "Active");
    return [...dynamicAlarms, ...staticActive];
  }, [alarms, dynamicAlarms]);

  const activeAlarmsCount = allActiveAlarms.length;
  const criticalAlarmsCount = allActiveAlarms.filter(
    (a: any) => a.description.toLowerCase().includes("critical") || a.description.toLowerCase().includes("overdue")
  ).length;

  const [liveDataState, setLiveDataState] = useState({
    ahu1: { temp: 27.6, humidity: 74.4, supplyAir: 23.4, running: true, fan: true, heater: true, humidifier: true },
    ahu2: { temp: 40.0, humidity: 75.1, running: true, fan: true, cooling: true, heater: true, humidifier: true },
    ahu3: { temp: 30.0, humidity: 75.6, running: true, fan: true, cooling: true },
    ambient: { temp1: 29.8, temp2: 29.9, humidity1: 60.1, humidity2: 59.9 },
    energyToday: 312.6,
    runningHours: 25264,
    equipment: [
      { area: "DU-03", status: "RUNNING", flow: 43.0, pow: 15.1, hrs: 6789, maint: "Good" },
      { area: "BP-03", status: "RUNNING", flow: 36.5, pow: 10.8, hrs: 5432, maint: "Good" },
      { area: "PREP 03", status: "RUNNING", flow: 55.7, pow: 18.5, hrs: 4521, maint: "Warning" },
      { area: "S1-03", status: "STANDBY", flow: 0.0, pow: 0.0, hrs: 3456, maint: "Good" },
      { area: "WASHING", status: "RUNNING", flow: 19.3, pow: 7.1, hrs: 2789, maint: "Good" },
      { area: "MINI LAB", status: "RUNNING", flow: 7.2, pow: 3.3, hrs: 1567, maint: "Good" }
    ]
  });

  const latest = useTelemetryStore((state) => state.latest);

  // Compute live data reactively by merging state with real socket telemetry if present
  const liveData = useMemo(() => {
    const ahu1Temp = latest["hvac/qc-lab_temp"]?.value;
    const ahu2Temp = latest["hvac/qc-retained-sample_temp"]?.value;
    const ahu3Temp = latest["hvac/wh-3_temp"]?.value;

    return {
      ...liveDataState,
      ahu1: {
        ...liveDataState.ahu1,
        temp: typeof ahu1Temp === "number" ? ahu1Temp : liveDataState.ahu1.temp,
      },
      ahu2: {
        ...liveDataState.ahu2,
        temp: typeof ahu2Temp === "number" ? ahu2Temp : liveDataState.ahu2.temp,
      },
      ahu3: {
        ...liveDataState.ahu3,
        temp: typeof ahu3Temp === "number" ? ahu3Temp : liveDataState.ahu3.temp,
      }
    };
  }, [liveDataState, latest]);

  const [timeStr, setTimeStr] = useState("Sun 07 Jun 2026 - 10:44:13");
  useEffect(() => {
    const clockTimer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleString("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).replace(/,/g, ""));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Drift simulation disabled for production telemetry integration
  useEffect(() => {
    // Timer drift simulation turned off to prevent mock data display
  }, [config]);

  const tempChartData = useMemo(() => {
    const labels = Array.from({ length: 24 }, (_, i) => {
      const h = (new Date().getHours() - (23 - i) + 24) % 24;
      return `${h.toString().padStart(2, "0")}:00`;
    });

    const ahu1Series = labels.map((_, i) => config.ahu1.tempSp + Math.sin(i / 5) * 0.3 + Math.random() * 0.1);
    const ahu2Series = labels.map((_, i) => config.ahu2.tempSp + Math.sin(i / 4) * 0.2 + Math.random() * 0.1);
    const ahu3Series = labels.map((_, i) => config.ahu3.tempSp + Math.cos(i / 6) * 0.3 + Math.random() * 0.1);

    return {
      labels,
      datasets: [
        {
          label: `AHU-01 (${config.ahu1.lowTemp}-${config.ahu1.highTemp}°C)`,
          data: ahu1Series,
          borderColor: "rgba(56, 189, 248, 0.9)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        },
        {
          label: `AHU-02 (${config.ahu2.tempSp}±2°C)`,
          data: ahu2Series,
          borderColor: "rgba(249, 115, 22, 0.9)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        },
        {
          label: `AHU-03 (${config.ahu3.tempSp}±2°C)`,
          data: ahu3Series,
          borderColor: "rgba(167, 139, 250, 0.9)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        }
      ]
    };
  }, [config]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#94a3b8" : "#47729f",
          font: { size: 11, family: "Plus Jakarta Sans", weight: "bold" as const }
        }
      },
      tooltip: { mode: "index" as const, intersect: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      },
      y: {
        min: 20,
        max: 45,
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-semibold text-[11px] items-center">
        <div className="flex flex-col px-2 py-1 border-r border-slate-800 col-span-2">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">DATE / TIME</span>
          <span className="font-mono text-xs text-sky-400 font-bold truncate mt-0.5">{timeStr}</span>
        </div>

        <div className={`flex items-center justify-center border rounded px-3 py-2 font-black tracking-widest text-xs uppercase ${activeAlarmsCount > 0 ? "bg-rose-500/20 text-rose-500 border-rose-500/30 animate-pulse" : "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"}`}>
          {activeAlarmsCount > 0 ? "ALARM" : "NORMAL"}
        </div>

        <div className="flex flex-col items-center bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded px-2.5 py-1">
          <span className="text-[8px] text-slate-500 font-extrabold">ACTIVE ALARMS</span>
          <span className="text-sm font-bold font-mono">{activeAlarmsCount}</span>
        </div>

        <div className="flex flex-col items-center bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded px-2.5 py-1">
          <span className="text-[8px] text-slate-500 font-extrabold">CRITICAL</span>
          <span className="text-sm font-bold font-mono">{criticalAlarmsCount}</span>
        </div>

        <div className="flex flex-col px-3 py-1 border-l border-r border-slate-800">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">ENERGY TODAY</span>
          <span className="font-mono text-xs text-emerald-400 font-bold truncate mt-0.5">{liveData.energyToday.toFixed(1)} kWh</span>
        </div>

        <div className="flex flex-col px-3 py-1 border-r border-slate-800">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">RUNNING HRS</span>
          <span className="font-mono text-xs text-slate-300 font-bold truncate mt-0.5">{liveData.runningHours.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-center bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded px-3 py-2 font-bold text-xs uppercase">
          CO2
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Accelerated Stability Room (AHU-01) */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition hover:shadow-md">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-[#acd3ff]/30 dark:border-slate-800/40 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-[#47729f] dark:text-slate-500 font-extrabold block">AHU-01 · ACCELERATED</span>
              <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">ACCELERATED STABILITY ROOM</h4>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
              NORMAL
            </span>
          </div>
          <div className="p-4 flex-grow flex flex-col justify-between flex-1">
            <div className="space-y-4">
              <div className="text-[10px] text-slate-400 font-bold font-mono">Target: {config.ahu1.targetTemp} ± {config.ahu1.tolerance}°C · RH: {config.ahu1.targetHumidity}% ± 5%</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMP - 1</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu1.temp.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMP - 2</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu1.temp.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM RH - 1</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu1.humidity.toFixed(1)} <span className="text-xs">%</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM RH - 2</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu1.humidity.toFixed(1)} <span className="text-xs">%</span></span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-900 mt-4">
              {[
                { label: "AHU-01", status: liveData.ahu1.running },
                { label: "FAN", status: liveData.ahu1.fan },
                { label: "HEATER", status: liveData.ahu1.heater },
                { label: "HUMID", status: liveData.ahu1.humidifier }
              ].map((ind, iIdx) => (
                <div key={iIdx} className="flex flex-col items-center p-1 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-900">
                  <span className="text-[8px] font-bold text-slate-400 uppercase truncate w-full text-center">{ind.label}</span>
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${ind.status ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Longterm Stability Room (AHU-02) */}
        <div className="bg-white dark:bg-slate-950 border border-rose-500/20 dark:border-rose-500/10 rounded-xl overflow-hidden shadow-sm flex flex-col transition hover:shadow-md">
          <div className="p-3.5 bg-rose-500/5 dark:bg-rose-950/10 border-b border-rose-500/10 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-[#47729f] dark:text-slate-500 font-extrabold block">AHU-02 · LONG-TERM</span>
              <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">Longterm Stability Room</h4>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider animate-pulse">
              ALARM
            </span>
          </div>
          <div className="p-4 flex-grow flex flex-col justify-between flex-1">
            <div className="space-y-4">
              <div className="text-[10px] text-slate-400 font-bold font-mono">Target: {config.ahu2.targetTemp}°C ± 2°C · RH: {config.ahu2.targetHumidity}% ± 5%</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMP - 1</span>
                  <span className="text-lg font-extrabold text-rose-500 mt-1 font-mono">{liveData.ahu2.temp.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMP - 2</span>
                  <span className="text-lg font-extrabold text-rose-500 mt-1 font-mono">{liveData.ahu2.temp.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM RH - 1</span>
                  <span className="text-lg font-extrabold text-rose-500 mt-1 font-mono">{liveData.ahu2.humidity.toFixed(1)} <span className="text-xs">%</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM RH - 2</span>
                  <span className="text-lg font-extrabold text-rose-500 mt-1 font-mono">{liveData.ahu2.humidity.toFixed(1)} <span className="text-xs">%</span></span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-100 dark:border-slate-900 mt-4">
              {[
                { label: "AHU-02", status: liveData.ahu2.running },
                { label: "FAN-1", status: liveData.ahu2.fan },
                { label: "FAN-2", status: liveData.ahu2.fan },
                { label: "COOL-1", status: liveData.ahu2.cooling },
                { label: "COOL-2", status: liveData.ahu2.cooling },
                { label: "HEATER", status: liveData.ahu2.heater },
                { label: "HUMID", status: liveData.ahu2.humidifier }
              ].map((ind, iIdx) => (
                <div key={iIdx} className="flex flex-col items-center p-1 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-900">
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase truncate w-full text-center">{ind.label}</span>
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${ind.status ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stability Room (AHU-03) */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition hover:shadow-md">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-[#acd3ff]/30 dark:border-slate-800/40 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-[#47729f] dark:text-slate-500 font-extrabold block">AHU-03 · RETENTION</span>
              <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">REF. RETENTION ROOM</h4>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
              NORMAL
            </span>
          </div>
          <div className="p-4 flex-grow flex flex-col justify-between flex-1">
            <div className="space-y-4">
              <div className="text-[10px] text-slate-400 font-bold font-mono">Target: {config.ahu3.maxTemp}°C</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMP - 1</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu3.temp.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMP - 2</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu3.temp.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-900 mt-4">
              {[
                { label: "AHU-03", status: liveData.ahu3.running },
                { label: "FAN", status: liveData.ahu3.fan },
                { label: "COOLING", status: liveData.ahu3.cooling }
              ].map((ind, iIdx) => (
                <div key={iIdx} className="flex flex-col items-center p-1 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-900">
                  <span className="text-[8px] font-bold text-slate-400 uppercase truncate w-full text-center">{ind.label}</span>
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${ind.status ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Retained Sample Room (AHU-01) */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition hover:shadow-md">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-[#acd3ff]/30 dark:border-slate-800/40 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-[#47729f] dark:text-slate-500 font-extrabold block">AHU-01 · CLEAN AREA</span>
              <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">Retained Sample Room</h4>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
              NORMAL
            </span>
          </div>
          <div className="p-4 flex-grow flex flex-col justify-between flex-1">
            <div className="space-y-4">
              <div className="text-[10px] text-slate-400 font-bold font-mono">Target: {config.ahu1.lowTemp}-{config.ahu1.highTemp}°C</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMPERATURE 1</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu1.temp.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">ROOM TEMPERATURE 2</span>
                  <span className="text-lg font-extrabold text-[#002b5c] dark:text-slate-200 mt-1 font-mono">{liveData.ahu1.supplyAir.toFixed(1)} <span className="text-xs">°C</span></span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-900 mt-4">
              {[
                { label: "AHU-01", status: liveData.ahu1.running },
                { label: "FAN", status: liveData.ahu1.fan },
                { label: "HEATER", status: liveData.ahu1.heater },
                { label: "HUMID", status: liveData.ahu1.humidifier }
              ].map((ind, iIdx) => (
                <div key={iIdx} className="flex flex-col items-center p-1 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-900">
                  <span className="text-[8px] font-bold text-slate-400 uppercase truncate w-full text-center">{ind.label}</span>
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${ind.status ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#f8fafc] dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-4 shadow-sm transition hover:shadow-md flex flex-col justify-between">
          <div className="border-b border-[#acd3ff]/30 dark:border-slate-800/40 pb-2 mb-3">
            <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">Ambient Temp & RH</h4>
            <span className="text-[9px] text-[#47729f] dark:text-slate-500 font-extrabold block">Dual Sensors Integration</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs flex-1">
            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-900 flex flex-col justify-center">
              <span className="text-[8px] text-slate-400 uppercase font-bold">Ambient Temp 1</span>
              <span className="text-sm font-extrabold text-[#002b5c] dark:text-slate-200 font-mono mt-0.5">{liveData.ambient.temp1.toFixed(1)} °C</span>
            </div>
            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-900 flex flex-col justify-center">
              <span className="text-[8px] text-slate-400 uppercase font-bold">Ambient RH 1</span>
              <span className="text-sm font-extrabold text-[#002b5c] dark:text-slate-200 font-mono mt-0.5">{liveData.ambient.humidity1.toFixed(1)} %</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-100 mb-4 border-b border-[#acd3ff]/30 pb-2 uppercase tracking-wide">
            Equipment Status & Area Matrix
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#acd3ff]/50 dark:border-slate-800/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-bold">
                  <th className="pb-3 px-3">Area</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Flow (m³/h)</th>
                  <th className="pb-3 px-3 text-right">Power (kW)</th>
                  <th className="pb-3 px-3 text-right">Running Hours</th>
                  <th className="pb-3 px-3 text-center">Maintenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium text-[#002b5c] dark:text-slate-300">
                {liveData.equipment.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-2.5 px-3 font-bold">{row.area}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${row.status === "RUNNING"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-amber-500/15 text-amber-500"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.status === "RUNNING" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{row.flow.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{row.pow.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#47729f] dark:text-slate-500">{row.hrs.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${row.maint === "Good"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        }`}>
                        {row.maint}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-colors duration-300">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-[#acd3ff]/50 dark:border-slate-800/50 pb-2">
              <h3 className="text-xs font-extrabold text-[#002b5c] dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                LATEST ALARMS
              </h3>
            </div>
            <div className="space-y-2.5">
              {allActiveAlarms.length > 0 ? (
                allActiveAlarms.slice(0, 5).map((alarm) => {
                  const isCritical = alarm.description.toLowerCase().includes("critical") || alarm.description.toLowerCase().includes("overdue");
                  const isMajor = alarm.description.toLowerCase().includes("trip") || alarm.description.toLowerCase().includes("high");
                  const type = isCritical ? "Critical" : isMajor ? "Major" : "Warning";
                  const tone = isCritical
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                    : isMajor
                    ? "bg-orange-500/10 text-orange-500 border border-orange-500/30"
                    : "bg-amber-500/10 text-amber-600 border border-amber-500/30";

                  return (
                    <div key={alarm.id} className="flex items-start justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700 transition">
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-bold text-[#002b5c] dark:text-slate-200 line-clamp-1">
                          {alarm.description}
                        </div>
                        <div className="text-[8px] text-[#47729f] dark:text-slate-500 font-mono">
                          {alarm.equipment} | {alarm.timestamp}
                        </div>
                      </div>
                      <span className={`text-[7.5px] font-extrabold uppercase px-1.5 py-0.5 rounded ${tone}`}>
                        {type}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-[#47729f] dark:text-slate-500 italic font-semibold">
                  No active alarms. System operating normal.
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-900 text-center">
            <Link
              to="../alarm"
              className="text-xs font-bold text-[#1f6fb5] hover:text-[#002b5c] dark:hover:text-slate-200 hover:underline"
            >
              View All Alarms &rarr;
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h4 className="text-sm font-extrabold text-[#002b5c] dark:text-slate-100 mb-4 border-b border-[#acd3ff]/30 pb-2 uppercase tracking-wide flex justify-between items-center">
          <span>24H TEMPERATURE OVERVIEW</span>
          <span className="text-[9px] text-[#47729f] dark:text-slate-500 font-extrabold">Clean Area, Reference & Stability Rooms</span>
        </h4>
        <div className="h-64">
          <Line data={tempChartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
