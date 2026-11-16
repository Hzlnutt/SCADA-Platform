import { Navigate, Outlet, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { MachineTabs } from "../../components/machines/MachineTabs";
import { useTranslation } from "../../i18n/useTranslation";
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
  const { language, t } = useTranslation();
  const headerTitle =
    machine.id === "hvac-wh-7"
      ? t("warehouse7.title", machine.name)
      : machine.name;
  const headerDescription =
    group.id === "hvac-warehouse"
      ? `${language === "id" ? "Gudang HVAC" : group.name} | ${machine.area}`
      : `${group.name} | ${machine.area}`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <PageHeader
          title={headerTitle}
          description={headerDescription}
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