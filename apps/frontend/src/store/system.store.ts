import { create } from "zustand";

type SystemState = {
  socketStatus: "connected" | "disconnected";
  setSocketStatus: (status: "connected" | "disconnected") => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
};

const getInitialTheme = (): "light" | "dark" => {
  const stored = localStorage.getItem("scada.theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark"; // Default to dark mode for SCADA
};

export const useSystemStore = create<SystemState>((set) => ({
  socketStatus: "disconnected",
  setSocketStatus: (socketStatus) => set({ socketStatus }),
  theme: getInitialTheme(),
  toggleTheme: () => set((state) => {
    const next = state.theme === "light" ? "dark" : "light";
    localStorage.setItem("scada.theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return { theme: next };
  }),
  setTheme: (theme) => set(() => {
    localStorage.setItem("scada.theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return { theme };
  })
}));

