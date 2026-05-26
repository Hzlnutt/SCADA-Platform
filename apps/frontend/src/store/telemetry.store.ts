import { create } from "zustand";

export type TelemetryPoint = {
  ts: string;
  value: number | string | boolean;
  quality?: "good" | "bad" | "uncertain";
  meta: {
    tagId: string;
    deviceId?: string;
    unit?: string;
    area?: string;
  };
};

type TelemetryState = {
  latest: Record<string, TelemetryPoint>;
  seriesByTag: Record<string, TelemetryPoint[]>;
  addPoints: (points: TelemetryPoint[]) => void;
};

const MAX_SERIES_POINTS = 120;

export const useTelemetryStore = create<TelemetryState>((set) => ({
  latest: {},
  seriesByTag: {},
  addPoints: (points) =>
    set((state) => {
      const next = { ...state.latest };
      const nextSeries = { ...state.seriesByTag };

      points.forEach((point) => {
        const tagId = point.meta.tagId;
        next[tagId] = point;
        const current = nextSeries[tagId] ?? [];
        nextSeries[tagId] = [...current, point].slice(-MAX_SERIES_POINTS);
      });

      return { latest: next, seriesByTag: nextSeries };
    })
}));
