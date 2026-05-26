import { create } from "zustand";

export type TimeRange = "5m" | "1h" | "1d" | "1w" | "1m" | "1y";

type TimeRangeState = {
  range: TimeRange;
  compare: boolean;
  setRange: (range: TimeRange) => void;
  toggleCompare: () => void;
};

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  range: "1d",
  compare: true,
  setRange: (range) => set({ range }),
  toggleCompare: () => set((state) => ({ compare: !state.compare }))
}));
