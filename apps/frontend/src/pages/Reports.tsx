import { useMemo, useState } from "react";
import { utils, writeFile } from "xlsx";
import { PageHeader } from "../components/ui/PageHeader";
import { DonutChart } from "../components/charts/DonutChart";
import { allEquipment } from "../data/equipment";

type ChecklistCondition = "OK" | "Attention" | "Fail";

type ChecklistRow = {
  condition: ChecklistCondition;
  running: boolean;
  leakage: boolean;
  abnormalNoise: boolean;
  notes: string;
};

type ReportType = "energy" | "utility" | "hvac" | "wwtp";

const reportTypes: { id: ReportType; label: string; description: string; icon: string }[] = [
  { id: "energy", label: "Energy", description: "Listrik, gas, air, solar panel, dan biaya energi.", icon: "⚡" },
  { id: "utility", label: "Utility", description: "Boiler, cooling tower, compressed air, dan chiller.", icon: "🏭" },
  { id: "hvac", label: "HVAC", description: "Area HVAC, OAC, warehouse, QC, dan chiller HVAC.", icon: "❄️" },
  { id: "wwtp", label: "WWTP", description: "Debit influent, kualitas effluent, dan treatment.", icon: "💧" },
];

const monthOptions = [
  "Januari 2026", "Februari 2026", "Maret 2026",
  "April 2026", "Mei 2026", "Juni 2026",
];

const monthlySummary = {
  energyKwh: 3880000,
  electricityCost: 1960000000,
  gasCost: 1140000000,
  waterCost: 55000000,
  solarKwh: 698400,
  alarmEvents: 42,
};

const ytdSummary = {
  energyKwh: 21480000,
  budgetIdr: 21600000000,
  actualIdr: 23280000000,
  solarKwh: 3920000,
  co2Ton: 861.4,
  utilityAvailability: 96.8,
};

// Simulated 6-month energy trend data
const monthlyTrend = [3100000, 3550000, 3420000, 3780000, 3880000, 3650000];
const monthlyTrendLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];

