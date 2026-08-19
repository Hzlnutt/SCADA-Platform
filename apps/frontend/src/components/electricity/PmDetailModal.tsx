import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { getJson } from "../../services/api.client";
import { getPmInfo } from "../../data/pmMapping";

export type ElectricPmItem = {
  pm_id: string;
  group_id?: string;
  status: boolean | null;
  volt_ab: number | null;
  volt_bc: number | null;
  volt_ca: number | null;
  volt_ll: number | null;
  current_a: number | null;
  current_b: number | null;
  current_c: number | null;
  frequency: number | null;
  active_power_total: number | null;
  reactive_power_total: number | null;
  apparent_power_total: number | null;
  power_factor: number | null;
  voltage_unbalance: number | null;
  current_unbalance: number | null;
  thd_volt_a: number | null;
  thd_volt_b: number | null;
  thd_volt_c: number | null;
  thd_current_a: number | null;
  thd_current_b: number | null;
  thd_current_c: number | null;
  active_energy: number | null;
  t_stamp?: string | Date;
};

type Props = {
  pm: ElectricPmItem | null;
  onClose: () => void;
  isDark: boolean;
};

export function PmDetailModal({ pm, onClose, isDark }: Props) {
  const [activeTab, setActiveTab] = useState<"params" | "trend">("params");
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!pm) return;
    setLoadingHistory(true);
    getJson<{ data: any[] }>(`/analytics/electricity/power-meters/${pm.pm_id}/history?hours=24`)
      .then((res) => {
        if (res?.data) {
          setHistoryData(res.data);
        }
      })
      .catch((err) => console.error("Failed to load PM history:", err))
      .finally(() => setLoadingHistory(false));
  }, [pm]);

  if (!pm) return null;

  const isOnline = pm.status !== false;

  // Chart configuration for history
  const historyLabels = historyData.map((d) => {
    const dt = new Date(d.t_stamp);
    return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  });

  const powerChartData = {
    labels: historyLabels,
    datasets: [
      {
        label: "Active Power (kW)",
        data: historyData.map((d) => d.active_power_total || 0),
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56,189,248,0.1)",
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 2
      }
    ]
  };

  const currentChartData = {
    labels: historyLabels,
    datasets: [
      {
        label: "Phase A (A)",
        data: historyData.map((d) => d.current_a || 0),
        borderColor: "#ef4444",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 0
      },
      {
        label: "Phase B (A)",
        data: historyData.map((d) => d.current_b || 0),
        borderColor: "#f59e0b",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 0
      },
      {
        label: "Phase C (A)",
        data: historyData.map((d) => d.current_c || 0),
        borderColor: "#10b981",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 0
      }
    ]
  };

  const chartOptions = (unit: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: isDark ? "#94a3b8" : "#64748b",
          font: { size: 10, weight: 700 }
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.raw} ${unit}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" },
        ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9 } }
      },
      y: {
        grid: { color: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" },
        ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9 } }
      }
    }
  });

  const fmt = (v: number | null | undefined, unit = "", decimals = 2) => {
    if (v === null || v === undefined) return "—";
    return `${Number(v).toFixed(decimals)} ${unit}`.trim();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 font-extrabold text-base">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white tracking-wide">
                  {getPmInfo(pm.pm_id).name}
                </h3>
                <span className="text-xs font-bold font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                  {pm.pm_id} • {getPmInfo(pm.pm_id).model}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    isOnline
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                    }`}
                  />
                  {isOnline ? "Live Online" : "Offline"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {getPmInfo(pm.pm_id).category} — {getPmInfo(pm.pm_id).location} ({pm.group_id?.toUpperCase() || "EW23"})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab("params")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "params"
                    ? "bg-white dark:bg-slate-900 text-sky-500 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                22 Parameter
              </button>
              <button
                onClick={() => setActiveTab("trend")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "trend"
                    ? "bg-white dark:bg-slate-900 text-sky-500 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                Grafik Tren 24h
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">Active Power</span>
            <div className="text-lg font-extrabold font-mono text-sky-500">
              {fmt(pm.active_power_total, "kW", 1)}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">Power Factor</span>
            <div className="text-lg font-extrabold font-mono text-emerald-500">
              {fmt(pm.power_factor, "", 3)}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">Arus Rata-rata</span>
            <div className="text-lg font-extrabold font-mono text-amber-500">
              {fmt(((Number(pm.current_a || 0) + Number(pm.current_b || 0) + Number(pm.current_c || 0)) / 3), "A", 1)}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">Active Energy</span>
            <div className="text-lg font-extrabold font-mono text-purple-500">
              {fmt(pm.active_energy, "kWh", 0)}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === "params" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Tegangan */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    ⚡ Tegangan (Voltage)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">V AC</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Volt A-B:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.volt_ab, "V")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Volt B-C:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.volt_bc, "V")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Volt C-A:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.volt_ca, "V")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Volt L-L:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.volt_ll, "V")}</span>
                  </div>
                  <div className="col-span-2 flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Voltage Unbalance:</span>
                    <span className="font-bold text-amber-500">{fmt(pm.voltage_unbalance, "%")}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Arus */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    🔋 Arus (Current)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">Ampere</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Current Phase A:</span>
                    <span className="font-bold text-rose-400">{fmt(pm.current_a, "A")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Current Phase B:</span>
                    <span className="font-bold text-amber-400">{fmt(pm.current_b, "A")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Current Phase C:</span>
                    <span className="font-bold text-emerald-400">{fmt(pm.current_c, "A")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Current Unbalance:</span>
                    <span className="font-bold text-amber-500">{fmt(pm.current_unbalance, "%")}</span>
                  </div>
                  <div className="col-span-2 flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Frekuensi:</span>
                    <span className="font-bold text-sky-400">{fmt(pm.frequency, "Hz")}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Daya & Energi */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    📊 Daya & Energi
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">Power</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Active Power Total:</span>
                    <span className="font-bold text-sky-400">{fmt(pm.active_power_total, "kW")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Reactive Power Total:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.reactive_power_total, "kVAR")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Apparent Power Total:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.apparent_power_total, "kVA")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Power Factor:</span>
                    <span className="font-bold text-emerald-400">{fmt(pm.power_factor, "", 3)}</span>
                  </div>
                  <div className="col-span-2 flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">Active Energy:</span>
                    <span className="font-bold text-purple-400">{fmt(pm.active_energy, "kWh", 0)}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Harmonisa (THD) */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    📈 Harmonisa (THD)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">Kualitas Daya</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">THD Volt A:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.thd_volt_a, "%")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">THD Volt B:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.thd_volt_b, "%")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">THD Volt C:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.thd_volt_c, "%")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">THD Current A:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.thd_current_a, "%")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">THD Current B:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.thd_current_b, "%")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400">THD Current C:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{fmt(pm.thd_current_c, "%")}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {loadingHistory && (
                <div className="text-xs text-sky-500 font-bold flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Memuat riwayat telemetri...
                </div>
              )}
              {/* Power Trend */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">Tren Daya Aktif (kW)</h4>
                <div style={{ height: 200 }}>
                  <Line data={powerChartData} options={chartOptions("kW")} />
                </div>
              </div>

              {/* Current Trend */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">Tren Arus Tiga Fasa (A)</h4>
                <div style={{ height: 200 }}>
                  <Line data={currentChartData} options={chartOptions("A")} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 text-[11px] text-slate-400">
          <span>Terakhir diperbarui: {pm.t_stamp ? new Date(pm.t_stamp).toLocaleTimeString("id-ID") : "Live"}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
