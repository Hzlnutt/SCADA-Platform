import { create } from "zustand";

type SystemState = {
  socketStatus: "connected" | "disconnected";
  setSocketStatus: (status: "connected" | "disconnected") => void;
};

export const useSystemStore = create<SystemState>((set) => ({
  socketStatus: "disconnected",
  setSocketStatus: (socketStatus) => set({ socketStatus })
}));
