import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { getUnitById } from "../../data/machines";
import { useSystemStore } from "../../store/system.store";
import type { MachineOutletContext } from "./MachineLayout";
import "../../components/charts/chartjs";

// Canvas-based Power Demand real-time scrolling wave
function PowerDemandOscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const points: number[] = Array.from({ length: 150 }, () => 110 + Math.random() * 10);
    let offset = 0;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, w, h);

      // Draw background grid lines
      ctx.strokeStyle = isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(203, 213, 225, 0.4)";
      ctx.lineWidth = 1;
      
      const gridSize = 25;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Add new telemetry point
      const lastVal = points[points.length - 1];
      const targetVal = 110 + Math.sin(offset * 0.05) * 8 + Math.cos(offset * 0.12) * 3 + Math.random() * 2;
      const nextVal = lastVal + (targetVal - lastVal) * 0.1;
      points.push(nextVal);
      if (points.length > w) points.shift();

      offset++;

      // Draw Wave line
      ctx.strokeStyle = "#f97316"; // Orange active line
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const mapY = (val: number) => {
        // map 100kW - 130kW to screen height
        const minKw = 95;
        const maxKw = 130;
        const pct = (val - minKw) / (maxKw - minKw);
        return h - pct * h;
      };

      for (let i = 0; i < points.length; i++) {
        const x = i;
        const y = mapY(points[i]);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Render overlay text value
      ctx.fillStyle = isDark ? "#f1f5f9" : "#0f172a";
      ctx.font = "bold 11px 'IBM Plex Mono', monospace";
      ctx.fillText(`CURRENT DEMAND: ${nextVal.toFixed(1)} kW`, 15, 20);

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [isDark]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block rounded-lg bg-slate-950 dark:bg-[#070b13]" />
    </div>
  );
}

