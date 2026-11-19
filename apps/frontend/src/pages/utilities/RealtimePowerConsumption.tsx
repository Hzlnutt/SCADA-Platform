import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import "../../components/charts/chartjs";
import { usePageActive } from "../../hooks/usePageActive";
import { useIsDark } from "../../hooks/useIsDark";
import { getJson } from "../../services/api.client";
import { getSocket } from "../../services/socket.service";
import { PM_NAME_MAPPING, getPmInfo, getPmSortIndex } from "../../data/pmMapping";
import { PmDetailModal, type ElectricPmItem } from "../../components/electricity/PmDetailModal";

const EXCLUDED_INCOMING_IDS = new Set([
  "PM410",
  "PM411",
  "PM412",
  "PM8000",
  "PM5560",
  "PM5560_WF1",
  "PM5560_WF2",
  "PM5500",
  "PM5500_WF1",
  "PM5500_WF2",
  "CUBICLE_PLN_PM8000",
  "FEEDER_WF1_PM5560",
  "FEEDER_WF2_PM5500"
]);

/**
 * Klasifikasi Power Meter berdasarkan Gateway:
 * - Factory 1 (Kiri): Gateway 1 (PM1xx, cth: 101, 102, 132..185 / group ew21)
 * - Factory 2 (Kanan): Gateway 2 & 3 (PM2xx & PM3xx, cth: 201..292, 301..337 / group ew22 & ew23)
 */
function classifyPmFactory(pmId: string, groupId?: string): 1 | 2 | null {
  const normalized = (pmId || "").trim().toUpperCase();
  if (!normalized || EXCLUDED_INCOMING_IDS.has(normalized)) return null;

  const numMatch = normalized.match(/^PM?(\d{3})\b/) || normalized.match(/(\d{3})/);
  if (numMatch) {
    const code = parseInt(numMatch[1], 10);
    if (code >= 100 && code < 200) return 1;
    if (code >= 200 && code < 400) return 2;
    if (code >= 400) return null;
  }

  const grp = (groupId || "").trim().toLowerCase();
  if (grp === "ew21") return 1;
  if (grp === "ew22" || grp === "ew23") return 2;
  return null;
}

function buildInitialPmMap(): Map<string, ElectricPmItem> {
  const map = new Map<string, ElectricPmItem>();
  Object.keys(PM_NAME_MAPPING).forEach((pmKey) => {
    const upId = pmKey.toUpperCase();
    const factory = classifyPmFactory(upId);
    if (factory === 1 || factory === 2) {
      const numMatch = upId.match(/(\d{3})/);
      const code = numMatch ? parseInt(numMatch[1], 10) : 0;
      const defaultGroup = factory === 1 ? "ew21" : code >= 300 ? "ew23" : "ew22";
      map.set(upId, {
        pm_id: upId,
        group_id: defaultGroup,
        status: false,
        volt_ab: null,
        volt_bc: null,
        volt_ca: null,
        volt_ll: null,
        current_a: null,
        current_b: null,
        current_c: null,
        frequency: null,
        active_power_total: null,
        reactive_power_total: null,
        apparent_power_total: null,
        power_factor: null,
        voltage_unbalance: null,
        current_unbalance: null,
        thd_volt_a: null,
        thd_volt_b: null,
        thd_volt_c: null,
        thd_current_a: null,
        thd_current_b: null,
        thd_current_c: null,
        active_energy: null
      });
    }
  });
  return map;
}

