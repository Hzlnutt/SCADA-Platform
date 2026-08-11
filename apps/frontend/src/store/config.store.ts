import { create } from "zustand";
import { getJson, postJson } from "../services/api.client";

export type WaterTier = {
  maxVolume: number | null;
  rate: number;
};

export type WaterConfig = {
  taxRate: number;
  ar: number;
  tiers: WaterTier[];
};

export type ElectricityTariff = {
  validFrom: string; // "YYYY-MM"
  wbpRate: number;
  lwbpRate: number;
};

export type GasConfig = {
  pricePerSm3: number;
  usdPerMmbtu: number;
};

export type GasCategory = {
  id: string;
  name: string;
  val: number;
  enabled: boolean;
};

type ConfigState = {
  wbpRate: number;
  lwbpRate: number;
  waterConfig: WaterConfig;
  electricityTariffs: ElectricityTariff[];
  gasConfig: GasConfig | null;
  gasCategories: GasCategory[];
  loading: boolean;
  fetchRates: () => Promise<void>;
  setRates: (
    wbp: number,
    lwbp: number,
    waterConfig?: WaterConfig,
    electricityTariffs?: ElectricityTariff[],
    gasConfig?: GasConfig,
    gasCategories?: GasCategory[]
  ) => Promise<void>;
};

export const useConfigStore = create<ConfigState>((set) => ({
  wbpRate: 1600,
  lwbpRate: 1112,
  waterConfig: {
    taxRate: 0.20,
    ar: 0.18,
    tiers: [
      { maxVolume: 50, rate: 5900 },
      { maxVolume: 500, rate: 6600 },
      { maxVolume: 1000, rate: 7550 },
      { maxVolume: 2500, rate: 9050 },
      { maxVolume: null, rate: 11300 }
    ]
  },
  electricityTariffs: [
    { validFrom: "2024-01", wbpRate: 1600, lwbpRate: 1112 }
  ],
  gasConfig: null,
  gasCategories: [],
  loading: false,
  fetchRates: async () => {
    try {
      set({ loading: true });
      const res = await getJson<{
        data: {
          wbpRate: number;
          lwbpRate: number;
          waterConfig?: WaterConfig;
          electricityTariffs?: ElectricityTariff[];
          gasConfig?: GasConfig;
          gasCategories?: GasCategory[];
        }
      }>("/config/utility");
      if (res && res.data) {
        set({ 
          wbpRate: res.data.wbpRate, 
          lwbpRate: res.data.lwbpRate,
          ...(res.data.waterConfig ? { waterConfig: res.data.waterConfig } : {}),
          ...(res.data.gasConfig ? { gasConfig: res.data.gasConfig } : {}),
          ...(res.data.gasCategories ? { gasCategories: res.data.gasCategories } : {}),
          electricityTariffs: res.data.electricityTariffs || [
            { validFrom: "2024-01", wbpRate: res.data.wbpRate, lwbpRate: res.data.lwbpRate }
          ]
        });
      }
    } catch (err) {
      console.error("Failed to fetch utility rates config:", err);
    } finally {
      set({ loading: false });
    }
  },
  setRates: async (wbp, lwbp, waterConfig, electricityTariffs, gasConfig, gasCategories) => {
    try {
      set({ loading: true });
      const payload: any = {
        wbpRate: wbp,
        lwbpRate: lwbp
      };
      if (waterConfig) {
        payload.waterConfig = waterConfig;
      }
      if (electricityTariffs) {
        payload.electricityTariffs = electricityTariffs;
      }
      if (gasConfig) {
        payload.gasConfig = gasConfig;
      }
      if (gasCategories) {
        payload.gasCategories = gasCategories;
      }
      const res = await postJson<{
        data: {
          wbpRate: number;
          lwbpRate: number;
          waterConfig?: WaterConfig;
          electricityTariffs?: ElectricityTariff[];
          gasConfig?: GasConfig;
          gasCategories?: GasCategory[];
        }
      }>("/config/utility", payload);
      if (res && res.data) {
        set({ 
          wbpRate: res.data.wbpRate, 
          lwbpRate: res.data.lwbpRate,
          ...(res.data.waterConfig ? { waterConfig: res.data.waterConfig } : {}),
          ...(res.data.gasConfig ? { gasConfig: res.data.gasConfig } : {}),
          ...(res.data.gasCategories ? { gasCategories: res.data.gasCategories } : {}),
          electricityTariffs: res.data.electricityTariffs || [
            { validFrom: "2024-01", wbpRate: res.data.wbpRate, lwbpRate: res.data.lwbpRate }
          ]
        });
      }
    } catch (err) {
      console.error("Failed to update utility rates config:", err);
      throw err;
    } finally {
      set({ loading: false });
    }
  }
}));

// Fetch configuration initially when config store module loads
if (typeof window !== "undefined") {
  useConfigStore.getState().fetchRates();
}

