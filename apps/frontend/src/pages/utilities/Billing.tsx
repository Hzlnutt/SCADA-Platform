import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { DonutChart } from "../../components/charts/DonutChart";
import { getJson } from "../../services/api.client";
import { useSystemStore } from "../../store/system.store";
import { utils, writeFile } from "xlsx";

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function Billing() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  // Initial timeline ranges (Default: 2024-01 to 2026-12 or similar)
  const [fromMonth, setFromMonth] = useState("2024-01");
  const [toMonth, setToMonth] = useState("2025-12");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    bills: {
      month: string;
      electricity: { kwh: number; cost: number };
      water: { m3: number; cost: number };
      gas: { sm3: number; cost: number; costUsd: number };
      totalCost: number;
    }[];
    yearlyAccumulations: {
      year: number;
      electricityCost: number;
      waterCost: number;
      gasCost: number;
      totalCost: number;
    }[];
  } | null>(null);

  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getJson<{
        data: {
          bills: {
            month: string;
            electricity: { kwh: number; cost: number };
            water: { m3: number; cost: number };
            gas: { sm3: number; cost: number; costUsd: number };
            totalCost: number;
          }[];
          yearlyAccumulations: {
            year: number;
            electricityCost: number;
            waterCost: number;
            gasCost: number;
            totalCost: number;
          }[];
        }
      }>(`/analytics/billing?from=${fromMonth}&to=${toMonth}`);
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      console.error(err);
      setError("Gagal memuat data billing. Mohon periksa koneksi atau rentang tanggal.");
    } finally {
      setLoading(false);
    }
  }, [fromMonth, toMonth]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  // Calculations for KPIs
  const kpis = useMemo(() => {
    if (!data || data.bills.length === 0) {
      return { totalCost: 0, electricityCost: 0, waterCost: 0, gasCost: 0 };
    }
    return data.bills.reduce(
      (acc, bill) => {
        acc.totalCost += bill.totalCost;
        acc.electricityCost += bill.electricity.cost;
        acc.waterCost += bill.water.cost;
        acc.gasCost += bill.gas.cost;
        return acc;
      },
      { totalCost: 0, electricityCost: 0, waterCost: 0, gasCost: 0 }
    );
  }, [data]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (!data || data.bills.length === 0) return;

    const workbook = utils.book_new();

    // Sheet 1: Monthly Bills
    const monthlyRows = data.bills.map((bill) => {
      const [year, month] = bill.month.split("-");
      const monthLabel = `${MONTH_NAMES_ID[parseInt(month) - 1]} ${year}`;
      return {
        "Bulan": monthLabel,
        "Listrik (kWh)": bill.electricity.kwh,
        "Biaya Listrik (Rp)": bill.electricity.cost,
        "Air (m³)": bill.water.m3,
        "Biaya Air (Rp)": bill.water.cost,
        "Gas (Sm³)": bill.gas.sm3,
        "Biaya Gas (Rp)": bill.gas.cost,
        "Total Biaya Utilitas (Rp)": bill.totalCost
      };
    });
    const monthlySheet = utils.json_to_sheet(monthlyRows);
    utils.book_append_sheet(workbook, monthlySheet, "Tagihan Bulanan");

    // Sheet 2: Yearly Accumulation
    const yearlyRows = data.yearlyAccumulations.map((item) => ({
      "Tahun": item.year,
      "Biaya Listrik (Rp)": item.electricityCost,
      "Biaya Air (Rp)": item.waterCost,
      "Biaya Gas (Rp)": item.gasCost,
      "Total Biaya Utilitas (Rp)": item.totalCost
    }));
    const yearlySheet = utils.json_to_sheet(yearlyRows);
    utils.book_append_sheet(workbook, yearlySheet, "Akumulasi Tahunan");

    writeFile(workbook, `Laporan_Billing_Utilitas_${fromMonth}_ke_${toMonth}.xlsx`);
  };

  // Stacked chart configuration
  const chartConfig = useMemo(() => {
    if (!data || data.bills.length === 0) return null;

    // Display chronologically (reverse the API descending order)
    const chronoBills = [...data.bills].reverse();
    const labels = chronoBills.map((bill) => {
      const [year, month] = bill.month.split("-");
      return `${MONTH_NAMES_ID[parseInt(month) - 1].substring(0, 3)} ${year.substring(2)}`;
    });

    const electricityCosts = chronoBills.map((b) => b.electricity.cost);
    const waterCosts = chronoBills.map((b) => b.water.cost);
    const gasCosts = chronoBills.map((b) => b.gas.cost);

    return {
      labels,
      datasets: [
        {
          label: "Listrik",
          data: electricityCosts,
          backgroundColor: "#3b82f6",
          borderRadius: 4
        },
        {
          label: "Air",
          data: waterCosts,
          backgroundColor: "#06b6d4",
          borderRadius: 4
        },
        {
          label: "Gas",
          data: gasCosts,
          backgroundColor: "#f59e0b",
          borderRadius: 4
        }
      ]
    };
  }, [data]);

  // Donut chart configuration
  const donutSegments = useMemo(() => {
    if (kpis.totalCost === 0) return [];
    return [
      { label: "Listrik", value: Number(((kpis.electricityCost / kpis.totalCost) * 100).toFixed(1)), color: "#3b82f6" },
      { label: "Air", value: Number(((kpis.waterCost / kpis.totalCost) * 100).toFixed(1)), color: "#06b6d4" },
      { label: "Gas", value: Number(((kpis.gasCost / kpis.totalCost) * 100).toFixed(1)), color: "#f59e0b" }
    ];
  }, [kpis]);

  const chartOptions = {
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: isDark ? "#94a3b8" : "#475569",
          font: { weight: "bold" as const, family: "Outfit, sans-serif", size: 10 }
        }
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || "";
            if (label) label += ": ";
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: isDark ? "#64748b" : "#64748b",
          font: { weight: "bold" as const, family: "Outfit, sans-serif", size: 9 }
        }
      },
      y: {
        stacked: true,
        grid: { color: isDark ? "#1e293b" : "#f1f5f9" },
        ticks: {
          color: isDark ? "#64748b" : "#64748b",
          font: { family: "Outfit, sans-serif", size: 9 },
          callback: (value: any) => "Rp " + (value / 1e6).toFixed(0) + "M"
        }
      }
    }
  };

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    return `${MONTH_NAMES_ID[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Accumulation"
        description="Monitor pengeluaran biaya utilitas bulanan dan akumulasi tahunan secara komprehensif."
      />

      {/* Date Filter Panel */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Mulai Bulan</span>
            <input
              type="month"
              value={fromMonth}
              id="billing-from-month"
              onChange={(e) => setFromMonth(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Hingga Bulan</span>
            <input
              type="month"
              value={toMonth}
              id="billing-to-month"
              onChange={(e) => setToMonth(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBillingData}
            id="billing-refresh-btn"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 transition"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            id="billing-export-btn"
            disabled={loading || !data}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Excel
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/10 dark:border-rose-900/30 p-4 text-sm font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Billing Data...</span>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Dashboard cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Total Biaya Utilitas</span>
                <span className="text-lg">💰</span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
                {formatCurrency(kpis.totalCost)}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">Akumulasi seluruh utilitas dalam rentang waktu</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition hover:border-blue-400 dark:hover:border-blue-500">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Biaya Listrik (PLN)</span>
                <span className="text-lg">⚡</span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
                {formatCurrency(kpis.electricityCost)}
              </div>
              <div className="mt-1 text-[10px] text-blue-500 font-bold">
                {((kpis.electricityCost / (kpis.totalCost || 1)) * 100).toFixed(1)}% dari total biaya
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition hover:border-cyan-400 dark:hover:border-cyan-500">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Biaya Air (PDAM)</span>
                <span className="text-lg">💧</span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
                {formatCurrency(kpis.waterCost)}
              </div>
              <div className="mt-1 text-[10px] text-cyan-500 font-bold">
                {((kpis.waterCost / (kpis.totalCost || 1)) * 100).toFixed(1)}% dari total biaya
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition hover:border-amber-400 dark:hover:border-amber-500">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Biaya Gas (Simulated)</span>
                <span className="text-lg">🔥</span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
                {formatCurrency(kpis.gasCost)}
              </div>
              <div className="mt-1 text-[10px] text-amber-500 font-bold">
                {((kpis.gasCost / (kpis.totalCost || 1)) * 100).toFixed(1)}% dari total biaya
              </div>
            </div>
          </section>

          {/* Charts section */}
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Stacked bar billing trends */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Tren Tagihan Bulanan (Stack)
              </h3>
              <div className="h-64 flex-1 relative">
                {chartConfig && <Bar data={chartConfig} options={chartOptions} />}
              </div>
            </div>

            {/* Cost Breakdown Donut */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Distribusi Biaya Utilitas
              </h3>
              <div className="flex-1 flex items-center justify-center relative">
                {donutSegments.length > 0 && (
                  <div className="h-44 w-44">
                    <DonutChart segments={donutSegments} />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Tables Section */}
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Monthly Bills Table */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Rincian Tagihan Bulanan
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 flex-1">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                      <th className="p-3">Bulan</th>
                      <th className="p-3 text-right">Listrik (PLN)</th>
                      <th className="p-3 text-right">Air (PDAM)</th>
                      <th className="p-3 text-right">Gas</th>
                      <th className="p-3 text-right">Total Tagihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                    {data?.bills.map((bill) => (
                      <tr key={bill.month} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="p-3">{formatMonth(bill.month)}</td>
                        <td className="p-3 text-right font-mono">
                          <div>{formatCurrency(bill.electricity.cost)}</div>
                          <div className="text-[10px] text-slate-400">{bill.electricity.kwh.toLocaleString("id-ID")} kWh</div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          <div>{formatCurrency(bill.water.cost)}</div>
                          <div className="text-[10px] text-slate-400">{bill.water.m3.toLocaleString("id-ID")} m³</div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          <div>{formatCurrency(bill.gas.cost)}</div>
                          <div className="text-[10px] text-slate-400">{bill.gas.sm3.toLocaleString("id-ID")} Sm³</div>
                        </td>
                        <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">
                          {formatCurrency(bill.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yearly Accumulation Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Akumulasi Biaya Tahunan
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 flex-1">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                      <th className="p-3">Tahun</th>
                      <th className="p-3 text-right">Rincian Per Utilitas</th>
                      <th className="p-3 text-right">Total Biaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                    {data?.yearlyAccumulations.map((item) => (
                      <tr key={item.year} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{item.year}</td>
                        <td className="p-3 text-right text-[10px] space-y-1 font-mono">
                          <div>⚡ Listrik: {formatCurrency(item.electricityCost)}</div>
                          <div>💧 Air: {formatCurrency(item.waterCost)}</div>
                          <div>🔥 Gas: {formatCurrency(item.gasCost)}</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
