import { create } from "zustand";
import { getJson, postJson } from "../services/api.client";

type ConfigState = {
  wbpRate: number;
  lwbpRate: number;
  loading: boolean;
  fetchRates: () => Promise<void>;
  setRates: (wbp: number, lwbp: number) => Promise<void>;
};

export const useConfigStore = create<ConfigState>((set) => ({
  wbpRate: 1600,
  lwbpRate: 1112,
  loading: false,
  fetchRates: async () => {
    try {
      set({ loading: true });
      const res = await getJson<{ data: { wbpRate: number; lwbpRate: number } }>("/config/utility");
      if (res && res.data) {
        set({ wbpRate: res.data.wbpRate, lwbpRate: res.data.lwbpRate });
      }
    } catch (err) {
      console.error("Failed to fetch utility rates config:", err);
    } finally {
      set({ loading: false });
    }
  },
  setRates: async (wbp, lwbp) => {
    try {
      set({ loading: true });
      const res = await postJson<{ data: { wbpRate: number; lwbpRate: number } }>("/config/utility", {
        wbpRate: wbp,
        lwbpRate: lwbp
      });
      if (res && res.data) {
        set({ wbpRate: res.data.wbpRate, lwbpRate: res.data.lwbpRate });
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
