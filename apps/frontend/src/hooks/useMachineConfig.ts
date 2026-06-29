import { useEffect, useState } from "react";
import { getJson, postJson, patchJson, deleteJson } from "../services/api.client";
import { machineGroups as fallbackCategories, machineUnits as fallbackMachines } from "../data/machines";

// --- TYPE DEFINITIONS ---

export type MachineCategory = {
  _id?: string;
  id: string;
  name: string;
  parameters: Array<{
    key: string;
    label: string;
    unit: string;
    type: "realtime" | "analog" | "digital";
  }>;
};

export type MachineConfig = {
  _id?: string;
  id: string;
  name: string;
  categoryId: string;
  area: string;
  status: "active" | "inactive";
  apiBindings: Record<string, string>;
  analysisConfig: {
    trendWindow: number;
    samplingRate: number;
    enabledAnalytics: Array<"trend" | "histogram" | "fft">;
  };
  createdAt?: string;
  updatedAt?: string;
  categoryName?: string;
  categorySlug?: string;
};

export type MachineConfigCreatePayload = {
  id: string;
  name: string;
  categoryId: string;
  area: string;
  status: "active" | "inactive";
  apiBindings: Record<string, string>;
  analysisConfig: {
    trendWindow: number;
    samplingRate: number;
    enabledAnalytics: Array<"trend" | "histogram" | "fft">;
  };
};

export type MachineThreshold = {
  _id?: string;
  machineId: string;
  parameter: string;
  warningHigh: number;
  alarmHigh: number;
  warningLow: number;
  alarmLow: number;
};

export type ThresholdPayload = {
  machineId: string;
  parameter: string;
  warningHigh: number;
  alarmHigh: number;
  warningLow: number;
  alarmLow: number;
};

// --- STANDALONE API FUNCTIONS ---

export const createMachine = (body: MachineConfigCreatePayload) =>
  postJson<{ data: MachineConfig }>("/config/machines", body);

export const updateMachine = (id: string, body: Partial<MachineConfigCreatePayload>) =>
  patchJson<{ data: MachineConfig }>(`/config/machines/${id}`, body);

export const deactivateMachine = (id: string) =>
  deleteJson<{ message: string }>(`/config/machines/${id}`);

export const upsertThresholds = (machineId: string, thresholds: ThresholdPayload[]) =>
  postJson<{ message: string; count: number }>("/config/thresholds", { machineId, thresholds });

export const getThresholds = (machineId: string) =>
  getJson<{ data: MachineThreshold[] }>(`/config/thresholds/${machineId}`);

export const bindMachine = (id: string) =>
  postJson<{ machineId: string; results: Record<string, "connected" | "simulated" | "failed"> }>(
    `/config/machines/${id}/bind`,
    {}
  );

// --- THE REACT HOOK ---

export const useMachineConfig = () => {
  const [categories, setCategories] = useState<MachineCategory[]>([]);
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resCat, resMach] = await Promise.all([
        getJson<{ data: MachineCategory[] }>("/config/categories"),
        getJson<{ data: MachineConfig[] }>("/config/machines?status=active")
      ]);
      setCategories(resCat.data);
      setMachines(resMach.data);
    } catch (err) {
      console.warn("Failed to fetch dynamic machine configs, using static fallback", err);
      setError(err instanceof Error ? err.message : "Failed to load configs");

      // Generate fallback categories from static machines
      const mappedCats: MachineCategory[] = fallbackCategories.map((group) => {
        const paramMap = new Map<string, any>();
        group.units.forEach((unit) => {
          if (unit.tagId) {
            const parts = unit.tagId.split("/");
            const key = parts[parts.length - 1];
            paramMap.set(key, {
              key,
              label: key
                .split(/[_-]/)
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(" "),
              unit: unit.unit,
              type: "realtime"
            });
          }
        });
        return {
          id: group.id,
          name: group.name,
          parameters: Array.from(paramMap.values())
        };
      });

      // Generate fallback machines from static units
      const mappedMachs: MachineConfig[] = fallbackMachines.map((unit) => {
        const tagParts = unit.tagId ? unit.tagId.split("/") : [];
        const paramKey = tagParts.length > 0 ? tagParts[tagParts.length - 1] : "status";
        return {
          id: unit.id,
          name: unit.unitLabel || unit.name,
          categoryId: unit.groupId,
          area: unit.area,
          status: "active",
          apiBindings: unit.tagId ? { [paramKey]: unit.tagId } : {},
          analysisConfig: {
            trendWindow: 24,
            samplingRate: 5,
            enabledAnalytics: ["trend"]
          },
          categoryName: unit.groupName,
          categorySlug: unit.groupId
        };
      });

      setCategories(mappedCats);
      setMachines(mappedMachs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    categories,
    machines,
    isLoading,
    error,
    refetch: fetchData
  };
};
