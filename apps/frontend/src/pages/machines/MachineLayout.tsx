import { Navigate, Outlet, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { MachineTabs } from "../../components/machines/MachineTabs";
import {
  defaultGroupId,
  defaultUnitId,
  getGroupById,
  getUnitById,
} from "../../data/machines";

export type MachineOutletContext = {
  groupId: string;
  unitId: string;
};

export const MachineLayout = () => {
  const params = useParams();
  const groupId = params.groupId ?? defaultGroupId;
  const unitId = params.unitId ?? defaultUnitId;
  const group = getGroupById(groupId);
  const machine = getUnitById(unitId);

  if (!machine || !group || machine.groupId !== group.id) {
    return (
      <Navigate
        to={`/machines/${defaultGroupId}/${defaultUnitId}`}
        replace
      />
    );
  }

  // Cek apakah ini grup HVAC
  const isHvac = group.id.startsWith("hvac");
  const basePath = `/machines/${group.id}/${machine.id}`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <PageHeader
          title={machine.name}
          description={`${group.name} | ${machine.area}`}
        />
        {/* Hapus hvacUnits={hvacUnits} karena sudah hardcoded di dalam */}
        <MachineTabs
          basePath={basePath}
          isHvacGroup={isHvac}
          groupId={group.id}
          currentUnitId={machine.id}
        />
        <Outlet
          context={{ groupId: group.id, unitId: machine.id } satisfies MachineOutletContext}
        />
      </div>
    </div>
  );
};