export default function MachineEnergy() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  // State to simulate drifting real-time grid metrics
  const [metrics, setMetrics] = useState({
    voltage: 414.2,
    current: 190.5,
    frequency: 49.97,
    pf: 0.92,
    activePower: 122.4,
    apparentPower: 124.1,
    reactivePower: 48.47,
    energy: 284567,
    thdVoltage: 2.97,
    thdCurrent: 7.79,
    vUnbalance: 0.93,
    iUnbalance: 1.22
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics((prev) => ({
        voltage: Number((414 + (Math.random() - 0.5) * 1.5).toFixed(1)),
        current: Number((190 + (Math.random() - 0.5) * 2.0).toFixed(1)),
        frequency: Number((49.95 + Math.random() * 0.05).toFixed(2)),
        pf: Number((0.91 + Math.random() * 0.02).toFixed(2)),
        activePower: Number((120 + (Math.random() - 0.5) * 3).toFixed(1)),
        apparentPower: Number((123 + (Math.random() - 0.5) * 3).toFixed(1)),
        reactivePower: Number((48 + (Math.random() - 0.5) * 0.8).toFixed(2)),
        energy: prev.energy + Math.floor(Math.random() * 2),
        thdVoltage: Number((2.8 + Math.random() * 0.3).toFixed(2)),
        thdCurrent: Number((7.5 + Math.random() * 0.5).toFixed(2)),
        vUnbalance: Number((0.9 + Math.random() * 0.06).toFixed(2)),
        iUnbalance: Number((1.1 + Math.random() * 0.15).toFixed(2))
      }));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // 1. Hourly Energy (Line Chart)
  const hourlyChartData = useMemo(() => {
    const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}`);
    const values = labels.map((_, i) => 10 + Math.sin(i / 3) * 3 + Math.random() * 1.5);
    return {
      labels,
      datasets: [{
        label: "Energy (kWh)",
        data: values,
        borderColor: "rgba(16, 185, 129, 0.85)", // Emerald
        backgroundColor: "rgba(16, 185, 129, 0.15)",
        fill: true,
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0
      }]
    };
  }, []);

  // 2. Daily Energy (Bar Chart)
  const dailyChartData = useMemo(() => {
    const labels = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    const values = labels.map((_, i) => 280 + Math.sin(i / 4) * 30 + Math.random() * 10);
    return {
      labels,
      datasets: [{
        label: "Daily Energy (kWh)",
        data: values,
        backgroundColor: "rgba(59, 130, 246, 0.85)", // Blue
        borderRadius: 3
      }]
    };
  }, []);

  // 3. Monthly Energy (Bar Chart)
  const monthlyChartData = useMemo(() => {
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const values = [8.2, 7.9, 8.5, 8.8, 9.1, 8.9, 9.0, 9.2, 8.7, 8.5, 8.3, 8.8];
    return {
      labels,
      datasets: [{
        label: "Monthly Energy (MWh)",
        data: values,
        backgroundColor: "rgba(139, 92, 246, 0.85)", // Purple
        borderRadius: 3
      }]
    };
  }, []);

  // 4. Energy Breakdown Donut Chart
  const breakdownChartData = useMemo(() => {
    return {
      labels: ["Chiller Plant", "Air Handling Unit", "Lighting", "Lite", "Other"],
      datasets: [{
        data: [50.2, 6.9, 8.3, 2.6, 32.0],
        backgroundColor: [
          "rgba(59, 130, 246, 0.85)", // Blue
          "rgba(16, 185, 129, 0.85)", // Green
          "rgba(139, 92, 246, 0.85)", // Purple
          "rgba(249, 115, 22, 0.85)", // Orange
          "rgba(100, 116, 139, 0.85)"  // Grey
        ],
        borderWidth: 0
      }]
    };
  }, []);

  // 5. Fan & Motor daily breakdown charts over 30 days
  const fanBreakdownData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
    const f1 = days.map((_, i) => 25 + Math.sin(i / 5) * 4 + Math.random() * 2);
    const f2 = days.map((_, i) => 22 + Math.cos(i / 4) * 3 + Math.random() * 2);
    const f3 = days.map((_, i) => 24 + Math.sin(i / 3) * 5 + Math.random() * 2);

    return {
      labels: days,
      datasets: [
        { label: "FAN-1", data: f1, backgroundColor: "rgba(59, 130, 246, 0.8)" },
        { label: "FAN-2", data: f2, backgroundColor: "rgba(16, 185, 129, 0.8)" },
        { label: "FAN-3", data: f3, backgroundColor: "rgba(249, 115, 22, 0.8)" }
      ]
    };
  }, []);

  const motorBreakdownData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
    const m1 = days.map((_, i) => 15 + Math.sin(i / 5) * 2 + Math.random());
    const m2 = days.map((_, i) => 18 + Math.cos(i / 4) * 2 + Math.random());
    const m3 = days.map((_, i) => 12 + Math.sin(i / 3) * 2 + Math.random());
    const m4 = days.map((_, i) => 16 + Math.cos(i / 5) * 2 + Math.random());
    const m5 = days.map((_, i) => 14 + Math.sin(i / 4) * 2 + Math.random());

    return {
      labels: days,
      datasets: [
        { label: "MTR-1", data: m1, backgroundColor: "rgba(59, 130, 246, 0.8)" },
        { label: "MTR-2", data: m2, backgroundColor: "rgba(16, 185, 129, 0.8)" },
        { label: "MTR-3", data: m3, backgroundColor: "rgba(139, 92, 246, 0.8)" },
        { label: "MTR-4", data: m4, backgroundColor: "rgba(249, 115, 22, 0.8)" },
        { label: "MTR-5", data: m5, backgroundColor: "rgba(100, 116, 139, 0.8)" }
      ]
    };
  }, []);

  const simpleChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 }, maxTicksLimit: 12 } },
      y: { grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" }, ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } } }
    }
  };

  const stackChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: isDark ? "#cbd5e1" : "#47729f", font: { size: 10, family: "Plus Jakarta Sans" } }
      }
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } } },
      y: { stacked: true, grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" }, ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } } }
    }
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          color: isDark ? "#cbd5e1" : "#47729f",
          font: { family: "Plus Jakarta Sans", size: 10 }
        }
      }
    }
  };

  if (!machine) return null;

  return (
    <div className="space-y-6">
      {/* Today / Monthly / Cost Highlights row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Today", value: "313 kWh", change: "-4.5% vs yesterday", status: "decrease" },
          { label: "Monthly", value: "8.81 MWh", change: "-3.4% vs last month", status: "decrease" },
          { label: "Yearly", value: "102.4 MWh", change: "FY 2026 Active", status: "neutral" },
          { label: "CO2 Emitted", value: "31.2 t", change: "Monthly emission", status: "neutral" },
          { label: "Energy Cost", value: "$14,580", change: "Monthly projection", status: "neutral" }
        ].map((card, idx) => (
          <div
            key={idx}
            className="p-4 bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl shadow-sm hover:shadow transition"
          >
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[#47729f] dark:text-slate-500">
              {card.label}
            </span>
            <div className="mt-2 text-xl font-extrabold tracking-tight text-[#002b5c] dark:text-slate-100">
              {card.value}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
              <span className={`w-1.5 h-1.5 rounded-full ${
                card.status === "decrease" ? "bg-emerald-500" : "bg-sky-500"
              }`} />
              <span>{card.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Grid Metrics / Power Quality */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
          Power Quality & Grid Telemetry
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs font-medium text-[#002b5c] dark:text-slate-300">
          {[
            { label: "Voltage L-L", val: `${metrics.voltage} V` },
            { label: "Current", val: `${metrics.current} A` },
            { label: "Frequency", val: `${metrics.frequency} Hz` },
            { label: "Power Factor", val: `${metrics.pf} PF` },
            { label: "Active Power", val: `${metrics.activePower} kW` },
            { label: "Apparent Power", val: `${metrics.apparentPower} kVA` },
            { label: "Reactive Power", val: `${metrics.reactivePower} kVAR` },
            { label: "Energy Today", val: `${metrics.energy.toLocaleString()} kWh` },
            { label: "THD Voltage", val: `${metrics.thdVoltage} %` },
            { label: "THD Current", val: `${metrics.thdCurrent} %` },
            { label: "V-Unbalance", val: `${metrics.vUnbalance} %` },
            { label: "I-Unbalance", val: `${metrics.iUnbalance} %` }
          ].map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-900 rounded-xl">
              <div className="text-[10px] uppercase text-[#47729f] dark:text-slate-500 font-bold block">{item.label}</div>
              <div className="mt-1 text-sm font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400">{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Oscilloscope Grid */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-3">
          Power Trend (Real-time kW load)
        </h3>
        <div className="h-44 rounded-xl overflow-hidden border border-[#acd3ff] dark:border-slate-800">
          <PowerDemandOscilloscope />
        </div>
      </div>

      {/* 4 Cards Grid - Per-jam, Harian, Bulanan, Rincian */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Konsumsi Energi Per-Jam</h4>
          <div className="h-44"><Line data={hourlyChartData} options={simpleChartOptions} /></div>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Konsumsi Energi Harian</h4>
          <div className="h-44"><Bar data={dailyChartData} options={simpleChartOptions} /></div>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Konsumsi Energi Bulanan</h4>
          <div className="h-44"><Bar data={monthlyChartData} options={simpleChartOptions} /></div>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Rincian Konsumsi Energi</h4>
          <div className="h-44"><Doughnut data={breakdownChartData} options={donutOptions} /></div>
        </div>
      </div>

      {/* Fan & Motor 30 Days Breakdown Bar Charts */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
          Component Energy Consumption Breakdown (30 Days Stacked)
        </h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-extrabold text-slate-500 uppercase mb-2">Fan Load Distribution (kWh)</h4>
            <div className="h-52"><Bar data={fanBreakdownData} options={stackChartOptions} /></div>
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-500 uppercase mb-2">Motor Load Distribution (kWh)</h4>
            <div className="h-52"><Bar data={motorBreakdownData} options={stackChartOptions} /></div>
          </div>
        </div>
      </div>

      {/* Cost & Carbon Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Analysis */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
            Economic Cost Analysis
          </h3>
          <div className="space-y-3 font-semibold text-xs text-[#002b5c] dark:text-slate-300">
            {[
              { label: "Daily Energy Cost", val: "$142.30" },
              { label: "Monthly Cost (proj.)", val: "$4,269.00" },
              { label: "Yearly Cost (proj.)", val: "$51,900.00" },
              { label: "Peak Demand Charge", val: "$1,240.00 / mo" },
              { label: "Active Tariff Scheme", val: "$0.12 / kWh - Time of Use (TOU)" }
            ].map((row, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-900 last:border-0">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-bold font-mono text-sm text-[#1f6fb5] dark:text-sky-400">{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Carbon Emission Estimation */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
            Carbon Emission Estimation
          </h3>
          <div className="space-y-3 font-semibold text-xs text-[#002b5c] dark:text-slate-300">
            {[
              { label: "Grid Emission Factor", val: "0.82 kgCO₂ / kWh" },
              { label: "Daily CO₂ Emissions", val: "348 kgCO₂" },
              { label: "Monthly CO₂ Emissions", val: "10.2 tCO₂" },
              { label: "Yearly CO₂ Emissions", val: "124.1 tCO₂" },
              { label: "Year-over-Year Offset Target (2026)", val: "-12% YoY Target" }
            ].map((row, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-900 last:border-0">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-bold font-mono text-sm text-rose-500">{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
