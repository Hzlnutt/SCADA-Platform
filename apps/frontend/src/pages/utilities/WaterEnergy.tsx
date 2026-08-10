import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useSystemStore } from "../../store/system.store";
import { getJson } from "../../services/api.client";
import { PageHeader } from "../../components/ui/PageHeader";

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

function WaterSubNav() {
  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
      <Link
        to="/air"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Overview
      </Link>
      <Link
        to="/air/distribusi"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Distribusi Air
      </Link>
      <Link
        to="/air/energy"
        className="border-b-2 border-cyan-500 px-4 py-2.5 text-xs font-extrabold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase transition-all duration-200"
      >
        Energy
      </Link>
    </div>
  );
}

export default function WaterEnergy() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  // Interactive rates
  const [electricityLwbpRate, setElectricityLwbpRate] = useState(1112);
  const [electricityWbpRate, setElectricityWbpRate] = useState(1600);
  const [waterRate, setWaterRate] = useState(7500);

  // Telemetry data
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Simulated power quality indicators
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

  // Drift simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setPqData((prev) => {
        const drift = (v: number, pct = 0.01) => v + (Math.random() * 2 - 1) * v * pct;
        return {
          activePower: drift(prev.activePower, 0.015),
          reactivePower: drift(prev.reactivePower, 0.02),
          apparentPower: drift(prev.apparentPower, 0.01),
          pf: Math.max(0.85, Math.min(0.99, drift(prev.pf, 0.005))),
          vll1: drift(prev.vll1, 0.002),
          vll2: drift(prev.vll2, 0.002),
          vll3: drift(prev.vll3, 0.002),
          vln1: drift(prev.vln1, 0.002),
          vln2: drift(prev.vln2, 0.002),
          vln3: drift(prev.vln3, 0.002),
          current1: drift(prev.current1, 0.02),
          current2: drift(prev.current2, 0.02),
          current3: drift(prev.current3, 0.02),
          freq: Math.max(49.5, Math.min(50.5, drift(prev.freq, 0.001))),
          vUnb: Math.max(0.5, Math.min(3, drift(prev.vUnb, 0.05))),
          iUnb: Math.max(1, Math.min(6, drift(prev.iUnb, 0.04))),
          thdV: Math.max(1, Math.min(5, drift(prev.thdV, 0.05))),
          thdI: Math.max(5, Math.min(15, drift(prev.thdI, 0.05)))
        };
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch generic analytics
    getJson<{ data: any }>("/analytics/water")
      .then((res) => {
        if (res && res.data) {
          setAnalyticsData(res.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch water energy analytics:", err);
        setLoading(false);
      });
  }, []);

  // Standard metrics
  const dailyElectricity = 1800; // kWh/day
  const dailyWater = 120; // m3/day
  const lwbpKwh = dailyElectricity * (19 / 24);
  const wbpKwh = dailyElectricity * (5 / 24);
  const dailyElectricityCost = (lwbpKwh * electricityLwbpRate) + (wbpKwh * electricityWbpRate);
  const dailyWaterCost = dailyWater * waterRate;

  const totalDailyCost = dailyElectricityCost + dailyWaterCost;
  const totalMonthlyCost = totalDailyCost * 30.437;
  const totalYearlyCost = totalDailyCost * 365;

  const carbonElectricityDaily = dailyElectricity * 0.82;
  const totalCarbonMonthly = (carbonElectricityDaily * 30.437) / 1000;

  // Chart layouts
  const hourlyChartData = useMemo(() => {
    const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
    const values = labels.map((_, i) => 80 + Math.sin(i / 3) * 15 + Math.random() * 8);
    return {
      labels,
      datasets: [{
        label: "Energy (kWh)",
        data: values,
        backgroundColor: "rgba(16, 185, 129, 0.85)",
        borderRadius: 3
      }]
    };
  }, []);

  const dailyChartData = useMemo(() => {
    const labels = Array.from({ length: 30 }, (_, i) => `${i+1}`);
    const values = labels.map(() => 1600 + Math.random() * 300);
    return {
      labels,
      datasets: [{
        label: "Daily Energy (kWh)",
        data: values,
        backgroundColor: "rgba(59, 130, 246, 0.85)",
        borderRadius: 4
      }]
    };
  }, []);

  const monthlyChartData = useMemo(() => {
    const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const values = [52000, 49000, 54000, 56000, 58000, 59000, 57000, 58500, 56500, 59500, 61000, 62000];
    return {
      labels,
      datasets: [{
        label: "Monthly Energy (kWh)",
        data: values,
        backgroundColor: "rgba(124, 58, 237, 0.85)",
        borderRadius: 5
      }]
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Water Utility — Energy" description="Analisis efisiensi pemakaian energi listrik, debit air setara dan emisi karbon pada sistem pompa water." />
      </div>

      <WaterSubNav />

      {/* Overview stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Today", value: `${dailyElectricity.toLocaleString()} kWh`, change: "Daily average", status: "neutral" },
          { label: "Monthly", value: `${(dailyElectricity * 30.437 / 1000).toFixed(1)} MWh`, change: "Monthly average", status: "neutral" },
          { label: "Yearly", value: `${(dailyElectricity * 365 / 1000).toFixed(0)} MWh`, change: "Yearly average", status: "neutral" },
          { label: "CO2 Emitted", value: `${totalCarbonMonthly.toFixed(1)} t`, change: "Monthly offset", status: "neutral" },
          { label: "Energy Cost", value: `Rp ${totalMonthlyCost.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`, change: "Monthly cost", status: "neutral" }
        ].map((card, idx) => (
          <div
            key={idx}
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow transition"
          >
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[#47729f] dark:text-slate-500">
              {card.label}
            </span>
            <div className="mt-2 text-xl font-extrabold tracking-tight text-slate-800 dark:text-white font-mono">
              {card.value}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>{card.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Oscilloscope + PQ Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Oscilloscope Panel */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#47729f] dark:text-slate-500">
                Power Demand Oscilloscope
              </h3>
              <p className="text-[10px] text-slate-400">Live scrolling wave of total power (kW)</p>
            </div>
          </div>
          <div className="h-60 w-full overflow-hidden border border-slate-200/50 dark:border-slate-800/80 rounded-xl">
            <PowerDemandOscilloscope />
          </div>
        </div>

        {/* Power Quality Radial Gauges */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#47729f] dark:text-slate-500">
            Power Quality Analytics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <RadialGauge label="Power Factor" value={pqData.pf} unit="" min={0.8} max={1} color="#f59e0b" />
            <RadialGauge label="Freq. Hz" value={pqData.freq} unit="Hz" min={49.5} max={50.5} color="#10b981" />
            <RadialGauge label="V-Unbalance" value={pqData.vUnb} unit="%" min={0} max={5} color="#ef4444" />
            <RadialGauge label="I-Unbalance" value={pqData.iUnb} unit="%" min={0} max={10} color="#6366f1" />
          </div>
        </div>
      </div>

      {/* Voltage and Current rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Voltage (L-L)</h4>
          <div className="space-y-3">
            <ProgressBarRow label="L1" val={pqData.vll1} unit="V" nominal={380} />
            <ProgressBarRow label="L2" val={pqData.vll2} unit="V" nominal={380} />
            <ProgressBarRow label="L3" val={pqData.vll3} unit="V" nominal={380} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Voltage (L-N)</h4>
          <div className="space-y-3">
            <ProgressBarRow label="L1" val={pqData.vln1} unit="V" nominal={220} />
            <ProgressBarRow label="L2" val={pqData.vln2} unit="V" nominal={220} />
            <ProgressBarRow label="L3" val={pqData.vln3} unit="V" nominal={220} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Current (Amps)</h4>
          <div className="space-y-3">
            <ProgressBarRow label="L1" val={pqData.current1} unit="A" nominal={150} />
            <ProgressBarRow label="L2" val={pqData.current2} unit="A" nominal={150} />
            <ProgressBarRow label="L3" val={pqData.current3} unit="A" nominal={150} />
          </div>
        </div>
      </div>

      {/* Energy Charts (Hourly/Daily/Monthly) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#47729f]">Hourly Energy Use</h4>
          <div style={{ height: 200 }}>
            <Bar data={hourlyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </div>
        
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#47729f]">Daily Energy Use</h4>
          <div style={{ height: 200 }}>
            <Bar data={dailyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#47729f]">Monthly Energy Use</h4>
          <div style={{ height: 200 }}>
            <Bar data={monthlyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>

      {/* Bottom Row: Cost Projections & Tariff settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Projections */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#47729f] dark:text-slate-500">
            Cost Projections
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#f8fafc] dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-900 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Daily Projected</span>
              <span className="text-base font-extrabold text-[#002b5c] dark:text-slate-200 font-mono">
                Rp {totalDailyCost.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="bg-[#f8fafc] dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-900 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Monthly Projected</span>
              <span className="text-base font-extrabold text-[#002b5c] dark:text-slate-200 font-mono">
                Rp {totalMonthlyCost.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="bg-[#f8fafc] dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-900 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Yearly Projected</span>
              <span className="text-base font-extrabold text-[#002b5c] dark:text-slate-200 font-mono">
                Rp {totalYearlyCost.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Tariffs config editor */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#47729f] dark:text-slate-500">
            Tariff Settings
          </h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Electricity WBP Rate (Rp/kWh)</span>
              <input
                type="number"
                value={electricityWbpRate}
                onChange={(e) => setElectricityWbpRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-slate-800 dark:text-slate-200 font-mono focus:outline-none"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Electricity LWBP Rate (Rp/kWh)</span>
              <input
                type="number"
                value={electricityLwbpRate}
                onChange={(e) => setElectricityLwbpRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-slate-800 dark:text-slate-200 font-mono focus:outline-none"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Water Rate (Rp/m³)</span>
              <input
                type="number"
                value={waterRate}
                onChange={(e) => setWaterRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-slate-800 dark:text-slate-200 font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
