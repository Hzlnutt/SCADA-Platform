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

// Listen to changes from other tabs using the HTML5 storage event
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "scada.config.wbpRate" || event.key === "scada.config.lwbpRate") {
      const wbp = localStorage.getItem("scada.config.wbpRate");
      const lwbp = localStorage.getItem("scada.config.lwbpRate");
      useConfigStore.setState({
        wbpRate: wbp ? Number(wbp) : 1600,
        lwbpRate: lwbp ? Number(lwbp) : 1112
      });
    }
  });
}
