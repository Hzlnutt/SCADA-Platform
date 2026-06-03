export const buildSeries = (length: number, base: number, variance: number, phase = 0) =>
  Array.from({ length }, (_, i) => {
    const wave = Math.sin((i + phase) / 3) + Math.cos((i + phase) / 7);
    return Number((base + wave * variance * 0.6).toFixed(2));
  });

export const buildLabels = (
  points: number,
  stepMs: number,
  type: "time" | "day" | "month" | "year"
) => {
  const now = new Date();
  return Array.from({ length: points }, (_, index) => {
    const date = new Date(now.getTime() - (points - 1 - index) * stepMs);
    if (type === "time") {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (type === "month") {
      return date.toLocaleDateString([], { month: "short" });
    }
    if (type === "year") {
      return date.getFullYear().toString();
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  });
};
