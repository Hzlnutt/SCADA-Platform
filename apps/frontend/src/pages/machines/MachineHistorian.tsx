import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import * as XLSX from "xlsx";
import { TrendChart } from "../../components/charts/TrendChart";
import { getUnitById } from "../../data/machines";
import { industrialTags } from "../../data/industrial-tags";
import { getJson } from "../../services/api.client";
import type { MachineOutletContext } from "./MachineLayout";
import { useSystemStore } from "../../store/system.store";
import { DEFAULT_HVAC_CONFIG } from "../../data/equipment";
import type { HvacConfig } from "../../data/equipment";
import { Line } from "react-chartjs-2";
import "../../components/charts/chartjs";

type HistorianDoc = {
  ts: string;
  value: number | string | boolean;
  quality?: "good" | "bad" | "uncertain";
  meta: {
    tagId: string;
    unit?: string;
    count?: number;
    min?: number;
    max?: number;
    last?: number;
  };
};

type HistorianResponse = {
  data: HistorianDoc[];
};

const ranges = [
  { label: "1H", minutes: 60 },
  { label: "6H", minutes: 360 },
  { label: "24H", minutes: 1440 }
];

export default function MachineHistorian() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  if (unitId === "hvac-qc-retained-sample") {
    return <HvacHistorian unitId={unitId} theme={theme} isDark={isDark} />;
  }

  const [rangeMinutes, setRangeMinutes] = useState(60);
  const [resolution, setResolution] = useState<"Hourly" | "Daily" | "Monthly">("Hourly");
  const [data, setData] = useState<HistorianDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedTag = useMemo(() => {
    if (!machine) return null;
    return industrialTags.find((tag) => tag.tagId === machine.tagId) ?? {
      id: machine.id,
      name: machine.name,
      area: machine.area,
      category: machine.category,
      tagId: machine.tagId,
      unit: machine.unit,
      normalMin: undefined,
      normalMax: undefined
    };
  }, [machine]);

  useEffect(() => {
    if (!machine) return;
    let mounted = true;
    setLoading(true);
    const to = new Date();
    
    let fetchMinutes = rangeMinutes;
    if (resolution === "Daily") {
      fetchMinutes = 1440 * 15; // last 15 days
    } else if (resolution === "Monthly") {
      fetchMinutes = 1440 * 180; // last 180 days
    }

    const from = new Date(to.getTime() - fetchMinutes * 60 * 1000);
    const backendRes = (resolution === "Hourly" && rangeMinutes <= 360) ? "1m" : "1h";

    const params = new URLSearchParams({
      tagId: machine.tagId,
      from: from.toISOString(),
      to: to.toISOString(),
      resolution: backendRes,
      limit: "2000"
    });

    getJson<HistorianResponse>(`/historian/range?${params.toString()}`)
      .then((result) => {
        if (mounted) {
          setData(result.data);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [machine, rangeMinutes, resolution]);

  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (resolution === "Hourly") return data;

    const groups: Record<string, HistorianDoc[]> = {};
    data.forEach((item) => {
      const date = new Date(item.ts);
      let key = "";
      if (resolution === "Daily") {
        key = date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
      } else {
        key = date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit" });
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return Object.entries(groups).map(([key, items]) => {
      const values = items
        .map((i) => (typeof i.value === "number" ? i.value : Number(i.value)))
        .filter((v) => !isNaN(v));
      const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const minVal = values.length > 0 ? Math.min(...values) : 0;
      const maxVal = values.length > 0 ? Math.max(...values) : 0;
      const lastVal = values.length > 0 ? values[values.length - 1] : 0;

      const sampleItem = items[0];
      return {
        ts: items[items.length - 1].ts,
        value: avgValue,
        quality: sampleItem.quality,
        meta: {
          tagId: sampleItem.meta.tagId,
          unit: sampleItem.meta.unit,
          count: items.reduce((sum, item) => sum + (item.meta.count ?? 1), 0),
          min: minVal,
          max: maxVal,
          last: lastVal
        }
      } as HistorianDoc;
    });
  }, [data, resolution]);

  const downloadExcel = () => {
    if (!machine) return;
    const excelData = displayData.map((d) => ({
      Timestamp: new Date(d.ts).toLocaleString(),
      Value: typeof d.value === "number" ? Number(d.value.toFixed(3)) : d.value,
      Samples: d.meta.count ?? 1,
      Min: d.meta.min?.toFixed(3) ?? "—",
      Max: d.meta.max?.toFixed(3) ?? "—"
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historian Data");
    XLSX.writeFile(wb, `${machine.id}_historian_${resolution.toLowerCase()}.xlsx`);
  };

  if (!machine || !selectedTag) {
    return (
      <div className="rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-5 text-center text-sm text-[#47729f] dark:text-slate-400">
        Machine telemetry configuration not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-4 transition-colors duration-300">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-semibold">
            Machine Historian
          </div>
          <div className="mt-1 text-sm text-[#002b5c] dark:text-slate-300 font-semibold">
            {selectedTag.name} <span className="font-mono text-xs opacity-60">({machine.tagId})</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 px-1 py-1 text-xs">
            {ranges.map((range) => (
              <button
                key={range.label}
                type="button"
                onClick={() => {
                  if (range.minutes !== rangeMinutes) {
                    setRangeMinutes(range.minutes);
                  }
                }}
                className={[
                  "rounded-full px-3 py-1 font-semibold transition",
                  rangeMinutes === range.minutes
                    ? "bg-[#1f6fb5] text-white"
                    : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-300"
                ].join(" ")}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 px-1 py-1 text-xs">
            {(["Hourly", "Daily", "Monthly"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setResolution(item)}
                className={[
                  "rounded-full px-3 py-1 font-semibold transition",
                  resolution === item
                    ? "bg-[#1f6fb5] text-white"
                    : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-300"
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            onClick={downloadExcel}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-[#1f6fb5]/10 dark:hover:bg-[#1f6fb5]/20 text-[#002b5c] dark:text-slate-300 rounded-full transition"
          >
            📥 Export Excel
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950/70 p-5 transition-colors duration-300">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#002b5c] dark:text-slate-100">
              Telemetry History
            </div>
            <div className="mt-1 text-xs text-[#47729f] dark:text-slate-500">
              {displayData.length} samples | {resolution} resolution
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-[#47729f] dark:text-slate-400 animate-pulse">Loading...</div>
          ) : null}
        </div>
        
        <TrendChart
          points={displayData}
          unit={selectedTag.unit}
          heightClassName="h-72"
          minThreshold={selectedTag.normalMin}
          maxThreshold={selectedTag.normalMax}
          title={selectedTag.name}
        />

        <div className="mt-5 overflow-x-auto border border-[#acd3ff] dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7fbff] dark:bg-slate-900/50 text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500">
              <tr>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Timestamp</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Value</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Samples</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Min</th>
                <th className="px-4 py-3 border-b border-[#acd3ff] dark:border-slate-800">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#acd3ff] dark:divide-slate-800">
              {displayData.slice(-12).reverse().map((row) => (
                <tr key={`${row.meta.tagId}-${row.ts}`} className="text-[#002b5c] dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {new Date(row.ts).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">
                    {typeof row.value === "number"
                      ? row.value.toFixed(3)
                      : String(row.value)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {row.meta.count ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {row.meta.min?.toFixed(3) ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#47729f] dark:text-slate-500">
                    {row.meta.max?.toFixed(3) ?? "-"}
                  </td>
                </tr>
              ))}
              {displayData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#47729f] dark:text-slate-500">
                    No data points found for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HvacHistorian({ unitId, theme, isDark }: { unitId: string; theme: string; isDark: boolean }) {
  const [resolution, setResolution] = useState<"Hourly" | "Daily" | "Monthly">("Hourly");
  const [range, setRange] = useState<"24H" | "7D" | "30D">("24H");
  const [zoomActive, setZoomActive] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const config = useMemo<HvacConfig>(() => {
    const saved = localStorage.getItem(`scada.config.hvac.${unitId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_HVAC_CONFIG;
  }, [unitId]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, [range, resolution, refreshCounter]);

  useEffect(() => {
    if (isReplaying) {
      setLoading(true);
      const t = setTimeout(() => {
        setLoading(false);
        setIsReplaying(false);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [isReplaying]);

  const mockData = useMemo(() => {
    let count = 24;
    let labelFormat = (i: number) => {
      const h = (new Date().getHours() - (count - 1 - i) + 24) % 24;
      return `${h.toString().padStart(2, "0")}:00`;
    };

    if (resolution === "Daily") {
      count = range === "7D" ? 7 : 30;
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const todayIdx = new Date().getDay();
      labelFormat = (i: number) => {
        const idx = (todayIdx - (count - 1 - i) + 7) % 7;
        return days[idx];
      };
    } else if (resolution === "Monthly") {
      count = 12;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonth = new Date().getMonth();
      labelFormat = (i: number) => {
        const idx = (currentMonth - (count - 1 - i) + 12) % 12;
        return `${months[idx]} 2026`;
      };
    }

    const data = [];
    for (let i = 0; i < count; i++) {
      const waveVal = Math.sin(i / (count / 6));
      const cosWave = Math.cos(i / (count / 5));

      let ahu1 = config.ahu1.tempSp + waveVal * 1.5 + (Math.random() - 0.5) * 0.4;
      let ahu2 = config.ahu2.tempSp + waveVal * 1.4 + (Math.random() - 0.5) * 0.3;
      let ahu3 = config.ahu3.tempSp + cosWave * 1.2 + (Math.random() - 0.5) * 0.3;

      let ahu2H = config.ahu2.humiditySp + waveVal * 3.2 + (Math.random() - 0.5) * 0.6;
      let ahu3H = 75.0 + cosWave * 2.5 + (Math.random() - 0.5) * 0.5;

      ahu1 = Math.max(25.8, Math.min(29.1, ahu1));
      ahu2 = Math.max(38.4, Math.min(41.6, ahu2));
      ahu3 = Math.max(28.6, Math.min(31.4, ahu3));
      ahu2H = Math.max(71.2, Math.min(78.9, ahu2H));
      ahu3H = Math.max(72.1, Math.min(78.2, ahu3H));

      data.push({
        label: labelFormat(i),
        ahu1Temp: Number(ahu1.toFixed(1)),
        ahu2Temp: Number(ahu2.toFixed(1)),
        ahu3Temp: Number(ahu3.toFixed(1)),
        ahu2Hum: Number(ahu2H.toFixed(1)),
        ahu3Hum: Number(ahu3H.toFixed(1))
      });
    }

    if (resolution === "Hourly" && range === "24H" && refreshCounter === 0) {
      data[2].ahu1Temp = 25.8;
      data[12].ahu1Temp = 29.1;
      data[5].ahu2Temp = 38.4;
      data[15].ahu2Temp = 41.6;
      data[8].ahu3Temp = 28.6;
      data[18].ahu3Temp = 31.4;
      
      data[3].ahu2Hum = 71.2;
      data[13].ahu2Hum = 78.9;
      data[6].ahu3Hum = 72.1;
      data[16].ahu3Hum = 78.2;
    }

    return data;
  }, [range, resolution, config, refreshCounter]);

  const stats = useMemo(() => {
    const getMin = (arr: number[]) => Math.min(...arr);
    const getMax = (arr: number[]) => Math.max(...arr);
    const getMean = (arr: number[]) => Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));

    const ahu1Temps = mockData.map(d => d.ahu1Temp);
    const ahu2Temps = mockData.map(d => d.ahu2Temp);
    const ahu3Temps = mockData.map(d => d.ahu3Temp);
    const ahu2Hums = mockData.map(d => d.ahu2Hum);
    const ahu3Hums = mockData.map(d => d.ahu3Hum);

    return {
      ahu1Temp: { min: getMin(ahu1Temps), max: getMax(ahu1Temps), mean: getMean(ahu1Temps) },
      ahu2Temp: { min: getMin(ahu2Temps), max: getMax(ahu2Temps), mean: getMean(ahu2Temps) },
      ahu3Temp: { min: getMin(ahu3Temps), max: getMax(ahu3Temps), mean: getMean(ahu3Temps) },
      ahu2Hum: { min: getMin(ahu2Hums), max: getMax(ahu2Hums), mean: getMean(ahu2Hums) },
      ahu3Hum: { min: getMin(ahu3Hums), max: getMax(ahu3Hums), mean: getMean(ahu3Hums) }
    };
  }, [mockData]);

  const downloadCSV = () => {
    const headers = ["Timestamp", "AHU-01 Temp (degC)", "AHU-02 Temp (degC)", "AHU-03 Temp (degC)", "AHU-02 Humidity (%RH)", "AHU-03 Humidity (%RH)"];
    const rows = mockData.map((d) => [d.label, d.ahu1Temp, d.ahu2Temp, d.ahu3Temp, d.ahu2Hum, d.ahu3Hum]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hvac_retained_sample_trends_${resolution.toLowerCase()}_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcel = () => {
    const excelData = mockData.map((d) => ({
      Timestamp: d.label,
      "AHU-01 Temp (°C)": d.ahu1Temp,
      "AHU-02 Temp (°C)": d.ahu2Temp,
      "AHU-03 Temp (°C)": d.ahu3Temp,
      "AHU-02 Humidity (%RH)": d.ahu2Hum,
      "AHU-03 Humidity (%RH)": d.ahu3Hum
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HVAC Telemetry");
    XLSX.writeFile(wb, `hvac_retained_sample_trends_${resolution.toLowerCase()}.xlsx`);
  };

  const printPDF = () => {
    window.print();
  };

  const tempChartData = {
    labels: mockData.map(d => d.label),
    datasets: [
      {
        label: `AHU-01 Temp (Target: ${config.ahu1.lowTemp}-${config.ahu1.highTemp}°C)`,
        data: mockData.map(d => d.ahu1Temp),
        borderColor: "rgba(56, 189, 248, 0.9)",
        backgroundColor: "rgba(56, 189, 248, 0.1)",
        borderWidth: 2,
        pointRadius: range === "30D" ? 0 : 2,
        tension: 0.3
      },
      {
        label: `AHU-02 Temp (Target: ${config.ahu2.tempSp}°C±2°C)`,
        data: mockData.map(d => d.ahu2Temp),
        borderColor: "rgba(249, 115, 22, 0.9)",
        backgroundColor: "rgba(249, 115, 22, 0.1)",
        borderWidth: 2,
        pointRadius: range === "30D" ? 0 : 2,
        tension: 0.3
      },
      {
        label: `AHU-03 Temp (Target: ${config.ahu3.tempSp}°C±2°C)`,
        data: mockData.map(d => d.ahu3Temp),
        borderColor: "rgba(167, 139, 250, 0.9)",
        backgroundColor: "rgba(167, 139, 250, 0.1)",
        borderWidth: 2,
        pointRadius: range === "30D" ? 0 : 2,
        tension: 0.3
      }
    ]
  };

  const humidChartData = {
    labels: mockData.map(d => d.label),
    datasets: [
      {
        label: `AHU-02 Humidity (Target: ${config.ahu2.humiditySp}%±5%)`,
        data: mockData.map(d => d.ahu2Hum),
        borderColor: "rgba(249, 115, 22, 0.8)",
        backgroundColor: "rgba(249, 115, 22, 0.05)",
        borderWidth: 2,
        pointRadius: range === "30D" ? 0 : 2,
        tension: 0.3
      },
      {
        label: `AHU-03 Humidity (Target: 75%±5%)`,
        data: mockData.map(d => d.ahu3Hum),
        borderColor: "rgba(167, 139, 250, 0.8)",
        backgroundColor: "rgba(167, 139, 250, 0.05)",
        borderWidth: 2,
        pointRadius: range === "30D" ? 0 : 2,
        tension: 0.3
      }
    ]
  };

  const tempOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#94a3b8" : "#47729f",
          font: { size: 10, family: "Plus Jakarta Sans", weight: "bold" as const }
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
        min: zoomActive ? 22 : 15,
        max: zoomActive ? 43 : 48,
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      }
    }
  };

  const humidOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#94a3b8" : "#47729f",
          font: { size: 10, family: "Plus Jakarta Sans", weight: "bold" as const }
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
        min: zoomActive ? 68 : 60,
        max: zoomActive ? 82 : 88,
        grid: { color: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.4)" },
        ticks: { color: isDark ? "#64748b" : "#47729f", font: { size: 9 } }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Historical Range and Function Selectors Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#acd3ff] dark:border-slate-800 bg-[#f7fbff]/80 dark:bg-slate-950/70 p-4 transition-colors duration-300 backdrop-blur-md">
        <div className="space-y-0.5">
          <div className="text-xs uppercase tracking-[0.2em] text-[#47729f] dark:text-slate-500 font-extrabold">
            HVAC QC Retained Sample
          </div>
          <div className="text-sm text-[#002b5c] dark:text-slate-300 font-bold">
            Trend Analysis Dashboard
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Resolution Selector */}
          <div className="flex rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 px-1 py-1 text-xs font-bold shadow-sm">
            {(["Hourly", "Daily", "Monthly"] as const).map((res) => (
              <button
                key={res}
                onClick={() => {
                  setResolution(res);
                  if (res === "Hourly") setRange("24H");
                  else if (res === "Daily") setRange("7D");
                  else if (res === "Monthly") setRange("30D");
                }}
                className={`rounded-full px-3 py-1.5 transition ${
                  resolution === res
                    ? "bg-[#1f6fb5] text-white shadow-sm"
                    : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
                }`}
              >
                {res}
              </button>
            ))}
          </div>

          {/* Ranges (only visible for Daily to choose between 7D and 30D) */}
          {resolution === "Daily" && (
            <div className="flex rounded-full border border-[#acd3ff] dark:border-slate-800 bg-white dark:bg-slate-950 px-1 py-1 text-xs font-bold shadow-sm">
              {(["7D", "30D"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-full px-3 py-1.5 transition ${
                    range === r
                      ? "bg-[#1f6fb5] text-white shadow-sm"
                      : "text-[#47729f] dark:text-slate-400 hover:text-[#002b5c] dark:hover:text-slate-200"
                  }`}
                >
                  {r === "7D" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setZoomActive(!zoomActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                zoomActive
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  : "text-[#47729f] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/80"
              }`}
              title="Zoom to Fit Target Bands"
            >
              🔍 Zoom
            </button>
            <button
              onClick={() => setIsReplaying(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#47729f] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/80 transition flex items-center gap-1"
            >
              🔄 Replay
            </button>
            <button
              onClick={() => setRefreshCounter(c => c + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#47729f] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/80 transition flex items-center gap-1"
            >
              🔄 Refresh
            </button>
            <button
              onClick={downloadExcel}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1f6fb5] hover:bg-[#155c99] text-white transition flex items-center gap-1 shadow-sm"
            >
              📥 Export Excel
            </button>
            <button
              onClick={downloadCSV}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#47729f] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/80 transition flex items-center gap-1"
            >
              📥 CSV
            </button>
            <button
              onClick={printPDF}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#47729f] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/80 transition flex items-center gap-1"
            >
              🖨️ PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Charts Stack */}
      <div className="grid grid-cols-1 gap-6">
        {/* Temperature Trends Chart */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">
                Room Temperature History
              </h3>
              <p className="text-[10px] text-[#47729f] dark:text-slate-500">
                Hourly temperatures across AHU-01, AHU-02, and AHU-03 compared with setpoint limits.
              </p>
            </div>
            {loading && (
              <span className="text-xs text-sky-500 font-semibold animate-pulse">
                Fetching trend series...
              </span>
            )}
          </div>
          <div className="h-72 min-h-0">
            <Line data={tempChartData} options={tempOptions} />
          </div>
        </div>

        {/* Humidity Trends Chart */}
        <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-200 uppercase tracking-wide">
                Room Relative Humidity History
              </h3>
              <p className="text-[10px] text-[#47729f] dark:text-slate-500">
                Fluctuation trends of Reference Room (AHU-02) and Stability Room (AHU-03).
              </p>
            </div>
            {loading && (
              <span className="text-xs text-sky-500 font-semibold animate-pulse">
                Fetching trend series...
              </span>
            )}
          </div>
          <div className="h-72 min-h-0">
            <Line data={humidChartData} options={humidOptions} />
          </div>
        </div>
      </div>

      {/* Statistical Summary Grid */}
      <div className="bg-white dark:bg-slate-950 border border-[#acd3ff] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
        <h3 className="text-sm font-bold text-[#002b5c] dark:text-slate-100 uppercase tracking-wide border-b border-[#acd3ff]/30 pb-2 mb-4">
          Statistical Analysis Summary
        </h3>
        <div className="overflow-x-auto border border-[#acd3ff]/50 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f7fbff] dark:bg-slate-900/50 text-[10px] uppercase tracking-wider text-[#47729f] dark:text-slate-500 font-extrabold border-b border-[#acd3ff]/50 dark:border-slate-800">
                <th className="py-3 px-4">Telemetry Parameter Tag</th>
                <th className="py-3 px-4 text-center">Minimum</th>
                <th className="py-3 px-4 text-center">Maximum</th>
                <th className="py-3 px-4 text-center">AVERAGE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-semibold text-[#002b5c] dark:text-slate-300">
              <tr>
                <td className="py-3.5 px-4 font-bold">AHU-01 Clean Area Temperature (°C)</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu1Temp.min.toFixed(1)}</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu1Temp.max.toFixed(1)}</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu1Temp.mean.toFixed(1)}</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold">AHU-02 Accelerated Temperature (°C)</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu2Temp.min.toFixed(1)}</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu2Temp.max.toFixed(1)}</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu2Temp.mean.toFixed(1)}</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold">AHU-03 Long-term Temperature (°C)</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu3Temp.min.toFixed(1)}</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu3Temp.max.toFixed(1)}</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu3Temp.mean.toFixed(1)}</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold">AHU-02 Room Relative Humidity (%RH)</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu2Hum.min.toFixed(1)} %</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu2Hum.max.toFixed(1)} %</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu2Hum.mean.toFixed(1)} %</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold">AHU-03 Room Relative Humidity (%RH)</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu3Hum.min.toFixed(1)} %</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu3Hum.max.toFixed(1)} %</td>
                <td className="py-3.5 px-4 text-center font-mono">{stats.ahu3Hum.mean.toFixed(1)} %</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
