import { create } from "zustand";

type ConfigState = {
  wbpRate: number;
  lwbpRate: number;
  setRates: (wbp: number, lwbp: number) => void;
};

const getSavedWbpRate = () => {
  const saved = localStorage.getItem("scada.config.wbpRate");
  return saved ? Number(saved) : 1600;
};

const getSavedLwbpRate = () => {
  const saved = localStorage.getItem("scada.config.lwbpRate");
  return saved ? Number(saved) : 1112;
};

export const useConfigStore = create<ConfigState>((set) => ({
  wbpRate: getSavedWbpRate(),
  lwbpRate: getSavedLwbpRate(),
  setRates: (wbp, lwbp) => {
    localStorage.setItem("scada.config.wbpRate", wbp.toString());
    localStorage.setItem("scada.config.lwbpRate", lwbp.toString());
    set({ wbpRate: wbp, lwbpRate: lwbp });
  }
}));
