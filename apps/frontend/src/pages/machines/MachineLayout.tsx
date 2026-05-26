import { Navigate, Outlet, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { MachineTabs } from "../../components/machines/MachineTabs";
import {
  defaultGroupId,
  defaultUnitId,
  getGroupById,
  getUnitById
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

  return (
    <div>
      <PageHeader
        title={machine.name}
        description={`${group.name} | ${machine.area}`}
      />
      <MachineTabs basePath={`/machines/${group.id}/${machine.id}`} />
      <Outlet
        context={{ groupId: group.id, unitId: machine.id } satisfies MachineOutletContext}
      />
    </div>
  );
};
