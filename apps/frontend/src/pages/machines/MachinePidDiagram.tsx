import { useOutletContext } from "react-router-dom";
import { StatCard } from "../../components/cards/StatCard";
import { getUnitById } from "../../data/machines";
import pidBaseImage from "../../assets/pid-base2.png";
import type { MachineOutletContext } from "./MachineLayout";

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
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <div className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-500">
          P&ID Diagram Canvas - {machine.name}
        </div>
        <div 
          className="relative min-h-[500px] rounded-lg border border-dashed border-slate-700 bg-cover bg-center"
          style={{ backgroundImage: `url(${pidBaseImage})` }}
        >
          <canvas
            id="pid-canvas"
            className="absolute inset-0 w-full rounded-lg"
            style={{ minHeight: "500px" }}
          />
        </div>
      </section>
    </div>
  );
}
