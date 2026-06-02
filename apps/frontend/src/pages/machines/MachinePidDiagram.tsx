import { useOutletContext } from "react-router-dom";
import { StatCard } from "../../components/cards/StatCard";
import { getUnitById } from "../../data/machines";
import pidBaseImage from "../../assets/pid-base2.png";
import type { MachineOutletContext } from "./MachineLayout";

const PID_CANVAS_WIDTH = 1836;
const PID_CANVAS_HEIGHT = 789;
const PID_CANVAS_ASPECT_RATIO = `${PID_CANVAS_WIDTH} / ${PID_CANVAS_HEIGHT}`;

export default function MachinePidDiagram() {
  const { unitId } = useOutletContext<MachineOutletContext>();
  const machine = getUnitById(unitId);

  if (!machine) {
    return null;
  }

  // Sample data for P&ID info cards
  const pidInfo = {
    supplyTemp: { value: 28.5, unit: "°C", label: "Supply Temp" },
    prosesTemp: { value: 35.2, unit: "°C", label: "Proses ST" },
    duration: { value: 4.8, unit: "h", label: "Duration" },
    lot: { value: 12450, unit: "", label: "Lot" },
    returnTemp: { value: 32.1, unit: "°C", label: "Return Temp" }
  };

  return (
    <div className="space-y-6">
      {/* Info Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title={pidInfo.supplyTemp.label}
          value={`${pidInfo.supplyTemp.value}${pidInfo.supplyTemp.unit}`}
        />
        <StatCard
          title={pidInfo.prosesTemp.label}
          value={`${pidInfo.prosesTemp.value}${pidInfo.prosesTemp.unit}`}
        />
        <StatCard
          title={pidInfo.duration.label}
          value={`${pidInfo.duration.value}${pidInfo.duration.unit}`}
        />
        <StatCard
          title={pidInfo.lot.label}
          value={pidInfo.lot.value.toString()}
        />
        <StatCard
          title={pidInfo.returnTemp.label}
          value={`${pidInfo.returnTemp.value}${pidInfo.returnTemp.unit}`}
        />
      </div>

      {/* P&ID Canvas Area */}
      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:p-5">
        <div className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-500">
          P&ID Diagram Canvas - {machine.name}
        </div>
        <div className="overflow-x-auto pb-2">
          <div
            className="relative mx-auto w-full min-w-[720px] max-w-[1836px] overflow-hidden rounded-lg border border-dashed border-slate-700 bg-slate-900"
            style={{ aspectRatio: PID_CANVAS_ASPECT_RATIO }}
          >
            <img
              src={pidBaseImage}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
              draggable={false}
            />
            <canvas
              id="pid-canvas"
              width={PID_CANVAS_WIDTH}
              height={PID_CANVAS_HEIGHT}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
