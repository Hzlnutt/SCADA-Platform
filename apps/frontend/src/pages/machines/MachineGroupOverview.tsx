import { Link, Navigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/cards/StatCard";
import { TrendChart } from "../../components/charts/TrendChart";
import {
  defaultGroupId,
  defaultUnitId,
  getGroupById
} from "../../data/machines";

const buildTrendPoints = (values: number[]) => {
  const now = Date.now();
  const stepMs = 60 * 1000;

  return values.map((value, index) => ({
    ts: new Date(now - (values.length - index) * stepMs),
    value
  }));
};

const formatValue = (value: number, unit: string) =>
  unit ? `${value.toFixed(1)} ${unit}` : value.toFixed(1);

export default function MachineGroupOverview() {
  const params = useParams();
  const groupId = params.groupId ?? defaultGroupId;
  const group = getGroupById(groupId);

  if (!group) {
    return <Navigate to={`/machines/${defaultGroupId}`} replace />;
  }

  const trendPoints = buildTrendPoints(
    group.trend.series[0].values.slice(-36)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={group.name}
        description={`${group.area} | ${group.category}`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {group.summaryCards.map((card) => (
          <StatCard
            key={card.label}
            title={card.label}
            value={formatValue(card.value, card.unit)}
            detail={card.caption}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Group Trend
          </div>
          <div className="mt-4">
            <TrendChart
              points={trendPoints}
              unit={group.trend.unit}
              heightClassName="h-40"
            />
          </div>
        </section>
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Ringkasan Operasi
          </div>
          <div className="mt-4 space-y-3">
            {group.highlights.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between border-b border-slate-900 pb-3 text-sm last:border-0"
              >
                <span className="text-slate-400">{item.label}</span>
                <span className="font-mono text-slate-100">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Unit List
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {group.units.map((unit) => (
            <Link
              key={unit.id}
              to={`/machines/${group.id}/${unit.id}`}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition hover:border-[#7fb3e4]"
            >
              <div className="text-sm font-semibold text-slate-100">
                {unit.unitLabel}
              </div>
              <div className="text-xs text-slate-500">{unit.tagId}</div>
              <div className="mt-3 text-xs text-slate-400">
                Latest: {unit.trend.series[0].values.slice(-1)[0].toFixed(1)} {unit.unit}
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-xs text-slate-500">
          Default unit: {defaultUnitId}
        </div>
      </section>
    </div>
  );
}
