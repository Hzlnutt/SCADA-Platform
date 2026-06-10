import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendChart } from "../../components/charts/TrendChart";
import { useTelemetryStore } from "../../store/telemetry.store";
import { getUnitById } from "../../data/machines";
import type { MachineOutletContext } from "./MachineLayout";

const buildFallbackPoints = (values: number[]) => {
  const now = Date.now();
  const stepMs = 60 * 1000;
  return values.map<{ ts: Date | string; value: number }>((value, index) => ({
    ts: new Date(now - (values.length - index) * stepMs),
    value
  }));
};

export default function MachineOverview() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const latest = useTelemetryStore((state) => state.latest);
  const [chartFilter, setChartFilter] = useState<"supply_temp" | "return_temp" | "ph_level" | "tds" | "total_flow" | "energy" | "ambient_temp" | "humidity">("supply_temp");
  const [showAllAlarms, setShowAllAlarms] = useState(false);

  const trendPoints = useMemo(() => {
    if (!machine) {
      return [];
    }

    const base = buildFallbackPoints(machine.trend.series[0].values.slice(-30));
    const point = latest[machine.tagId];

    if (point && base.length > 0) {
      base[base.length - 1] = { ts: point.ts, value: Number(point.value) };
    }

    return base;
  }, [latest, machine]);

  // Current date/time
  const [currentTime, setCurrentTime] = useState(new Date());
  useMemo(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);



  if (!machine) {
    return null;
  }

  // Sample data for demonstration
  const systemStatus = "Normal";
  const activeAlarms = 2;
  const maintenanceTasks = 3;
  const energyToday = 1250.5;
  const runningHours = 8.5;
  const co2Emissions = 3.25;

  const supplyTemp = 29.5;
  const returnTemp = 32.2;
  const deltaTemp = 2.7;
  const ambientTemp = 28.5;
  const ctEfficiency = 94.2;
  const totalEnergy = 1250.5;

  const parametersData = [
    { name: "Supply Temp (°C)", current: 29.5, average: 28.8, baseline: 28.0 },
    { name: "Supply Water TDS", current: 145, average: 142, baseline: 140 },
    { name: "Supply Water PH", current: 7.2, average: 7.3, baseline: 7.4 },
    { name: "Return Water Temp (°C)", current: 32.2, average: 31.8, baseline: 31.0 },
    { name: "Makeup Water Vol (m³)", current: 45.3, average: 42.1, baseline: 40.0 },
    { name: "Makeup Water TDS", current: 150, average: 148, baseline: 145 },
    { name: "Makeup Water PH", current: 7.1, average: 7.2, baseline: 7.3 },
    { name: "Blowdown Vol (m³)", current: 12.5, average: 11.8, baseline: 10.0 }
  ];

  const alarmsList = [
    { id: 1, time: "14:30", message: "High Delta Temperature", severity: "warning" },
    { id: 2, time: "13:45", message: "Low TDS Level", severity: "alert" },
    { id: 3, time: "12:15", message: "CT-1 Vibration High", severity: "warning" },
    { id: 4, time: "11:00", message: "Pump Pressure Low", severity: "info" },
    { id: 5, time: "10:30", message: "Tank Level Critical", severity: "alert" }
  ];

  const coolingTowerData = [
    {
      name: "Cooling Tower 1",
      fanStatus: "Running",
      fanSpeed: 850,
      motorStatus: "Running",
      motorCurrent: 12.5,
      motorPower: 8.5,
      pressure: 1.9,
      vibrationFan: 2.1,
      vibrationMotor: 1.5,
      runningHours: 8.5
    },
    {
      name: "Cooling Tower 2",
      fanStatus: "Running",
      fanSpeed: 920,
      motorStatus: "Running",
      motorCurrent: 13.2,
      motorPower: 9.2,
      pressure: 2.0,
      vibrationFan: 2.3,
      vibrationMotor: 1.6,
      runningHours: 8.5
    },
    {
      name: "Cooling Tower 3",
      fanStatus: "Standby",
      fanSpeed: 0,
      motorStatus: "Standby",
      motorCurrent: 0,
      motorPower: 0,
      pressure: 0.2,
      vibrationFan: 0,
      vibrationMotor: 0,
      runningHours: 8.5
    }
  ];

  const areaData = [
    { area: "DU-03", status: "Normal", flow: 24.5, pressure: 1.9, current: 8.2, power: 5.8, runningHours: 8.5, maintenance: "OK" },
    { area: "BP-03", status: "Normal", flow: 18.3, pressure: 1.5, current: 6.5, power: 4.2, runningHours: 8.5, maintenance: "OK" },
    { area: "PREP-03", status: "Warning", flow: 15.8, pressure: 1.1, current: 5.2, power: 3.5, runningHours: 8.5, maintenance: "Planned" },
    { area: "ST-03", status: "Normal", flow: 22.1, pressure: 1.9, current: 7.8, power: 5.5, runningHours: 8.5, maintenance: "OK" },
    { area: "WASHING", status: "Normal", flow: 16.5, pressure: 1.5, current: 5.9, power: 4.0, runningHours: 8.5, maintenance: "OK" },
    { area: "MINI LAB", status: "Normal", flow: 8.3, pressure: 2.0, current: 3.2, power: 2.1, runningHours: 8.5, maintenance: "OK" }
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* Row 1: Key Metrics */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Date / Time</div>
          <div className="text-sm font-semibold text-slate-100">
            {currentTime.toLocaleDateString('id-ID')}
          </div>
          <div className="text-lg font-bold text-blue-400">
            {currentTime.toLocaleTimeString('id-ID')}
          </div>
        </div>

        <div className={`rounded-lg border p-4 ${systemStatus === "Normal" ? "border-green-800 bg-green-950/50" : "border-red-800 bg-red-950/50"}`}>
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">System Status</div>
          <div className={`text-lg font-bold ${systemStatus === "Normal" ? "text-green-400" : "text-red-400"}`}>
            {systemStatus}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Active Alarms</div>
          <div className="text-3xl font-bold text-red-400">{activeAlarms}</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Task Maintenance</div>
          <div className="text-3xl font-bold text-yellow-400">{maintenanceTasks}</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Energy Today</div>
          <div className="text-2xl font-bold text-blue-400">{energyToday.toFixed(1)}</div>
          <div className="text-xs text-slate-500">kWh</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Running Hours</div>
          <div className="text-2xl font-bold text-slate-100">{runningHours.toFixed(1)}h</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">CO2 Emissions</div>
          <div className="text-2xl font-bold text-emerald-400">{co2Emissions.toFixed(2)}</div>
          <div className="text-xs text-slate-500">Ton/day</div>
        </div>
      </div>

      {/* Row 2: Temperature & Efficiency Metrics */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Supply Temp</div>
          <div className="text-2xl font-bold text-orange-400">{supplyTemp}°C</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Return Temp</div>
          <div className="text-2xl font-bold text-red-400">{returnTemp}°C</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Delta Temp</div>
          <div className="text-2xl font-bold text-blue-400">{deltaTemp}°C</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Ambient Temp</div>
          <div className="text-2xl font-bold text-cyan-400">{ambientTemp}°C</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">CT Efficiency</div>
          <div className="text-2xl font-bold text-green-400">{ctEfficiency.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-[0.1em] text-slate-500 mb-2">Total Energy</div>
          <div className="text-2xl font-bold text-purple-400">{totalEnergy.toFixed(1)}</div>
          <div className="text-xs text-slate-500">kWh</div>
        </div>
      </div>

      {/* Row 3: Parameters Table & Latest Alarms */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Parameters Data</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-2 text-slate-400">Parameter</th>
                  <th className="text-right py-2 px-2 text-slate-400">Current</th>
                  <th className="text-right py-2 px-2 text-slate-400">Average</th>
                  <th className="text-right py-2 px-2 text-slate-400">Baseline</th>
                </tr>
              </thead>
              <tbody>
                {parametersData.map((param, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <td className="py-2 px-2 text-slate-300">{param.name}</td>
                    <td className="text-right py-2 px-2 font-semibold text-slate-100">{param.current}</td>
                    <td className="text-right py-2 px-2 text-slate-400">{param.average}</td>
                    <td className="text-right py-2 px-2 text-slate-400">{param.baseline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Latest Alarms</div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {alarmsList.slice(0, showAllAlarms ? alarmsList.length : 3).map((alarm) => (
              <div key={alarm.id} className="rounded p-2 bg-slate-900/50 border-l-2 border-slate-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs text-slate-500">{alarm.time}</div>
                    <div className="text-sm text-slate-200">{alarm.message}</div>
                  </div>
                  <span
                    className={`ml-2 text-xs px-2 py-1 rounded whitespace-nowrap ${
                      alarm.severity === "alert"
                        ? "bg-red-500/20 text-red-300"
                        : alarm.severity === "warning"
                        ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {alarm.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 rounded text-xs font-semibold text-blue-300 transition">
            View All Alarms
          </button>
        </div>
      </div>

      {/* Row 4: Cooling Towers */}
      <div className="grid gap-4 md:grid-cols-3">
        {coolingTowerData.map((tower, idx) => (
          <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4 font-semibold border-b border-slate-700 pb-3">
              {tower.name}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Fan Status</span>
                <span className={`font-semibold ${tower.fanStatus === "Running" ? "text-green-400" : "text-slate-500"}`}>
                  {tower.fanStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fan Speed</span>
                <span className="font-semibold text-slate-100">{tower.fanSpeed} RPM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Motor Status</span>
                <span className={`font-semibold ${tower.motorStatus === "Running" ? "text-green-400" : "text-slate-500"}`}>
                  {tower.motorStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Motor Current</span>
                <span className="font-semibold text-slate-100">{tower.motorCurrent} A</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Motor Power</span>
                <span className="font-semibold text-slate-100">{tower.motorPower} kW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pressure</span>
                <span className="font-semibold text-slate-100">{tower.pressure} Bar</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vibration Fan</span>
                <span className="font-semibold text-slate-100">{tower.vibrationFan} mm/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vibration Motor</span>
                <span className="font-semibold text-slate-100">{tower.vibrationMotor} mm/s</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-700">
                <span className="text-slate-400">Running Hours</span>
                <span className="font-semibold text-blue-400">{tower.runningHours}h</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 5: System Components */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Cooling Tank */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4 font-semibold border-b border-slate-700 pb-3">
              Cooling Tank
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">pH Level</span>
                <span className="font-semibold text-slate-100">7.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TDS</span>
                <span className="font-semibold text-slate-100">145 ppm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Conductivity</span>
                <span className="font-semibold text-slate-100">290 µS/cm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tank Level</span>
                <span className="font-semibold text-blue-400">85%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Temperature</span>
                <span className="font-semibold text-orange-400">32.2°C</span>
              </div>
            </div>
          </div>

          {/* Makeup Water */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4 font-semibold border-b border-slate-700 pb-3">
              Makeup Water
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">pH</span>
                <span className="font-semibold text-slate-100">7.1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TDS</span>
                <span className="font-semibold text-slate-100">150 ppm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Volume</span>
                <span className="font-semibold text-slate-100">45.3 m³</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Chemical Dosing System */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4 font-semibold border-b border-slate-700 pb-3">
              Chemical Dosing System
            </div>
            <div className="space-y-3">
              {/* Pump A */}
              <div className="rounded bg-slate-900/50 p-3">
                <div className="text-xs font-semibold text-blue-300 mb-2">Dosing Pump A (Chemical 357)</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tank Level</span>
                    <span className="font-semibold text-slate-100">72%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Flow Rate</span>
                    <span className="font-semibold text-slate-100">2.5 L/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Running Hours</span>
                    <span className="font-semibold text-slate-100">156h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consumption</span>
                    <span className="font-semibold text-slate-100">390L</span>
                  </div>
                </div>
              </div>

              {/* Pump B */}
              <div className="rounded bg-slate-900/50 p-3">
                <div className="text-xs font-semibold text-green-300 mb-2">Dosing Pump B (Chemical 327/317)</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tank Level</span>
                    <span className="font-semibold text-slate-100">58%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Flow Rate</span>
                    <span className="font-semibold text-slate-100">1.8 L/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Running Hours</span>
                    <span className="font-semibold text-slate-100">156h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consumption</span>
                    <span className="font-semibold text-slate-100">280L</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Blowdown Water */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4 font-semibold border-b border-slate-700 pb-3">
              Blowdown Water
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-semibold text-green-400">Normal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Flow</span>
                <span className="font-semibold text-slate-100">0.85 m³/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Volume</span>
                <span className="font-semibold text-slate-100">12.5 m³</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 6: Area Distribution Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Area Distribution</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 text-slate-400">Area</th>
                <th className="text-center py-3 px-3 text-slate-400">Status</th>
                <th className="text-right py-3 px-3 text-slate-400">Flow (M³/H)</th>
                <th className="text-right py-3 px-3 text-slate-400">Pressure (BAR)</th>
                <th className="text-right py-3 px-3 text-slate-400">Current (A)</th>
                <th className="text-right py-3 px-3 text-slate-400">Power (KW)</th>
                <th className="text-right py-3 px-3 text-slate-400">Hours</th>
                <th className="text-center py-3 px-3 text-slate-400">Maintenance</th>
              </tr>
            </thead>
            <tbody>
              {areaData.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-900/50">
                  <td className="py-3 px-3 font-semibold text-slate-100">{row.area}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        row.status === "Normal"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-300">{row.flow.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{row.pressure.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{row.current.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{row.power.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{row.runningHours}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`text-xs font-semibold ${
                        row.maintenance === "OK"
                          ? "text-green-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {row.maintenance}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 7: 24h Chart with Filters */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">24 Hours Trend</div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "supply_temp" as const, label: "Supply Temp" },
            { id: "return_temp" as const, label: "Return Temp" },
            { id: "ph_level" as const, label: "pH Level" },
            { id: "tds" as const, label: "TDS" },
            { id: "total_flow" as const, label: "Total Flow" },
            { id: "energy" as const, label: "Energy" },
            { id: "ambient_temp" as const, label: "Ambient Temp" },
            { id: "humidity" as const, label: "Humidity" }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setChartFilter(filter.id)}
              className={`px-4 py-2 rounded text-sm font-semibold transition ${
                chartFilter === filter.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900/50 text-slate-300 hover:bg-slate-900"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 mb-4">
          <TrendChart
            points={trendPoints}
            unit={
              chartFilter === "supply_temp" || chartFilter === "return_temp" || chartFilter === "ambient_temp"
                ? "°C"
                : chartFilter === "ph_level"
                ? "pH"
                : chartFilter === "tds"
                ? "ppm"
                : chartFilter === "total_flow"
                ? "m³/h"
                : chartFilter === "energy"
                ? "kWh"
                : "%"
            }
            heightClassName="h-64"
          />
        </div>

        {/* Chart Value Cards */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded bg-slate-900/50 p-3">
            <div className="text-xs text-slate-500 mb-1">Min</div>
            <div className="text-2xl font-bold text-blue-400">
              {chartFilter === "supply_temp" ? "25.2" : chartFilter === "return_temp" ? "28.5" : "142"}
            </div>
          </div>
          <div className="rounded bg-slate-900/50 p-3">
            <div className="text-xs text-slate-500 mb-1">Max</div>
            <div className="text-2xl font-bold text-red-400">
              {chartFilter === "supply_temp" ? "32.1" : chartFilter === "return_temp" ? "35.8" : "165"}
            </div>
          </div>
          <div className="rounded bg-slate-900/50 p-3">
            <div className="text-xs text-slate-500 mb-1">Average</div>
            <div className="text-2xl font-bold text-green-400">
              {chartFilter === "supply_temp" ? "28.8" : chartFilter === "return_temp" ? "31.8" : "152"}
            </div>
          </div>
          <div className="rounded bg-slate-900/50 p-3">
            <div className="text-xs text-slate-500 mb-1">Current</div>
            <div className="text-2xl font-bold text-slate-100">
              {chartFilter === "supply_temp" ? "29.5" : chartFilter === "return_temp" ? "32.2" : "145"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
