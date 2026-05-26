import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { TrendChart } from "../../components/charts/TrendChart";
import { machineGroups } from "../../data/machines";

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

          return (
            <Link
              key={group.id}
              to={`/machines/${group.id}`}
              className="group rounded-xl border border-[#acd3ff] bg-white p-5 shadow-[0_10px_28px_rgba(31,111,181,0.08)] transition hover:-translate-y-0.5 hover:border-[#7fb3e4]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5]">
                    {group.area}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#002b5c]">
                    {group.name}
                  </div>
                  <div className="text-xs text-[#47729f]">
                    {group.category}
                  </div>
                </div>
                <div className="rounded-full border border-[#acd3ff] bg-[#e8f3ff] px-3 py-1 text-[11px] font-semibold text-[#003b75]">
                  View Detail
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {primary ? (
                  <div className="rounded-lg border border-[#d6e9fb] bg-[#f7fbff] p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#1f6fb5]">
                      {primary.label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[#002b5c]">
                      {formatValue(primary.value, primary.unit)}
                    </div>
                    <div className="text-[11px] text-[#47729f]">
                      {primary.caption}
                    </div>
                  </div>
                ) : null}
                {secondary ? (
                  <div className="rounded-lg border border-[#d6e9fb] bg-[#f7fbff] p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#1f6fb5]">
                      {secondary.label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[#002b5c]">
                      {formatValue(secondary.value, secondary.unit)}
                    </div>
                    <div className="text-[11px] text-[#47729f]">
                      {secondary.caption}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-lg border border-[#d6e9fb] bg-[#f7fbff] p-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-[#1f6fb5]">
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
