import { useMemo, useState } from "react";
import { utils, writeFile } from "xlsx";
import { PageHeader } from "../components/ui/PageHeader";
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

const reportTypes: { id: ReportType; label: string; description: string }[] = [
  {
    id: "energy",
    label: "Energy",
    description: "Listrik, gas, air, solar panel, dan biaya energi."
  },
  {
    id: "utility",
    label: "Utility",
    description: "Boiler, cooling tower, compressed air, dan chiller."
  },
  {
    id: "hvac",
    label: "HVAC",
    description: "Area HVAC, OAC, warehouse, QC, dan chiller HVAC."
  },
  {
    id: "wwtp",
    label: "WWTP",
    description: "Debit influent, kualitas effluent, dan treatment."
  }
];

const monthOptions = [
  "Januari 2026",
  "Februari 2026",
  "Maret 2026",
  "April 2026",
  "Mei 2026",
  "Juni 2026"
];

const monthlySummary = {
  energyKwh: 3880000,
  electricityCost: 1960000000,
  gasCost: 1140000000,
  waterCost: 55000000,
  solarKwh: 698400,
  alarmEvents: 42
};

const ytdSummary = {
  energyKwh: 21480000,
  budgetIdr: 21600000000,
  actualIdr: 23280000000,
  solarKwh: 3920000,
  co2Ton: 861.4,
  utilityAvailability: 96.8
};

const conditionStyle: Record<ChecklistCondition, string> = {
  OK: "border-[#9ed9c1] bg-[#e7f7f1] text-[#1c7f63]",
  Attention: "border-[#f1d08a] bg-[#fff6da] text-[#b98700]",
  Fail: "border-[#f0a0a0] bg-[#ffe4e4] text-[#b03a3a]"
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);

