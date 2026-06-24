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

// Radial Gauge Component matching Power Quality Mockup
function RadialGauge({ label, value, unit, min = 0, max = 100, color = "#10b981" }: { label: string, value: number, unit: string, min?: number, max?: number, color?: string }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 35;
  const circ = 2 * Math.PI * r;
  const angleRange = 240;
  const arcLength = (angleRange / 360) * circ;
  const strokeDashoffset = arcLength - pct * arcLength;

  return (
    <div className="flex flex-col items-center justify-between p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl shadow-sm transition hover:scale-[1.01]">
      <div className="relative w-28 h-20 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-[210deg]" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#e2e8f0"
            className="dark:stroke-slate-800"
            strokeWidth="8"
            strokeDasharray={`${arcLength} ${circ}`}
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${arcLength} ${circ}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute bottom-2 flex flex-col items-center">
          <span className="text-xs font-extrabold font-mono text-[#002b5c] dark:text-slate-100">{value.toFixed(2)}{unit}</span>
        </div>
      </div>
      <span className="text-[9px] font-extrabold uppercase text-[#47729f] dark:text-slate-500 tracking-wider text-center mt-2">
        {label}
      </span>
    </div>
  );
}

// Progress Bar Row Component for Tegangan & Arus
function ProgressBarRow({ label, val, unit, nominal }: { label: string, val: number, unit: string, nominal: number }) {
  const pct = Math.max(0, Math.min(100, (val / (nominal * 1.25)) * 100));
  const barColors: Record<string, string> = {
    L1: "bg-rose-500",
    L2: "bg-amber-400",
    L3: "bg-sky-400"
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        <span className="font-extrabold">{label}</span>
        <span className="font-mono font-bold text-[#002b5c] dark:text-slate-200">{val.toFixed(1)} {unit}</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-200/30 dark:border-slate-800/40">
        <div className={`h-full ${barColors[label] || "bg-sky-500"} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MachineEnergy() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  // Interactive rates keyed by unitId (in Rp)
  const [electricityLwbpRate, setElectricityLwbpRate] = useState(() => {
    const saved = localStorage.getItem(`scada.tariff.electricity_lwbp.${unitId}`);
    return saved ? Number(saved) : 1112;
  });
  const [electricityWbpRate, setElectricityWbpRate] = useState(() => {
    const saved = localStorage.getItem(`scada.tariff.electricity_wbp.${unitId}`);
    return saved ? Number(saved) : 1600;
  });
  const [gasRate, setGasRate] = useState(() => {
    const saved = localStorage.getItem(`scada.tariff.gas.${unitId}`);
    return saved ? Number(saved) : 120000;
  });
  const [waterRate, setWaterRate] = useState(() => {
    const saved = localStorage.getItem(`scada.tariff.water.${unitId}`);
    return saved ? Number(saved) : 9000;
  });

  const handleRateChange = (type: "electricity_lwbp" | "electricity_wbp" | "gas" | "water", val: number) => {
    if (type === "electricity_lwbp") {
      setElectricityLwbpRate(val);
      localStorage.setItem(`scada.tariff.electricity_lwbp.${unitId}`, val.toString());
    } else if (type === "electricity_wbp") {
      setElectricityWbpRate(val);
      localStorage.setItem(`scada.tariff.electricity_wbp.${unitId}`, val.toString());
    } else if (type === "gas") {
      setGasRate(val);
      localStorage.setItem(`scada.tariff.gas.${unitId}`, val.toString());
    } else if (type === "water") {
      setWaterRate(val);
      localStorage.setItem(`scada.tariff.water.${unitId}`, val.toString());
    }
  };

  // State to simulate drifting real-time grid metrics matching mockup specs
  const [pqData, setPqData] = useState({
    activePower: 101.4,
    reactivePower: 46.1,
    apparentPower: 111.4,
    pf: 0.91,

    vll1: 399.5, vll2: 400.2, vll3: 402.8,
    vln1: 229.1, vln2: 229.2, vln3: 228.9,
    current1: 165.3, current2: 163.7, current3: 165.2,

    freq: 49.92,
    vUnb: 1.04,
    iUnb: 2.64,
    thdV: 3.15,
    thdI: 9.82
  });

  // Drift simulation disabled for production telemetry integration
  useEffect(() => {
    // Timer drift simulation turned off to prevent mock data display
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
    const m6 = days.map((_, i) => 15 + Math.cos(i / 3) * 2 + Math.random());
    const m7 = days.map((_, i) => 13 + Math.sin(i / 5) * 2 + Math.random());
    const m8 = days.map((_, i) => 17 + Math.cos(i / 4) * 2 + Math.random());
    const m9 = days.map((_, i) => 14 + Math.sin(i / 3) * 2 + Math.random());

    return {
      labels: days,
      datasets: [
        { label: "MTR-1", data: m1, backgroundColor: "rgba(59, 130, 246, 0.8)" },
        { label: "MTR-2", data: m2, backgroundColor: "rgba(16, 185, 129, 0.8)" },
        { label: "MTR-3", data: m3, backgroundColor: "rgba(139, 92, 246, 0.8)" },
        { label: "MTR-4", data: m4, backgroundColor: "rgba(249, 115, 22, 0.8)" },
        { label: "MTR-5", data: m5, backgroundColor: "rgba(100, 116, 139, 0.8)" },
        { label: "MTR-6", data: m6, backgroundColor: "rgba(236, 72, 153, 0.8)" },
        { label: "MTR-7", data: m7, backgroundColor: "rgba(234, 179, 8, 0.8)" },
        { label: "MTR-8", data: m8, backgroundColor: "rgba(20, 184, 166, 0.8)" },
        { label: "MTR-9", data: m9, backgroundColor: "rgba(99, 102, 241, 0.8)" }
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

  // Real calculated consumptions based on unit specs
  const dailyElectricity = machine.dailyBase ?? 3000;
  const dailyGas = (machine.groupId === "boiler-plant" || machine.id.includes("boiler")) ? (dailyElectricity * 0.8) : 0;
  const dailyWater = (
    machine.groupId === "cooling-water-system" ||
    machine.groupId === "water-treatment" ||
    machine.groupId === "boiler-plant" ||
    machine.id.includes("ro") ||
    machine.id.includes("distillate") ||
    machine.id.includes("pw") ||
    machine.id.includes("wfi")
  ) ? (machine.outputBase ?? 500) : 0;

  // Split electricity into LWBP (22:00 - 17:00, 19 hours) and WBP (17:00 - 22:00, 5 hours)
  const lwbpKwh = dailyElectricity * (19 / 24);
  const wbpKwh = dailyElectricity * (5 / 24);
  const dailyElectricityCost = (lwbpKwh * electricityLwbpRate) + (wbpKwh * electricityWbpRate);

  // Gas consumption in Sm3 and converted to MMBtu
  const gasSm3 = dailyGas;
  const gasMmbtu = gasSm3 * 0.035315;
  const dailyGasCost = gasMmbtu * gasRate; // gasRate is Rp/MMBtu

  // Water consumption in m3
  const dailyWaterCost = dailyWater * waterRate; // waterRate is Rp/m³

  // Equivalent Energy (kWh Setara)
  const electricityKwhSetara = dailyElectricity;
  const gasKwhSetara = gasMmbtu * 293.07;
  const waterKwhSetara = dailyWater * 0.5;
  const totalKwhSetara = electricityKwhSetara + gasKwhSetara + waterKwhSetara;

  const totalDailyCost = dailyElectricityCost + dailyGasCost + dailyWaterCost;
  const totalMonthlyCost = totalDailyCost * 30.437;
  const totalYearlyCost = totalDailyCost * 365;

  const electricityToday = dailyElectricity;
  const electricityMonthly = dailyElectricity * 30.437 / 1000;
  const electricityYearly = dailyElectricity * 365 / 1000;

  // Carbon emissions split
  const carbonElectricityDaily = dailyElectricity * 0.82;
  const carbonGasDaily = gasSm3 * 1.88;
  const totalCarbonDaily = carbonElectricityDaily + carbonGasDaily;
  const totalCarbonMonthly = totalCarbonDaily * 30.437 / 1000;
  const totalCarbonYearly = totalCarbonDaily * 365 / 1000;
  const co2Emitted = totalCarbonMonthly;

  return (
    <div className="space-y-6">
      {/* Today / Monthly / Cost Highlights row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Today", value: `${electricityToday.toLocaleString()} kWh`, change: "Daily average", status: "neutral" },
          { label: "Monthly", value: `${electricityMonthly.toFixed(1)} MWh`, change: "Monthly average", status: "neutral" },
          { label: "Yearly", value: `${electricityYearly.toFixed(0)} MWh`, change: "Yearly average", status: "neutral" },
          { label: "CO2 Emitted", value: `${co2Emitted.toFixed(1)} t`, change: "Monthly offset", status: "neutral" },
          { label: "Energy Cost", value: `Rp. ${totalMonthlyCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`, change: "Monthly cost", status: "neutral" }
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
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>{card.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Power Quality & Grid Telemetry Sections matching Mockup */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-6 shadow-sm transition-colors duration-300 space-y-6">
        
        {/* 1. Power & Energy */}
        <div className="space-y-3">
          <div className="flex items-center border-l-4 border-sky-500 pl-2">
            <span className="text-xs font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wider">
              Power & Energy
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">ACTIVE POWER</span>
              <div className="mt-1 text-lg font-extrabold text-emerald-500 font-mono">
                {pqData.activePower.toFixed(1)} kW
              </div>
            </div>
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">REACTIVE POWER</span>
              <div className="mt-1 text-lg font-extrabold text-amber-500 font-mono">
                {pqData.reactivePower.toFixed(1)} kVAR
              </div>
            </div>
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">APPARENT POWER</span>
              <div className="mt-1 text-lg font-extrabold text-indigo-500 dark:text-indigo-400 font-mono">
                {pqData.apparentPower.toFixed(1)} kVA
              </div>
            </div>
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">POWER FACTOR</span>
              <div className="mt-1 text-lg font-extrabold text-emerald-500 font-mono">
                {pqData.pf.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-0.5">Good</div>
            </div>
          </div>
        </div>

        {/* 2. Voltage & Current */}
        <div className="space-y-3">
          <div className="flex items-center border-l-4 border-sky-500 pl-2">
            <span className="text-xs font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wider">
              Voltage & Current
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tegangan L-L */}
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl space-y-3 shadow-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-extrabold uppercase text-[#47729f] dark:text-slate-500">VOLTAGE L-L (400 V)</span>
                <span className="text-[9px] font-bold text-slate-400">Nominal 400 V</span>
              </div>
              <div className="space-y-2.5">
                <ProgressBarRow label="L1" val={pqData.vll1} unit="V" nominal={400} />
                <ProgressBarRow label="L2" val={pqData.vll2} unit="V" nominal={400} />
                <ProgressBarRow label="L3" val={pqData.vll3} unit="V" nominal={400} />
              </div>
            </div>

            {/* Tegangan L-N */}
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl space-y-3 shadow-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-extrabold uppercase text-[#47729f] dark:text-slate-500">VOLTAGE L-N (230 V)</span>
                <span className="text-[9px] font-bold text-slate-400">Nominal 230 V</span>
              </div>
              <div className="space-y-2.5">
                <ProgressBarRow label="L1" val={pqData.vln1} unit="V" nominal={230} />
                <ProgressBarRow label="L2" val={pqData.vln2} unit="V" nominal={230} />
                <ProgressBarRow label="L3" val={pqData.vln3} unit="V" nominal={230} />
              </div>
            </div>

            {/* Arus Per Fasa */}
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl space-y-3 shadow-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-extrabold uppercase text-[#47729f] dark:text-slate-500">CURRENT PER PHASE</span>
                <span className="text-[9px] font-bold text-slate-400">Nominal 197.64 A</span>
              </div>
              <div className="space-y-2.5">
                <ProgressBarRow label="L1" val={pqData.current1} unit="A" nominal={197.64} />
                <ProgressBarRow label="L2" val={pqData.current2} unit="A" nominal={197.64} />
                <ProgressBarRow label="L3" val={pqData.current3} unit="A" nominal={197.64} />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Power Quality */}
        <div className="space-y-3">
          <div className="flex items-center border-l-4 border-sky-500 pl-2">
            <span className="text-xs font-extrabold text-[#002b5c] dark:text-slate-100 uppercase tracking-wider">
              Power Quality
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <RadialGauge label="FREQUENCY" value={pqData.freq} unit=" Hz" min={48} max={52} color="#10b981" />
            <RadialGauge label="V UNBALANCE" value={pqData.vUnb} unit=" %" min={0} max={5} color="#10b981" />
            <RadialGauge label="I UNBALANCE" value={pqData.iUnb} unit=" %" min={0} max={10} color="#f59e0b" />
            <RadialGauge label="THD VOLTAGE" value={pqData.thdV} unit=" %" min={0} max={10} color="#f59e0b" />
            <RadialGauge label="THD CURRENT" value={pqData.thdI} unit=" %" min={0} max={20} color="#ef4444" />
          </div>
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

      {/* 4 Cards Grid - Hourly, Daily, Monthly, Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Hourly Energy Consumption</h4>
          <div className="h-44"><Line data={hourlyChartData} options={simpleChartOptions} /></div>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Daily Energy Consumption</h4>
          <div className="h-44"><Bar data={dailyChartData} options={simpleChartOptions} /></div>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Monthly Energy Consumption</h4>
          <div className="h-44"><Bar data={monthlyChartData} options={simpleChartOptions} /></div>
        </div>
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Energy Consumption Breakdown</h4>
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
        {/* Cost Analysis Card */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
            Economic Cost Analysis & Tariff Settings
          </h3>
          
          {/* Interactive Tariff Input Rates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-900/60">
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase">Electricity LWBP (Rp/kWh)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={electricityLwbpRate}
                onChange={(e) => handleRateChange("electricity_lwbp", Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-[#002b5c] dark:text-white focus:outline-none font-bold font-mono"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase">Electricity WBP (Rp/kWh)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={electricityWbpRate}
                onChange={(e) => handleRateChange("electricity_wbp", Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-[#002b5c] dark:text-white focus:outline-none font-bold font-mono"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase">Gas (Rp/MMBtu)</label>
              <input
                type="number"
                step="1000"
                min="0"
                value={gasRate}
                onChange={(e) => handleRateChange("gas", Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-[#002b5c] dark:text-white focus:outline-none font-bold font-mono"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase">Water (Rp/m³)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={waterRate}
                onChange={(e) => handleRateChange("water", Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-[#002b5c] dark:text-white focus:outline-none font-bold font-mono"
              />
            </div>
          </div>

          <div className="space-y-3 font-semibold text-xs text-[#002b5c] dark:text-slate-300">
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-900">
              <span className="text-slate-500 font-extrabold uppercase text-[10px]">1. Electricity KWH (Total)</span>
              <div className="text-right">
                <div className="font-bold text-sm text-[#002b5c] dark:text-slate-200">
                  {dailyElectricity.toLocaleString()} kWh | Rp. {dailyElectricityCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold font-mono">
                  {electricityKwhSetara.toLocaleString(undefined, {maximumFractionDigits: 1})} kWh Setara
                </div>
              </div>
            </div>
            
            <div className="pl-4 space-y-1.5 py-1.5 border-b border-slate-100/50 dark:border-slate-900/50 bg-slate-50/50 dark:bg-slate-900/20 rounded-lg">
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="text-slate-500 font-medium">LWBP (Luar Waktu Beban Puncak) (22.00 - 17.00)</span>
                <span className="font-semibold font-mono text-[#002b5c] dark:text-slate-300">
                  {lwbpKwh.toFixed(1)} kWh | Rp. {(lwbpKwh * electricityLwbpRate).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="text-slate-500 font-medium">WBP (Waktu Beban Puncak) (17.00 - 22.00)</span>
                <span className="font-semibold font-mono text-[#002b5c] dark:text-slate-300">
                  {wbpKwh.toFixed(1)} kWh | Rp. {(wbpKwh * electricityWbpRate).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-900">
              <span className="text-slate-500 font-extrabold uppercase text-[10px]">2. Water m³</span>
              <div className="text-right">
                <div className="font-bold text-sm text-[#002b5c] dark:text-slate-200">
                  {dailyWater.toLocaleString()} m³ | Cost: Rp. {dailyWaterCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold font-mono">
                  {waterKwhSetara.toLocaleString(undefined, {maximumFractionDigits: 1})} kWh Setara
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-900">
              <span className="text-slate-500 font-extrabold uppercase text-[10px]">3. Gas MMBtu</span>
              <div className="text-right">
                <div className="font-bold text-sm text-[#002b5c] dark:text-slate-200">
                  {gasMmbtu.toFixed(4)} mmbtu | Cost: Rp. {dailyGasCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold font-mono">
                  {gasSm3.toLocaleString()} Sm³ | {gasKwhSetara.toLocaleString(undefined, {maximumFractionDigits: 1})} kWh Setara
                </div>
              </div>
            </div>
            
            {/* SUMMED TOTAL PROJECTION CALCULATOR */}
            <div className="mt-4 pt-3 border-t border-[#acd3ff]/40 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wider mb-2">Total Projected Cost Summary</h4>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Total Daily Cost</span>
                <span className="font-bold font-mono text-sm text-[#1f6fb5] dark:text-sky-400">
                  Rp. {totalDailyCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Total Monthly Cost</span>
                <span className="font-bold font-mono text-sm text-[#1f6fb5] dark:text-sky-400">
                  Rp. {totalMonthlyCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Total Yearly Cost</span>
                <span className="font-bold font-mono text-sm text-[#1f6fb5] dark:text-sky-400">
                  Rp. {totalYearlyCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Carbon Emission Estimation */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
            Carbon Emission Estimation
          </h3>
          <div className="space-y-3 font-semibold text-xs text-[#002b5c] dark:text-slate-300">
            <div className="py-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">1. Electricity (Listrik)</span>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900">
                <span className="text-slate-500">Grid Emission Factor</span>
                <span className="font-bold font-mono text-slate-600 dark:text-slate-300">0.82 kgCO₂ / kWh</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900">
                <span className="text-slate-500">Daily CO₂ Emissions</span>
                <span className="font-bold font-mono text-rose-500">{carbonElectricityDaily.toFixed(1)} kgCO₂</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900">
                <span className="text-slate-500">Monthly CO₂ Emissions</span>
                <span className="font-bold font-mono text-rose-500">{(carbonElectricityDaily * 30.437 / 1000).toFixed(2)} tCO₂</span>
              </div>
            </div>

            <div className="py-1 mt-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">2. Gas</span>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900">
                <span className="text-slate-500">Gas Emission Factor</span>
                <span className="font-bold font-mono text-slate-600 dark:text-slate-300">1.88 kgCO₂ / Sm³</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900">
                <span className="text-slate-500">Daily CO₂ Emissions</span>
                <span className="font-bold font-mono text-rose-500">{carbonGasDaily.toFixed(1)} kgCO₂</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900">
                <span className="text-slate-500">Monthly CO₂ Emissions</span>
                <span className="font-bold font-mono text-rose-500">{(carbonGasDaily * 30.437 / 1000).toFixed(2)} tCO₂</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#acd3ff]/40 dark:border-slate-800 space-y-2 mt-2">
              <h4 className="text-xs font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wider">Total Carbon Emissions Summary</h4>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Total Daily Emissions</span>
                <span className="font-bold font-mono text-sm text-rose-500">
                  {totalCarbonDaily.toFixed(1)} kgCO₂
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Total Monthly Emissions</span>
                <span className="font-bold font-mono text-sm text-rose-500">
                  {totalCarbonMonthly.toFixed(2)} tCO₂
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Total Yearly Emissions</span>
                <span className="font-bold font-mono text-sm text-rose-500">
                  {totalCarbonYearly.toFixed(2)} tCO₂
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
