import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { TrendChart } from "../../components/charts/TrendChart";
import { machineGroups } from "../../data/machines";
import { useAlarmStore } from "../../store/alarm.store";
import { useTaskStore } from "../../store/task.store";

const formatValue = (value: number, unit: string) =>
  `${value.toFixed(1)} ${unit}`;

const buildTrendPoints = (values: number[]) => {
  const now = Date.now();
  const stepMs = 60 * 1000;

  return values.map((value, index) => ({
    ts: new Date(now - (values.length - index) * stepMs),
    value
  }));
};

export default function MachinesOverview() {
  const activeAlarms = useAlarmStore((state) => state.activeList);
  const tasks = useTaskStore((state) => state.tasks);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Machines Overview"
        description="Ringkasan performa PLC dan akses cepat ke detail masing-masing mesin."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {machineGroups.map((group) => {
          const primary = group.summaryCards[0];
          const secondary = group.summaryCards[1] ?? group.summaryCards[2];
          const trendPoints = buildTrendPoints(
            group.trend.series[0].values.slice(-24)
          );

          const groupUnitTags = new Set(group.units.map((u) => u.tagId));
          const groupAlarms = activeAlarms.filter((alarm) => groupUnitTags.has(alarm.tagId));
          const groupTasks = tasks.filter((task) => task.groupId === group.id && task.status !== "Completed");

          return (
            <Link
              key={group.id}
              to={`/machines/${group.id}`}
              className="group rounded-xl border border-[#acd3ff] dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-[0_10px_28px_rgba(31,111,181,0.08)] transition hover:-translate-y-0.5 hover:border-[#7fb3e4]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                    {group.area}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                    {group.name}
                  </div>
                  <div className="text-xs text-[#47729f] dark:text-slate-400">
                    {group.category}
                  </div>
                </div>
                <div className="rounded-full border border-[#acd3ff] dark:border-slate-700 bg-[#e8f3ff] dark:bg-slate-700 px-3 py-1 text-[11px] font-semibold text-[#003b75] dark:text-slate-200">
                  View Detail
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {primary ? (
                  <div className="rounded-lg border border-[#d6e9fb] dark:border-slate-700 bg-[#f7fbff] dark:bg-slate-900/40 p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                      {primary.label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                      {formatValue(primary.value, primary.unit)}
                    </div>
                    <div className="text-[11px] text-[#47729f] dark:text-slate-400">
                      {primary.caption}
                    </div>
                  </div>
                ) : null}
                {secondary ? (
                  <div className="rounded-lg border border-[#d6e9fb] dark:border-slate-700 bg-[#f7fbff] dark:bg-slate-900/40 p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                      {secondary.label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[#002b5c] dark:text-slate-100">
                      {formatValue(secondary.value, secondary.unit)}
                    </div>
                    <div className="text-[11px] text-[#47729f] dark:text-slate-400">
                      {secondary.caption}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Alarms and Maintenance Tasks Section */}
              <div className="mt-3.5 grid grid-cols-2 gap-3">
                {/* Active Alarms */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400 font-semibold mb-1.5">
                    Alarms ({groupAlarms.length})
                  </div>
                  {groupAlarms.length > 0 ? (
                    <div className="space-y-1 max-h-[60px] overflow-y-auto scrollbar-thin">
                      {groupAlarms.map((alarm) => (
                        <div key={alarm.alarmKey} className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span className="truncate">{alarm.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#087f5b] dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2fa981]" />
                      No active alarms
                    </div>
                  )}
                </div>

                {/* Maintenance Tasks */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400 font-semibold mb-1.5">
                    Tasks ({groupTasks.length})
                  </div>
                  {groupTasks.length > 0 ? (
                    <div className="space-y-1 max-h-[60px] overflow-y-auto scrollbar-thin">
                      {groupTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                            task.status === "Active" ? "bg-blue-500 animate-pulse" : "bg-amber-500"
                          }`} />
                          <span className="truncate">{task.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      All tasks completed
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-[#d6e9fb] dark:border-slate-700 bg-[#f7fbff] dark:bg-slate-900/40 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-[#1f6fb5] dark:text-sky-400">
                  Trend Snapshot
                </div>
                <TrendChart
                  points={trendPoints}
                  unit={group.trend.unit}
                  heightClassName="h-24"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