const formatKw = (val: number): string =>
  val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function RealtimePowerConsumption() {
  const isPageActive = usePageActive();
  const isDark = useIsDark();

  const [pmMap, setPmMap] = useState<Map<string, ElectricPmItem>>(() => buildInitialPmMap());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPageActive) return;
    let active = true;

    const mergeIncomingRecords = (records: ElectricPmItem[]) => {
      if (!Array.isArray(records) || records.length === 0) return;
      setPmMap((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const item of records) {
          if (!item?.pm_id) continue;
          const upId = String(item.pm_id).trim().toUpperCase();
          const factory = classifyPmFactory(upId, item.group_id);
          if (factory === null) continue;
          const existing = next.get(upId);
          next.set(upId, existing ? { ...existing, ...item, pm_id: upId } : { ...item, pm_id: upId });
          changed = true;
        }
        return changed ? next : prev;
      });
    };

    const fetchAllPowerMeters = () => {
      getJson<{ data: ElectricPmItem[] }>(`/analytics/electricity/power-meters?group=all&_t=${Date.now()}`)
        .then((res) => {
          if (active && res?.data) {
            mergeIncomingRecords(res.data);
          }
        })
        .catch((err) => console.error("Failed to fetch realtime power meters:", err));
    };

    fetchAllPowerMeters();
    const interval = setInterval(fetchAllPowerMeters, 1000);

    const socket = getSocket();
    const handleLiveSocket = (payload: { groupId?: string; data?: ElectricPmItem[] }) => {
      if (!active || !payload || !Array.isArray(payload.data)) return;
      mergeIncomingRecords(payload.data);
    };

    socket.on("electricity:ew21_live", handleLiveSocket);
    socket.on("electricity:ew22_live", handleLiveSocket);
    socket.on("electricity:ew23_live", handleLiveSocket);
    socket.on("electricity:custom_pm_live", handleLiveSocket);
    socket.on("electricity:pm_live_update", handleLiveSocket);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off("electricity:ew21_live", handleLiveSocket);
      socket.off("electricity:ew22_live", handleLiveSocket);
      socket.off("electricity:ew23_live", handleLiveSocket);
      socket.off("electricity:custom_pm_live", handleLiveSocket);
      socket.off("electricity:pm_live_update", handleLiveSocket);
    };
  }, [isPageActive]);

  const { fact1List, fact2List, fact1TotalKw, fact2TotalKw, fact1Online, fact2Online } = useMemo(() => {
    const f1: { pm: ElectricPmItem; label: string; kw: number; hasKw: boolean }[] = [];
    const f2: { pm: ElectricPmItem; label: string; kw: number; hasKw: boolean }[] = [];
    const term = searchTerm.trim().toLowerCase();

    let total1 = 0;
    let total2 = 0;
    let online1 = 0;
    let online2 = 0;

    for (const pm of pmMap.values()) {
      const factory = classifyPmFactory(pm.pm_id, pm.group_id);
      if (factory === null) continue;

      const info = getPmInfo(pm.pm_id);
      const rawKw = pm.active_power_total;
      const hasKw = rawKw !== null && rawKw !== undefined && !isNaN(Number(rawKw));
      const kw = hasKw ? Math.max(0, Number(Number(rawKw).toFixed(2))) : 0;
      const isOnline = pm.status !== false && (Boolean(pm.status) || hasKw);

      if (factory === 1) {
        if (hasKw) total1 += kw;
        if (isOnline) online1++;
      } else {
        if (hasKw) total2 += kw;
        if (isOnline) online2++;
      }

      if (term) {
        const matches =
          pm.pm_id.toLowerCase().includes(term) ||
          info.name.toLowerCase().includes(term) ||
          info.model.toLowerCase().includes(term) ||
          (info.category && info.category.toLowerCase().includes(term));
        if (!matches) continue;
      }

      const entry = {
        pm,
        label: `${pm.pm_id} — ${info.name}`,
        kw,
        hasKw
      };

      if (factory === 1) f1.push(entry);
      else f2.push(entry);
    }

    const sortByHighestKw = (
      a: { pm: ElectricPmItem; kw: number; hasKw: boolean },
      b: { pm: ElectricPmItem; kw: number; hasKw: boolean }
    ) => {
      if (b.kw !== a.kw) return b.kw - a.kw;
      if (a.hasKw !== b.hasKw) return a.hasKw ? -1 : 1;
      return getPmSortIndex(a.pm.pm_id) - getPmSortIndex(b.pm.pm_id);
    };

    f1.sort(sortByHighestKw);
    f2.sort(sortByHighestKw);

    return {
      fact1List: f1,
      fact2List: f2,
      fact1TotalKw: Number(total1.toFixed(1)),
      fact2TotalKw: Number(total2.toFixed(1)),
      fact1Online: online1,
      fact2Online: online2
    };
  }, [pmMap, searchTerm]);

  const selectedPm = useMemo(
    () => (selectedPmId ? pmMap.get(selectedPmId.toUpperCase()) ?? null : null),
    [pmMap, selectedPmId]
  );

  // Plugin untuk menampilkan angka realtime kW di ujung kanan setiap bar
  const barValueLabelPlugin = useMemo(
    () => ({
      id: "realtimeKwValueLabel",
      afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        const dataset = chart.data.datasets?.[0];
        if (!meta || !dataset) return;

        ctx.save();
        ctx.font = "bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = isDark ? "#e2e8f0" : "#334155";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        meta.data.forEach((bar: any, index: number) => {
          const val = Number(dataset.data[index] ?? 0);
          const text = `${formatKw(val)} kW`;
          ctx.fillText(text, bar.x + 6, bar.y);
        });
        ctx.restore();
      }
    }),
    [isDark]
  );

  const makeBarOptions = (items: { pm: ElectricPmItem; label: string; kw: number; hasKw: boolean }[]) => ({
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 280,
      easing: "easeOutQuart" as const
    },
    interaction: {
      mode: "nearest" as const,
      axis: "y" as const,
      intersect: false
    },
    onClick: (_event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const target = items[idx];
        if (target?.pm?.pm_id) {
          setSelectedPmId(target.pm.pm_id);
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        animation: { duration: 150 },
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.96)",
        titleColor: isDark ? "#f8fafc" : "#0f172a",
        bodyColor: isDark ? "#38bdf8" : "#0369a1",
        borderColor: isDark ? "#334155" : "#cbd5e1",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => {
            const idx = ctx.dataIndex;
            const item = items[idx];
            const val = Number(ctx.parsed.x ?? 0);
            if (item && !item.hasKw) {
              return `Active Power: ${formatKw(val)} kW (Menunggu Data API)`;
            }
            return `Active Power: ${formatKw(val)} kW`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grace: "18%",
        grid: { color: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.5)" },
        ticks: {
          color: isDark ? "rgba(148, 163, 184, 0.75)" : "rgba(71, 85, 105, 0.75)",
          font: { size: 10 },
          callback: (value: any) => `${Number(value).toLocaleString("id-ID")} kW`
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          color: isDark ? "rgba(226, 232, 240, 0.88)" : "rgba(51, 65, 85, 0.9)",
          font: { size: 10, weight: 600 as any },
          autoSkip: false
        }
      }
    }
  });

  const fact1ChartData = useMemo(
    () => ({
      labels: fact1List.map((item) => item.label),
      datasets: [
        {
          label: "Active Power (kW)",
          data: fact1List.map((item) => item.kw),
          backgroundColor: "rgba(31, 111, 181, 0.85)",
          hoverBackgroundColor: "rgba(31, 111, 181, 1)",
          borderWidth: 0,
          borderRadius: 4,
          barPercentage: 0.62
        }
      ]
    }),
    [fact1List]
  );

  const fact2ChartData = useMemo(
    () => ({
      labels: fact2List.map((item) => item.label),
      datasets: [
        {
          label: "Active Power (kW)",
          data: fact2List.map((item) => item.kw),
          backgroundColor: "rgba(6, 182, 212, 0.85)",
          hoverBackgroundColor: "rgba(6, 182, 212, 1)",
          borderWidth: 0,
          borderRadius: 4,
          barPercentage: 0.62
        }
      ]
    }),
    [fact2List]
  );

  const fact1Options = useMemo(() => makeBarOptions(fact1List), [fact1List, isDark]);
  const fact2Options = useMemo(() => makeBarOptions(fact2List), [fact2List, isDark]);

  return (
    <div className="space-y-5">
      {/* Top Toolbar: Title & Search Filter */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 text-base">
            ⚡
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#1f6fb5] dark:text-sky-400">
                Realtime Power Meter Consumption (kW)
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE 1s
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Perbandingan konsumsi daya aktif realtime (kW) seluruh Power Meter Factory 1 (Gateway 1) dan Factory 2 (Gateway 2 & 3) diurutkan dari beban tertinggi.
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Cari Mesin / PM (cth: Chiller, PM140)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 pl-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
        </div>
      </div>

      {/* Side-by-Side Layout: Left = Factory 1 (Gateway 1), Right = Factory 2 (Gateway 2 & 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: FACTORY 1 (Gateway 1: PM1xx) */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                  Factory 1 Consumption
                </h3>
                <span className="text-xs font-extrabold font-mono text-[#1f6fb5] dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                  Total: {formatKw(fact1TotalKw)} kW
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Factory 1 power meters (Gateway 1 • PM1xx) sorted by highest realtime kW consumer.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/10 text-[#1f6fb5] dark:text-sky-400 border border-sky-500/20">
              {fact1Online}/{fact1List.length} Online
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[320px]">
            {fact1List.length > 0 ? (
              <div style={{ height: Math.max(320, fact1List.length * 30) }}>
                <Bar
                  data={fact1ChartData}
                  options={fact1Options}
                  plugins={[barValueLabelPlugin]}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[320px] text-center">
                <span className="text-2xl mb-1 opacity-40">📊</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Tidak Ada Power Meter Factory 1
                </span>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: FACTORY 2 (Gateway 2 & 3: PM2xx & PM3xx) */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#06b6d4] dark:text-cyan-400">
                  Factory 2 Consumption
                </h3>
                <span className="text-xs font-extrabold font-mono text-[#06b6d4] dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                  Total: {formatKw(fact2TotalKw)} kW
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Factory 2 power meters (Gateway 2 & 3 • PM2xx / PM3xx) sorted by highest realtime kW consumer.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-[#06b6d4] dark:text-cyan-400 border border-cyan-500/20">
              {fact2Online}/{fact2List.length} Online
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 flex-1 min-h-[320px]">
            {fact2List.length > 0 ? (
              <div style={{ height: Math.max(320, fact2List.length * 30) }}>
                <Bar
                  data={fact2ChartData}
                  options={fact2Options}
                  plugins={[barValueLabelPlugin]}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[320px] text-center">
                <span className="text-2xl mb-1 opacity-40">📊</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Tidak Ada Power Meter Factory 2
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal Detail Power Meter saat bar diklik */}
      <PmDetailModal
        pm={selectedPm}
        onClose={() => setSelectedPmId(null)}
        isDark={isDark}
      />
    </div>
  );
}