const createInitialChecklist = () =>
  Object.fromEntries(
    allEquipment.map((item) => [
      item.id,
      {
        condition: "OK",
        running: true,
        leakage: false,
        abnormalNoise: false,
        notes: ""
      } satisfies ChecklistRow
    ])
  );

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("energy");
  const [month, setMonth] = useState("Mei 2026");
  const [shift, setShift] = useState("Shift Pagi 06:00-14:00");
  const [operator, setOperator] = useState("operator-demo");
  const [checklist, setChecklist] = useState<Record<string, ChecklistRow>>(
    createInitialChecklist
  );

  const sortedEquipment = useMemo(
    () =>
      [...allEquipment].sort((a, b) =>
        `${a.name} ${a.code}`.localeCompare(`${b.name} ${b.code}`)
      ),
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
      {
        total: 0,
        OK: 0,
        Attention: 0,
        Fail: 0,
        notRunning: 0,
        leakage: 0,
        abnormalNoise: 0
      }
    );
  }, [checklist]);

  const updateChecklist = (id: string, patch: Partial<ChecklistRow>) => {
    setChecklist((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch
      }
    }));
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
      { metric: "YTD CO2 Ton", value: ytdSummary.co2Ton }
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
        shift,
        operator,
        segment: item.segment,
        category: item.category,
        equipment: item.name,
        code: item.code,
        tag: item.tagId ?? "-",
        condition: row.condition,
        running: row.running ? "Yes" : "No",
        leakage: row.leakage ? "Yes" : "No",
        abnormal_noise: row.abnormalNoise ? "Yes" : "No",
        notes: row.notes
      };
    });

    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Shift Checklist");
    writeFile(workbook, `shift-checklist-${shift.replaceAll(" ", "-")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Report bulanan, year-to-date, dan checklist inspeksi per shift."
      />

      <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#4c78a6]">
              Report Bulanan
            </div>
            <div className="mt-1 text-sm text-[#2a5b91]">
              Pilih bulan dan jenis laporan untuk ringkasan operasional.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-lg border border-[#cde4ff] bg-white px-3 py-2 text-sm text-[#0b3a68]"
            >
              {monthOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportMonthlyReport}
              className="rounded-lg border border-[#2f8ae5] bg-[#e6f2ff] px-4 py-2 text-sm font-semibold text-[#0b3a68]"
            >
              Export Monthly/YTD
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {reportTypes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setReportType(item.id)}
              className={[
                "rounded-xl border p-4 text-left transition",
                reportType === item.id
                  ? "border-[#2f8ae5] bg-[#e6f2ff]"
                  : "border-[#d7e8fb] bg-[#f6fbff]"
              ].join(" ")}
            >
              <div className="text-sm font-semibold text-[#0b3a68]">
                {item.label}
              </div>
              <div className="mt-1 text-xs text-[#4c78a6]">
                {item.description}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Energy</div>
            <div className="mt-1 text-xl font-semibold text-[#0b3a68]">
              {formatNumber(monthlySummary.energyKwh)} kWh
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Listrik</div>
            <div className="mt-1 text-xl font-semibold text-[#0b3a68]">
              {formatCurrency(monthlySummary.electricityCost)}
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Gas</div>
            <div className="mt-1 text-xl font-semibold text-[#0b3a68]">
              {formatCurrency(monthlySummary.gasCost)}
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Air</div>
            <div className="mt-1 text-xl font-semibold text-[#0b3a68]">
              {formatCurrency(monthlySummary.waterCost)}
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Solar Panel</div>
            <div className="mt-1 text-xl font-semibold text-[#0b3a68]">
              {formatNumber(monthlySummary.solarKwh)} kWh
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Alarm</div>
            <div className="mt-1 text-xl font-semibold text-[#0b3a68]">
              {monthlySummary.alarmEvents}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="text-xs uppercase tracking-[0.22em] text-[#4c78a6]">
          Year To Date
        </div>
        <div className="mt-1 text-sm text-[#2a5b91]">
          Ringkasan kumulatif sampai periode laporan berjalan.
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Total Energy</div>
            <div className="mt-1 text-2xl font-semibold text-[#0b3a68]">
              {formatNumber(ytdSummary.energyKwh)}
            </div>
            <div className="text-xs text-[#4c78a6]">kWh setara</div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Budget</div>
            <div className="mt-1 text-2xl font-semibold text-[#0b3a68]">
              {formatCurrency(ytdSummary.budgetIdr)}
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Actual</div>
            <div className="mt-1 text-2xl font-semibold text-[#0b3a68]">
              {formatCurrency(ytdSummary.actualIdr)}
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">CO2</div>
            <div className="mt-1 text-2xl font-semibold text-[#0b3a68]">
              {ytdSummary.co2Ton.toFixed(1)} ton
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8fb] bg-[#f6fbff] p-4">
            <div className="text-xs text-[#4c78a6]">Availability</div>
            <div className="mt-1 text-2xl font-semibold text-[#0b3a68]">
              {ytdSummary.utilityAvailability.toFixed(1)}%
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#bcd7f1] bg-white/90 p-5 shadow-[0_18px_38px_rgba(20,93,170,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#4c78a6]">
              Checklist Pemeriksaan Shift
            </div>
            <div className="mt-1 text-sm text-[#2a5b91]">
              Form inspeksi machine A-Z untuk operator per shift.
            </div>
          </div>
          <button
            type="button"
            onClick={exportChecklist}
            className="w-fit rounded-lg border border-[#2f8ae5] bg-[#e6f2ff] px-4 py-2 text-sm font-semibold text-[#0b3a68]"
          >
            Export Checklist
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c78a6]">
            Shift
            <select
              value={shift}
              onChange={(event) => setShift(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#cde4ff] bg-white px-3 py-2 text-sm normal-case tracking-normal text-[#0b3a68]"
            >
              <option>Shift Pagi 06:00-14:00</option>
              <option>Shift Siang 14:00-22:00</option>
              <option>Shift Malam 22:00-06:00</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c78a6]">
            Operator
            <input
              value={operator}
              onChange={(event) => setOperator(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#cde4ff] bg-white px-3 py-2 text-sm normal-case tracking-normal text-[#0b3a68]"
            />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total", value: checklistStats.total },
              { label: "OK", value: checklistStats.OK },
              { label: "Warn", value: checklistStats.Attention },
              { label: "Fail", value: checklistStats.Fail }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-[#d7e8fb] bg-[#f6fbff] p-3 text-center"
              >
                <div className="text-lg font-semibold text-[#0b3a68]">
                  {item.value}
                </div>
                <div className="text-[11px] text-[#4c78a6]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-[#4c78a6]">
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
            <tbody className="divide-y divide-[#d7e8fb]">
              {sortedEquipment.map((item) => {
                const row = checklist[item.id];

                return (
                  <tr key={item.id} className="text-[#1b3f63]">
                    <td className="px-3 py-3 font-semibold text-[#0b3a68]">
                      {item.name}
                    </td>
                    <td className="px-3 py-3 text-xs text-[#4c78a6]">
                      {item.segment}
                    </td>
                    <td className="px-3 py-3 text-xs text-[#4c78a6]">
                      {item.category}
                    </td>
                    <td className="px-3 py-3 text-xs text-[#4c78a6]">
                      {item.code}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={row.condition}
                        onChange={(event) =>
                          updateChecklist(item.id, {
                            condition: event.target.value as ChecklistCondition
                          })
                        }
                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${conditionStyle[row.condition]}`}
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
                        onChange={(event) =>
                          updateChecklist(item.id, { running: event.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={row.leakage}
                        onChange={(event) =>
                          updateChecklist(item.id, { leakage: event.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={row.abnormalNoise}
                        onChange={(event) =>
                          updateChecklist(item.id, {
                            abnormalNoise: event.target.checked
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={row.notes}
                        onChange={(event) =>
                          updateChecklist(item.id, { notes: event.target.value })
                        }
                        placeholder="Catatan shift"
                        className="w-full rounded-lg border border-[#cde4ff] bg-white px-2 py-1 text-xs text-[#0b3a68]"
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
