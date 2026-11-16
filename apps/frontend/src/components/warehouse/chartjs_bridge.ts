// Bridge import so Chart.js elements are always registered once
import "../charts/chartjs";
import { Interaction, type Chart, type ChartEvent, type InteractionItem, type InteractionOptions } from "chart.js";
import { getRelativePosition } from "chart.js/helpers";

// Vertical-column ("segaris") single-series mode: always snaps to the nearest X column anywhere vertically
// inside chartArea, then chooses the single dataset point closest vertically (Y) to the cursor.
const modesRegistry = Interaction.modes as unknown as Record<
  string,
  (chart: Chart, e: ChartEvent, options: InteractionOptions, useFinalPosition?: boolean) => InteractionItem[]
>;

if (!modesRegistry.wh7VerticalSingle) {
  modesRegistry.wh7VerticalSingle = (chart, e, options, useFinalPosition) => {
    const items = Interaction.modes.index(
      chart,
      e,
      { ...options, axis: "x", intersect: false },
      useFinalPosition
    );
    if (!items || items.length <= 1) return items;
    const pos = getRelativePosition(e as unknown as Event, chart);
    const cursorY = pos?.y;
    if (typeof cursorY !== "number" || !Number.isFinite(cursorY)) return [items[0]];

    let best = items[0];
    let bestDy = Math.abs(((best.element as { y?: number })?.y ?? cursorY) - cursorY);
    for (let i = 1; i < items.length; i++) {
      const y = (items[i].element as { y?: number })?.y ?? cursorY;
      const dy = Math.abs(y - cursorY);
      if (dy < bestDy) {
        bestDy = dy;
        best = items[i];
      }
    }
    return [best];
  };
}