const conditionStyle: Record<ChecklistCondition, { bg: string; text: string; dot: string }> = {
  OK: { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  Attention: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  Fail: { bg: "bg-rose-50 dark:bg-rose-950/20", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const createInitialChecklist = () =>
  Object.fromEntries(
    allEquipment.map((item) => [
      item.id,
      { condition: "OK", running: true, leakage: false, abnormalNoise: false, notes: "" } satisfies ChecklistRow,
    ])
  );

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("energy");
  const [month, setMonth] = useState("Mei 2026");
  const [shift, setShift] = useState("Shift Pagi 06:00-14:00");
  const [operator, setOperator] = useState("operator-demo");
  const [checklist, setChecklist] = useState<Record<string, ChecklistRow>>(createInitialChecklist);

  const sortedEquipment = useMemo(
    () => [...allEquipment].sort((a, b) => `${a.name} ${a.code}`.localeCompare(`${b.name} ${b.code}`)),
    []
  );

  const checklistStats = useMemo(() => {
    return Object.values(checklist).reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.condition] += 1;
        if (!row.running) acc.notRunning += 1;
        if (row.leakage) acc.leakage += 1;
        if (row.abnormalNoise) acc.abnormalNoise += 1;
        return acc;
      },
      { total: 0, OK: 0, Attention: 0, Fail: 0, notRunning: 0, leakage: 0, abnormalNoise: 0 }
    );
  }, [checklist]);

  const updateChecklist = (id: string, patch: Partial<ChecklistRow>) => {
    setChecklist((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const exportMonthlyReport = () => {
    const rows = [
      { metric: "Report Type", value: reportType },
      { metric: "Month", value: month },
      { metric: "Energy kWh", value: monthlySummary.energyKwh },
      { metric: "Electricity Cost", value: monthlySummary.electricityCost },
      { metric: "Gas Cost", value: monthlySummary.gasCost },
      { metric: "Water Cost", value: monthlySummary.waterCost },
      { metric: "Solar Panel kWh", value: monthlySummary.solarKwh },
      { metric: "Alarm Events", value: monthlySummary.alarmEvents },
      { metric: "YTD Energy kWh", value: ytdSummary.energyKwh },
      { metric: "YTD Budget IDR", value: ytdSummary.budgetIdr },
      { metric: "YTD Actual IDR", value: ytdSummary.actualIdr },
      { metric: "YTD CO2 Ton", value: ytdSummary.co2Ton },
    ];
    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Monthly YTD");
    writeFile(workbook, `monthly-ytd-${reportType}-${month.replaceAll(" ", "-")}.xlsx`);
  };

  const exportChecklist = () => {
    const rows = sortedEquipment.map((item) => {
      const row = checklist[item.id];
      return {
        shift, operator, segment: item.segment, category: item.category,
        equipment: item.name, code: item.code, tag: item.tagId ?? "-",
        condition: row.condition, running: row.running ? "Yes" : "No",
        leakage: row.leakage ? "Yes" : "No", abnormal_noise: row.abnormalNoise ? "Yes" : "No",
        notes: row.notes,
      };
    });
    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Shift Checklist");
    writeFile(workbook, `shift-checklist-${shift.replaceAll(" ", "-")}.xlsx`);
  };

  const budgetPct = Math.min((ytdSummary.actualIdr / ytdSummary.budgetIdr) * 100, 120);
  const isOverBudget = ytdSummary.actualIdr > ytdSummary.budgetIdr;
  const maxTrend = Math.max(...monthlyTrend);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Report bulanan, year-to-date, dan checklist inspeksi per shift." />

      {/* MONTHLY REPORT */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 font-semibold">
              Report Bulanan
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Pilih bulan dan jenis laporan untuk ringkasan operasional.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
            >
              {monthOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportMonthlyReport}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 transition-colors shadow-sm"
            >
              Export Monthly/YTD
            </button>
          </div>
        </div>

        {/* Report type selector */}
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {reportTypes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setReportType(item.id)}
              className={`rounded-xl border p-4 text-left transition-all ${
                reportType === item.id
                  ? "border-cyan-400 dark:border-cyan-600 bg-cyan-50 dark:bg-cyan-950/20 shadow-sm"
                  : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="text-lg mb-1">{item.icon}</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</div>
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{item.description}</div>
            </button>
          ))}
        </div>

        {/* Monthly stats with mini trend */}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="col-span-full xl:col-span-1 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 font-semibold">Trend Energi 6 Bulan</div>
            <div className="h-24 flex items-end gap-1.5">
              {monthlyTrend.map((val, i) => {
                const hPct = (val / maxTrend) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-cyan-500 to-cyan-400 dark:from-cyan-600 dark:to-cyan-400 transition-all duration-500"
                      style={{ height: `${hPct}%`, minHeight: 4 }}
                    />
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">{monthlyTrendLabels[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {[
            { label: "Energy", value: `${formatNumber(monthlySummary.energyKwh)} kWh` },
            { label: "Listrik", value: formatCurrency(monthlySummary.electricityCost) },
            { label: "Gas", value: formatCurrency(monthlySummary.gasCost) },
            { label: "Air", value: formatCurrency(monthlySummary.waterCost) },
            { label: "Solar Panel", value: `${formatNumber(monthlySummary.solarKwh)} kWh` },
            { label: "Alarm", value: String(monthlySummary.alarmEvents) },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
              <div className="text-xs text-slate-400 dark:text-slate-500">{item.label}</div>
              <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* YEAR TO DATE */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 font-semibold">Year To Date</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ringkasan kumulatif sampai periode laporan berjalan.</div>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-xs text-slate-400 dark:text-slate-500">Total Energy</div>
            <div className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">{formatNumber(ytdSummary.energyKwh)}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">kWh setara</div>
          </div>

          {/* Budget vs Actual with progress bar */}
          <div className="lg:col-span-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-slate-400 dark:text-slate-500">Budget vs Actual</div>
              <span className={`text-[10px] font-bold ${isOverBudget ? "text-rose-500" : "text-emerald-500"}`}>
                {isOverBudget ? "OVER BUDGET" : "ON BUDGET"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <div className="text-slate-400 dark:text-slate-500">Budget</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(ytdSummary.budgetIdr)}</div>
              </div>
              <div>
                <div className="text-slate-400 dark:text-slate-500">Actual</div>
                <div className={`font-bold ${isOverBudget ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatCurrency(ytdSummary.actualIdr)}
                </div>
              </div>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isOverBudget ? "bg-rose-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1">{budgetPct.toFixed(1)}%</div>
          </div>

          {/* CO2 */}
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-xs text-slate-400 dark:text-slate-500">CO₂ Emissions</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-800 dark:text-white">{ytdSummary.co2Ton.toFixed(1)}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">ton</span>
            </div>
            <div className="text-lg mt-1">🌿</div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
            <div className="text-xs text-slate-400 dark:text-slate-500">Availability</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{ytdSummary.utilityAvailability.toFixed(1)}%</div>
          </div>
        </div>
      </section>

      {/* SHIFT CHECKLIST */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 font-semibold">
              Checklist Pemeriksaan Shift
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Form inspeksi machine A-Z untuk operator per shift.
            </div>
          </div>
          <button
            type="button"
            onClick={exportChecklist}
            className="w-fit rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 transition-colors shadow-sm"
          >
            Export Checklist
          </button>
        </div>

        {/* Shift + Operator + Stats + Donut */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Shift
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm normal-case tracking-normal text-slate-700 dark:text-slate-200"
            >
              <option>Shift Pagi 06:00-14:00</option>
              <option>Shift Siang 14:00-22:00</option>
              <option>Shift Malam 22:00-06:00</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Operator
            <input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm normal-case tracking-normal text-slate-700 dark:text-slate-200"
            />
          </label>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total", value: checklistStats.total, color: "text-slate-700 dark:text-slate-200" },
              { label: "OK", value: checklistStats.OK, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Warn", value: checklistStats.Attention, color: "text-amber-600 dark:text-amber-400" },
              { label: "Fail", value: checklistStats.Fail, color: "text-rose-600 dark:text-rose-400" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-3 text-center">
                <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Checklist Donut */}
          <div className="flex items-center justify-center">
            <DonutChart
              segments={[
                { label: "OK", value: checklistStats.OK, color: "#10b981" },
                { label: "Attention", value: checklistStats.Attention, color: "#f59e0b" },
                { label: "Fail", value: checklistStats.Fail, color: "#f43f5e" },
              ]}
              size={100}
              thickness={12}
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              <tr>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Segment</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2">Running</th>
                <th className="px-3 py-2">Leak</th>
                <th className="px-3 py-2">Noise</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedEquipment.map((item) => {
                const row = checklist[item.id];
                const cStyle = conditionStyle[row.condition];
                return (
                  <tr key={item.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-3 font-semibold text-slate-800 dark:text-white">{item.name}</td>
                    <td className="px-3 py-3 text-xs text-slate-400 dark:text-slate-500">{item.segment}</td>
                    <td className="px-3 py-3 text-xs text-slate-400 dark:text-slate-500">{item.category}</td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-400 dark:text-slate-500">{item.code}</td>
                    <td className="px-3 py-3">
                      <select
                        value={row.condition}
                        onChange={(e) =>
                          updateChecklist(item.id, { condition: e.target.value as ChecklistCondition })
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${cStyle.bg} ${cStyle.text} border-transparent`}
                      >
                        <option>OK</option>
                        <option>Attention</option>
                        <option>Fail</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={row.running}
                        onChange={(e) => updateChecklist(item.id, { running: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-cyan-500 focus:ring-cyan-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={row.leakage}
                        onChange={(e) => updateChecklist(item.id, { leakage: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-amber-500 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={row.abnormalNoise}
                        onChange={(e) => updateChecklist(item.id, { abnormalNoise: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-rose-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={row.notes}
                        onChange={(e) => updateChecklist(item.id, { notes: e.target.value })}
                        placeholder="Catatan shift"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
