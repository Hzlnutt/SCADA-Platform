export const buildSeries = (length: number, base: number, variance: number, phase = 0) =>
  Array.from({ length }, (_, i) => {
    const wave = Math.sin((i + phase) / 3) + Math.cos((i + phase) / 7);
    return Number((base + wave * variance * 0.6).toFixed(2));
  });

/**
 * Same as buildSeries but nulls out data points beyond maxIndex.
 * maxIndex is the last index that has elapsed (0-based).
 * Points at index > maxIndex become null so charts render gaps.
 */
export const buildTimeAwareSeries = (
  length: number,
  base: number,
  variance: number,
  phase = 0,
  maxIndex: number
) =>
  Array.from({ length }, (_, i) => {
    if (i > maxIndex) return null as unknown as number;
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

/**
 * Forward-looking labels from the start of a period to its end.
 * E.g. Per Jam: "00:00" → "23:00", Per Hari: "1 Jun" → "30 Jun".
 */
export const buildTimeLabels = (
  points: number,
  type: "time" | "day" | "month" | "year"
) => {
  const now = new Date();
  if (type === "time") {
    return Array.from({ length: points }, (_, i) => {
      const d = new Date(now);
      d.setHours(i, 0, 0, 0);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });
  }
  if (type === "day") {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: points }, (_, i) => {
      const day = Math.min(i + 1, daysInMonth);
      const d = new Date(year, month, day);
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    });
  }
  if (type === "month") {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), i, 1);
      return d.toLocaleDateString([], { month: "short" });
    });
  }
  return Array.from({ length: points }, (_, i) =>
    (now.getFullYear() - points + 1 + i).toString()
  );
};

/**
 * Compute the last elapsed index for time-aware charts.
 * - Per Jam: current hour (0-23)
 * - Per Hari: current day of month - 1 (0-27/28/29/30)
 * - Per Bulan: current month index (0-11)
 */
export const getElapsedIndex = (
  type: "time" | "day" | "month" | "year"
) => {
  const now = new Date();
  if (type === "time") return now.getHours();
  if (type === "day") return now.getDate() - 1;
  if (type === "month") return now.getMonth();
  return 11;
};
